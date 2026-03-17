/**
 * Sanity asset helpers for the image processing tool.
 *
 * - Fetches image data from Sanity CDN as base64
 * - Uploads processed images back to Sanity as new assets
 * - Replaces image references in project documents
 * - Tags AI-processed assets with metadata
 */

import type { SanityClient } from 'sanity'

import type {
  ProcessingMode,
  ProjectWithImages,
  SanityImageAsset,
  VideoAsset,
  VideoInfo,
} from './types'

function isSanityImageAsset(value: unknown): value is SanityImageAsset {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<SanityImageAsset>
  return typeof candidate._id === 'string' && typeof candidate.url === 'string'
}

/**
 * Fetch all projects that have images in their media gallery.
 */
export async function fetchProjectsWithImages(client: SanityClient): Promise<ProjectWithImages[]> {
  const query = `*[_type == "project" && !(_id in path("drafts.**")) && defined(mediaGallery)] | order(titre asc) {
    _id,
    titre,
    localisation,
    "images": mediaGallery[] {
      "resolved": coalesce(image.asset, asset)->{
        _id,
        url,
        originalFilename,
        mimeType,
        label,
        description,
        metadata {
          dimensions {
            width,
            height
          },
          lqip
        }
      },
      "hasVideo": defined(videoUrl)
    } {
      ...resolved,
      hasVideo
    }
  }`

  const results = await client.fetch<ProjectWithImages[]>(query)

  return results
    .map((project) => ({
      ...project,
      images: Array.isArray(project.images) ? project.images.filter(isSanityImageAsset) : [],
    }))
    .filter((project) => project.images.length > 0)
}

/**
 * Fetch all image assets from Sanity (not project-specific).
 */
export async function fetchAllImageAssets(client: SanityClient): Promise<SanityImageAsset[]> {
  const query = `*[_type == "sanity.imageAsset"] | order(_createdAt desc) [0...100] {
    _id,
    url,
    originalFilename,
    mimeType,
    label,
    description,
    "hasVideo": count(*[_type == "project" && references(^._id)].mediaGallery[
      (image.asset._ref == ^._id || asset._ref == ^._id) && defined(videoUrl)
    ]) > 0,
    metadata {
      dimensions {
        width,
        height
      },
      lqip
    }
  }`

  return client.fetch<SanityImageAsset[]>(query)
}

/**
 * Fetch a single image asset by ID. Returns null if not found.
 */
export async function fetchImageAsset(
  client: SanityClient,
  assetId: string
): Promise<SanityImageAsset | null> {
  return client.fetch<SanityImageAsset | null>(
    `*[_id == $id][0]{
      _id, url, originalFilename, mimeType, label, description,
      metadata { dimensions { width, height }, lqip }
    }`,
    { id: assetId }
  )
}

/**
 * Fetch image data from a Sanity CDN URL and return as base64.
 *
 * Vertex AI accepts PNG, JPEG, GIF, BMP (max 20 MB after transcode).
 * We request high-quality JPEG (`fm=jpg&q=95`) from Sanity's image pipeline.
 */
export async function fetchImageAsBase64(
  imageUrl: string
): Promise<{ base64: string; mimeType: string }> {
  // Fetch full-resolution image for Vertex AI analysis (no resizing)
  const separator = imageUrl.includes('?') ? '&' : '?'
  const optimizedUrl = `${imageUrl}${separator}fm=jpg&q=95`

  const response = await fetch(optimizedUrl)
  if (!response.ok) {
    throw new Error(`Impossible de télécharger l'image : ${response.status} ${response.statusText}`)
  }

  const blob = await response.blob()
  const mimeType = blob.type || 'image/jpeg'

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      // Strip the data URI prefix to get raw base64
      const base64 = dataUrl.split(',')[1]
      if (!base64) {
        reject(new Error('Impossible de convertir l\u2019image en base64.'))
        return
      }
      resolve({ base64, mimeType })
    }
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier image.'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Resolve the original (unprocessed) image URL for a given asset.
 *
 * If the asset has already been processed (`label === 'ai-processed'`),
 * extracts the original asset ID from its `description` field and fetches
 * the original asset's URL so re-processing always starts from the raw image.
 *
 * @returns `{ url, originalAssetId }` — the URL to use for processing and
 *          the original asset ID to store as source reference.
 */
