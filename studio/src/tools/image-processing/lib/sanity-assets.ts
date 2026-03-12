/**
 * Sanity asset helpers for the image processing tool.
 *
 * - Fetches image data from Sanity CDN as base64
 * - Uploads processed images back to Sanity as new assets
 * - Replaces image references in project documents
 * - Tags AI-processed assets with metadata
 */

import type { SanityClient } from 'sanity'

import type { ProcessingMode, ProjectWithImages, SanityImageAsset } from './types'

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
    "images": mediaGallery[].asset->{
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
  asset: { _ref: string; _type: string }
  hotspot?: unknown
  crop?: unknown
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
  const oldRef = oldAssetId
  const newRef = newAssetId

  const project = await client.fetch<{ _rev: string; mediaGallery?: GalleryItem[] }>(
    `*[_id == $id][0]{ _rev, mediaGallery[]{ _key, _type, asset, hotspot, crop } }`,
    { id: projectId }
  )

  if (!project?.mediaGallery) {
    throw new Error(`Projet introuvable ou sans galerie média (${projectId}).`)
  }

  const idx = project.mediaGallery.findIndex((item) => {
    const ref = item.asset?._ref ?? ''
    return ref === oldRef
  })

  if (idx === -1) {
    throw new Error(`Image source introuvable dans la galerie du projet.`)
  }

  // Build the patch path — e.g. mediaGallery[_key=="abc"].asset._ref
  const key = project.mediaGallery[idx]._key

  await client
    .patch(projectId)
    .ifRevisionId(project._rev)
    .set({ [`mediaGallery[_key=="${key}"].asset._ref`]: newRef })
    .commit()
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
    `*[_type == "project" && $ref in mediaGallery[].asset._ref]{
      _id, _rev, mediaGallery[]{ _key, _type, asset, hotspot, crop }
    }`,
    { ref: processedAssetId }
  )

  // Swap references back to original in each project
  const revertedProjects: string[] = []
  for (const project of projects) {
    for (const item of project.mediaGallery) {
      if (item.asset?._ref === processedAssetId) {
        await client
          .patch(project._id)
          .ifRevisionId(project._rev)
          .set({ [`mediaGallery[_key=="${item._key}"].asset._ref`]: originalAssetId })
          .commit()
        revertedProjects.push(project._id)
        break
      }
    }
  }

  // Delete the processed asset
  await client.delete(processedAssetId)

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
export function makeVideoFilename(originalFilename: string | undefined): string {
  const base = originalFilename?.replace(/\.[^.]+$/, '') ?? 'image'
  return `${base}-vegetation-loop-${Date.now()}.mp4`
}

/**
 * Upload a base64-encoded video to Sanity as a file asset.
 *
 * @returns The created file asset document ID
 */
export async function uploadVideoToSanity(
  client: SanityClient,
  base64Data: string,
  filename: string
): Promise<string> {
  const byteChars = atob(base64Data)
  const byteArray = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) {
    byteArray[i] = byteChars.charCodeAt(i)
  }
  const blob = new Blob([byteArray], { type: 'video/mp4' })
  const file = new File([blob], filename, { type: 'video/mp4' })

  const asset = await client.assets.upload('file', file, {
    filename,
    contentType: 'video/mp4',
  })

  return asset._id
}
