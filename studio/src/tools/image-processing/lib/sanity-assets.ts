/**
 * Sanity asset helpers for the image processing tool.
 *
 * - Fetches image data from Sanity CDN as base64
 * - Uploads processed images back to Sanity as new assets
 */

import type { SanityClient } from 'sanity'

import type { ProjectWithImages, SanityImageAsset } from './types'

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
 * Upload a base64-encoded image to Sanity as a new asset.
 *
 * @param client - Authenticated Sanity client
 * @param base64Data - Raw base64 image data (no data URI prefix)
 * @param mimeType - MIME type of the image
 * @param filename - Desired filename for the asset
 * @returns The created asset document ID
 */
export async function uploadProcessedImage(
  client: SanityClient,
  base64Data: string,
  mimeType: string,
  filename: string
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

  return asset._id
}

/**
 * Generate a filename for a processed image.
 */
export function makeProcessedFilename(originalFilename: string | undefined, mode: string): string {
  const base = originalFilename?.replace(/\.[^.]+$/, '') ?? 'image'
  const ext = mode === 'equalize' ? 'jpg' : 'jpg'
  return `${base}-${mode}-${Date.now()}.${ext}`
}