export async function resolveOriginalAssetUrl(
  client: SanityClient,
  asset: SanityImageAsset
): Promise<{ url: string; originalAssetId: string }> {
  if (asset.label !== 'ai-processed' && asset.label !== 'cloudinary-processed') {
    return { url: asset.url, originalAssetId: asset._id }
  }

  // Extract original asset ID from description "Source: <id> — Mode: <mode>"
  const match = asset.description?.match(/Source:\s*(\S+)/)
  if (!match?.[1]) {
    // No source reference — fall back to processing the current asset
    return { url: asset.url, originalAssetId: asset._id }
  }

  const originalAssetId = match[1]

  // Fetch original asset URL
  const original = await client.fetch<{ url?: string }>(`*[_id == $id][0]{ url }`, {
    id: originalAssetId,
  })

  if (!original?.url) {
    // Original no longer exists — fall back to current asset
    return { url: asset.url, originalAssetId: asset._id }
  }

  return { url: original.url, originalAssetId }
}

/**
 * Upload a base64-encoded image to Sanity as a new asset and tag it as AI-processed.
 *
 * @param client - Authenticated Sanity client
 * @param base64Data - Raw base64 image data (no data URI prefix)
 * @param mimeType - MIME type of the image
 * @param filename - Desired filename for the asset
 * @param originalAssetId - ID of the source asset (for traceability)
 * @param mode - Processing mode used
 * @returns The created asset document ID
 */
export async function uploadProcessedImage(
  client: SanityClient,
  base64Data: string,
  mimeType: string,
  filename: string,
  originalAssetId?: string,
  mode?: ProcessingMode | 'equalize+cadrage' | 'auto_correct'
): Promise<string> {
  // Convert base64 to Blob
  const byteChars = atob(base64Data)
  const byteArray = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) {
    byteArray[i] = byteChars.charCodeAt(i)
  }
  const blob = new Blob([byteArray], { type: mimeType })
  const file = new File([blob], filename, { type: mimeType })

  const asset = await client.assets.upload('image', file, {
    filename,
    contentType: mimeType,
  })

  // Tag the asset as ai-processed for easy filtering in the media library
  const description = [
    originalAssetId ? `Source: ${originalAssetId}` : null,
    mode ? `Mode: ${mode}` : null,
  ]
    .filter(Boolean)
    .join(' — ')

  await client
    .patch(asset._id)
    .set({
      label: 'ai-processed',
      ...(description ? { description } : {}),
    })
    .commit()

  return asset._id
}

// ---------------------------------------------------------------------------
// Project gallery replacement
// ---------------------------------------------------------------------------

interface GalleryItem {
  _key: string
  _type: string
  /** Raw image item */
  asset?: { _ref: string; _type: string }
  hotspot?: unknown
  crop?: unknown
  /** Media object item */
  image?: { asset?: { _ref: string; _type: string } }
  videoUrl?: string
}

/** Get the image asset _ref from a gallery item regardless of its type. */
function getGalleryItemAssetRef(item: GalleryItem): string | undefined {
  return item.image?.asset?._ref ?? item.asset?._ref
}

/** Get the patch path prefix for the image asset inside a gallery item. */
function getGalleryItemAssetPath(item: GalleryItem): string {
  return item.image?.asset?._ref ? 'image.asset._ref' : 'asset._ref'
}

/**
 * Apply a patch callback to both the published and draft versions of a document.
 *
 * The image-processing tool fetches published projects, so `projectId` is always
 * a published ID. To prevent a stale draft from overwriting the change on next
 * publish, we mirror the patch onto `drafts.<id>` when a draft exists.
 */
async function patchPublishedAndDraft(
  client: SanityClient,
  projectId: string,
  apply: (docId: string) => Promise<void>
): Promise<void> {
  // Patch the published document
  await apply(projectId)

  // Mirror onto the draft if one exists
  const draftId = `drafts.${projectId}`
  const draftExists = await client.fetch<boolean>(`defined(*[_id == $id][0]._id)`, {
    id: draftId,
  })
  if (draftExists) {
    try {
      await apply(draftId)
    } catch {
      // Non-fatal — the published doc was already patched
    }
  }
}

/**
 * Replace an image asset reference inside a project's `mediaGallery`.
 *
 * Finds the gallery item pointing to `oldAssetId` and swaps its `asset._ref`
 * to `newAssetId`, preserving `_key`, hotspot and crop.
 */
