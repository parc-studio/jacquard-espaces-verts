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

/**
 * Fetch all projects that have images in their media gallery.
 */
export async function fetchProjectsWithImages(client: SanityClient): Promise<ProjectWithImages[]> {
  const query = `*[_type == "project" && defined(mediaGallery)] | order(titre asc) {
    _id,
    titre,
    localisation,
    "images": mediaGallery[].asset->{
      _id,
      url,
      originalFilename,
      mimeType,
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
  // Filter out projects with no resolved images
  return results.filter((p) => p.images?.length > 0)
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
 * We fetch the original image (no CDN transforms) to preserve maximum quality.
 */
export async function fetchImageAsBase64(
  imageUrl: string
): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(imageUrl)
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
  mode?: ProcessingMode | 'equalize+cadrage'
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

  // Tag the asset as AI-processed for easy filtering in the media library
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
  // Normalise IDs (strip "image-" prefix if present — Sanity refs use the raw ID)
  const oldRef = oldAssetId.replace(/^image-/, '')
  const newRef = newAssetId.replace(/^image-/, '')

  const project = await client.fetch<{ _rev: string; mediaGallery?: GalleryItem[] }>(
    `*[_id == $id][0]{ _rev, mediaGallery[]{ _key, _type, asset, hotspot, crop } }`,
    { id: projectId }
  )

  if (!project?.mediaGallery) {
    throw new Error(`Projet introuvable ou sans galerie média (${projectId}).`)
  }

  const idx = project.mediaGallery.findIndex((item) => {
    const ref = item.asset?._ref ?? ''
    return ref === oldRef || ref === oldAssetId
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
    .replace(/-(equalize|cadrage|equalize\+cadrage)$/i, '')

  // Replace separators with spaces
  name = name.replace(/[-_]+/g, ' ').trim()

  if (!name) return 'Sans nom'

  // Title-case
  return name.replace(/\b\w/g, (c) => c.toUpperCase())
}