export async function replaceImageInProject(
  client: SanityClient,
  projectId: string,
  oldAssetId: string,
  newAssetId: string
): Promise<void> {
  await patchPublishedAndDraft(client, projectId, async (docId) => {
    const project = await client.fetch<{ _rev: string; mediaGallery?: GalleryItem[] }>(
      `*[_id == $id][0]{ _rev, mediaGallery[]{ _key, _type, asset, hotspot, crop, image { asset }, videoUrl } }`,
      { id: docId }
    )

    if (!project?.mediaGallery) {
      throw new Error(`Projet introuvable ou sans galerie média (${docId}).`)
    }

    const idx = project.mediaGallery.findIndex(
      (item) => getGalleryItemAssetRef(item) === oldAssetId
    )

    if (idx === -1) {
      throw new Error(`Image source introuvable dans la galerie du projet.`)
    }

    const item = project.mediaGallery[idx]
    const assetPath = getGalleryItemAssetPath(item)

    await client
      .patch(docId)
      .ifRevisionId(project._rev)
      .set({ [`mediaGallery[_key=="${item._key}"].${assetPath}`]: newAssetId })
      .commit()
  })
}

// ---------------------------------------------------------------------------
// Filename helpers
// ---------------------------------------------------------------------------

/**
 * Revert a processed image back to its original.
 *
 * 1. Reads the `description` field of the processed asset to extract the
 *    original asset ID (format: "Source: <id> — Mode: <mode>").
 * 2. Finds any project whose `mediaGallery` references the processed asset.
 * 3. Swaps the reference back to the original asset.
 * 4. Deletes the processed asset.
 */
export async function revertProcessedImage(
  client: SanityClient,
  processedAssetId: string
): Promise<{ originalAssetId: string; revertedProjects: string[] }> {
  // Fetch the processed asset to extract the original source ID
  const asset = await client.fetch<{ description?: string; label?: string }>(
    `*[_id == $id][0]{ description, label }`,
    { id: processedAssetId }
  )

  if (!asset) {
    throw new Error(`Image traitée introuvable (${processedAssetId}).`)
  }

  // Extract original asset ID from description "Source: <id> — Mode: <mode>"
  const match = asset.description?.match(/Source:\s*(\S+)/)
  if (!match?.[1]) {
    throw new Error(
      `Impossible de trouver l'image originale : le champ description ne contient pas de référence source.`
    )
  }
  const originalAssetId = match[1]

  // Verify the original asset still exists
  const originalExists = await client.fetch<boolean>(`defined(*[_id == $id][0]._id)`, {
    id: originalAssetId,
  })
  if (!originalExists) {
    throw new Error(`L'image originale (${originalAssetId}) n'existe plus dans Sanity.`)
  }

  // Find all projects referencing the processed asset in their gallery
  const projects = await client.fetch<
    Array<{ _id: string; _rev: string; mediaGallery: GalleryItem[] }>
  >(
    `*[_type == "project" && ($ref in mediaGallery[].asset._ref || $ref in mediaGallery[].image.asset._ref)]{
      _id, _rev, mediaGallery[]{ _key, _type, asset, hotspot, crop, image { asset }, videoUrl }
    }`,
    { ref: processedAssetId }
  )

  // Swap references back to original in each project
  const revertedProjects: string[] = []
  for (const project of projects) {
    for (const item of project.mediaGallery) {
      if (getGalleryItemAssetRef(item) === processedAssetId) {
        const assetPath = getGalleryItemAssetPath(item)
        await client
          .patch(project._id)
          .ifRevisionId(project._rev)
          .set({ [`mediaGallery[_key=="${item._key}"].${assetPath}`]: originalAssetId })
          .commit()
        revertedProjects.push(project._id)
        break
      }
    }
  }

  // Delete the processed asset
  await client.delete(processedAssetId)

  // Ensure the original asset has no processing labels
  await client.patch(originalAssetId).unset(['label', 'description']).commit()

  return { originalAssetId, revertedProjects }
}

// ---------------------------------------------------------------------------
// Filename helpers (continued)
// ---------------------------------------------------------------------------

/**
 * Generate a filename for a processed image.
 * Uses the actual output mimeType to determine extension.
 */
export function makeProcessedFilename(
  originalFilename: string | undefined,
  mode: string,
  mimeType?: string
): string {
  const base = originalFilename?.replace(/\.[^.]+$/, '') ?? 'image'
  const ext = mimeType?.includes('png') ? 'png' : 'jpg'
  return `${base}-${mode}-${Date.now()}.${ext}`
}

/**
 * Turn a raw asset filename into a human-readable label.
 *
 * Strips extension, replaces hyphens/underscores with spaces,
 * removes trailing timestamps (13-digit numbers) and processing
 * mode suffixes, then title-cases the result.
 *
 * Example: "jardin-paysage-equalize-1709380000000.jpg" → "Jardin Paysage"
 */
export function humanizeFilename(filename: string | undefined): string {
  if (!filename) return 'Sans nom'

  let name = filename
    // Strip extension
    .replace(/\.[^.]+$/, '')
    // Strip trailing timestamp (13-digit epoch)
    .replace(/-\d{13}$/, '')
    // Strip known processing-mode suffixes
    .replace(/-(equalize|cadrage|equalize\+cadrage|auto_correct)$/i, '')

  // Replace separators with spaces
  name = name.replace(/[-_]+/g, ' ').trim()

  if (!name) return 'Sans nom'

  // Title-case
  return name.replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Video helpers
// ---------------------------------------------------------------------------

/**
 * Generate a filename for a generated video.
 */
export function makeVideoFilename(
  originalFilename: string | undefined,
  mimeType = 'video/mp4'
): string {
  const base = originalFilename?.replace(/\.[^.]+$/, '') ?? 'image'
  const ext = mimeType.includes('webm') ? 'webm' : 'mp4'
  return `${base}-vegetation-loop-${Date.now()}.${ext}`
}

/**
 * Upload a base64-encoded video to Sanity as a file asset.
 *
 * @returns The created file asset document ID and its public URL
 */
export async function uploadVideoToSanity(
  client: SanityClient,
  base64Data: string,
  filename: string,
  mimeType = 'video/mp4',
  sourceImageAssetId?: string
): Promise<{ assetId: string; url: string }> {
  const byteChars = atob(base64Data)
  const byteArray = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) {
    byteArray[i] = byteChars.charCodeAt(i)
  }
  const blob = new Blob([byteArray], { type: mimeType })
  const file = new File([blob], filename, { type: mimeType })

  const asset = await client.assets.upload('file', file, {
    filename,
    contentType: mimeType,
  })

  // Tag the file asset so we can query generated videos later
  if (sourceImageAssetId) {
    await client
      .patch(asset._id)
      .set({
        label: 'ai-video',
        description: `Source: ${sourceImageAssetId}`,
      })
      .commit()
  }

  return { assetId: asset._id, url: asset.url }
}

// ---------------------------------------------------------------------------
// Video library
// ---------------------------------------------------------------------------

/**
 * Fetch all AI-generated video file assets with their source image metadata.
 *
 * Videos are identified by `label == "ai-video"` set during upload.
 * The source image asset ID is parsed from the `description` field.
 */
export async function fetchVideoAssets(client: SanityClient): Promise<VideoAsset[]> {
  const raw = await client.fetch<
    Array<{
      _id: string
      url: string
      originalFilename?: string
      _createdAt: string
      description?: string
    }>
  >(
    `*[_type == "sanity.fileAsset" && label == "ai-video"] | order(_createdAt desc) {
      _id, url, originalFilename, _createdAt, description
    }`
  )

  if (!raw || raw.length === 0) return []

  // Extract source image IDs from description "Source: <id>"
  const videos: VideoAsset[] = raw.map((v) => ({
    _id: v._id,
    url: v.url,
    originalFilename: v.originalFilename,
    createdAt: v._createdAt,
    sourceImageId: v.description?.match(/Source:\s*(\S+)/)?.[1] ?? null,
  }))

  // Batch-fetch source image metadata
  const sourceIds = [...new Set(videos.map((v) => v.sourceImageId).filter(Boolean))] as string[]

  if (sourceIds.length > 0) {
    const sources = await client.fetch<
      Array<{ _id: string; url: string; originalFilename?: string }>
    >(`*[_id in $ids]{ _id, url, originalFilename }`, { ids: sourceIds })

    const sourceMap = new Map(sources.map((s) => [s._id, s]))

    for (const video of videos) {
      if (video.sourceImageId) {
        const src = sourceMap.get(video.sourceImageId)
        if (src) {
          video.sourceImageUrl = src.url
          video.sourceImageFilename = src.originalFilename
        }
      }
    }
  }

  return videos
}

/**
 * Attach a video URL to a project gallery item, converting it to a `media` object.
 *
 * Finds the gallery item whose image asset matches `imageAssetId` and replaces it
 * with a `media` object containing both the original image and the video URL.
 */
export async function attachVideoToProject(
  client: SanityClient,
  projectId: string,
  imageAssetId: string,
  videoUrl: string
): Promise<void> {
  await patchPublishedAndDraft(client, projectId, async (docId) => {
    // Fetch the full gallery without field projection to avoid data loss
    // when we replace the entire array for raw→media conversions.
    const project = await client.fetch<{ _rev: string; mediaGallery?: Record<string, unknown>[] }>(
      `*[_id == $id][0]{ _rev, mediaGallery }`,
      { id: docId }
    )

    if (!project?.mediaGallery) {
      throw new Error(`Projet introuvable ou sans galerie média (${docId}).`)
    }

    const idx = project.mediaGallery.findIndex((item) => {
      const ref =
        (item.image as { asset?: { _ref?: string } } | undefined)?.asset?._ref ??
        (item.asset as { _ref?: string } | undefined)?._ref
      return ref === imageAssetId
    })

    if (idx === -1) {
      throw new Error(`Image source introuvable dans la galerie du projet.`)
    }

    const item = project.mediaGallery[idx]

    // Already a media object — just set the videoUrl on this item
    if (item._type === 'media') {
      await client
        .patch(docId)
        .ifRevisionId(project._rev)
        .set({ [`mediaGallery[_key=="${item._key}"].videoUrl`]: videoUrl })
        .commit()
      return
    }

    // Raw image item — convert to media object, preserving ALL original fields
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _type, asset, hotspot, crop, ...rest } = item
    const mediaItem = {
      ...rest, // _key + any extra fields preserved
      _type: 'media',
      image: {
        _type: 'image',
        asset,
        ...(hotspot ? { hotspot } : {}),
        ...(crop ? { crop } : {}),
      },
      videoUrl,
    }

    const gallery = [...project.mediaGallery]
    gallery[idx] = mediaItem

    await client.patch(docId).ifRevisionId(project._rev).set({ mediaGallery: gallery }).commit()
  })
}

// ---------------------------------------------------------------------------
// Video detection & revert for a single image asset
// ---------------------------------------------------------------------------

/**
 * Check whether a generated video exists for a given image asset.
 *
 * Videos are `sanity.fileAsset` docs with `label == "ai-video"` and
 * `description` containing `Source: <imageAssetId>`.
 */
export async function fetchVideoForImageAsset(
  client: SanityClient,
  imageAssetId: string
): Promise<VideoInfo | null> {
  return client.fetch<VideoInfo | null>(
    `*[_type == "sanity.fileAsset" && label == "ai-video" && description match $pattern][0]{
      _id, url, originalFilename
    }`,
    { pattern: `Source: ${imageAssetId}*` }
  )
}

/**
 * Remove a generated video for a given image asset.
 *
 * 1. Finds the video file asset via `fetchVideoForImageAsset`.
 * 2. Unsets `videoUrl` from every project gallery item that references
 *    `imageAssetId` and has a `videoUrl` set.
 * 3. Deletes the video file asset.
 */
export async function revertVideo(
  client: SanityClient,
  imageAssetId: string
): Promise<{ deletedVideoId: string }> {
  const video = await fetchVideoForImageAsset(client, imageAssetId)
  if (!video) {
    throw new Error('Aucune vidéo trouvée pour cette image.')
  }

  // Find projects referencing this image that have a videoUrl
  const projects = await client.fetch<
    Array<{ _id: string; _rev: string; mediaGallery: GalleryItem[] }>
  >(
    `*[_type == "project" && ($ref in mediaGallery[].asset._ref || $ref in mediaGallery[].image.asset._ref)]{
      _id, _rev, mediaGallery[]{ _key, _type, asset, image { asset }, videoUrl }
    }`,
    { ref: imageAssetId }
  )

  // Unset videoUrl from matching gallery items (published + draft)
  for (const project of projects) {
    for (const item of project.mediaGallery) {
      if (getGalleryItemAssetRef(item) === imageAssetId && item.videoUrl) {
        await patchPublishedAndDraft(client, project._id, async (docId) => {
          await client
            .patch(docId)
            .unset([`mediaGallery[_key=="${item._key}"].videoUrl`])
            .commit()
        })
        break
      }
    }
  }

  // Delete the video file asset
  await client.delete(video._id)

  return { deletedVideoId: video._id }
}
