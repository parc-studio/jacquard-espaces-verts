/**
 * Scene cleanup via Vertex AI Imagen Edit.
 *
 * Uses imagen-3.0-capability-001 with semantic mask-based inpainting removal
 * to automatically detect and remove humans, vehicles, and animals from a scene.
 *
 * Reuses the same GCP OAuth2 auth from vertex.ts.
 */

import { fetchImageAsBase64 } from './sanity-assets'
import type { GcpConfig } from './secrets'
import type { ProcessingResult } from './types'
import { getAccessToken } from './vertex'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const IMAGEN_EDIT_MODEL = 'imagen-3.0-capability-001'

/**
 * Semantic class IDs to remove from the scene.
 *
 * People:  125 person, 126 rider, 127 bicyclist, 128 motorcyclist
 * Vehicles: 175 bicycle, 176 car, 178 motorcycle, 180 bus, 182 truck, 183 trailer
 * Animals: 6 bird, 7 cat, 8 dog, 16 animal (other)
 */
const SEMANTIC_CLASS_IDS = [125, 126, 127, 128, 175, 176, 178, 180, 182, 183, 6, 7, 8, 16]

const CLEANUP_PROMPT = ''
const CLEANUP_NEGATIVE_PROMPT = 'people, person, animal'
const CLEANUP_GUIDANCE_SCALE = 30

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Remove humans, and animals from a scene image using Imagen Edit.
 *
 * @param imageUrl - URL of the source image (Sanity CDN)
 * @param config - GCP service account configuration
 * @returns ProcessingResult with cleaned base64 image
 */
export async function cleanupSceneImage(
  imageUrl: string,
  config: GcpConfig
): Promise<ProcessingResult> {
  const token = await getAccessToken(config)
  const { base64 } = await fetchImageAsBase64(imageUrl)

  const url =
    `https://${config.region}-aiplatform.googleapis.com/v1` +
    `/projects/${config.projectId}/locations/${config.region}` +
    `/publishers/google/models/${IMAGEN_EDIT_MODEL}:predict`

  const payload = {
    instances: [
      {
        prompt: CLEANUP_PROMPT,
        referenceImages: [
          {
            referenceType: 'REFERENCE_TYPE_RAW',
            referenceId: 1,
            referenceImage: {
              bytesBase64Encoded: base64,
            },
          },
          {
            referenceType: 'REFERENCE_TYPE_MASK',
            referenceId: 2,
            maskImageConfig: {
              maskMode: 'MASK_MODE_SEMANTIC',
              maskClasses: SEMANTIC_CLASS_IDS,
              dilation: 0.01,
            },
          },
        ],
      },
    ],
    parameters: {
      editMode: 'EDIT_MODE_INPAINT_REMOVAL',
      guidanceScale: CLEANUP_GUIDANCE_SCALE,
      negativePrompt: CLEANUP_NEGATIVE_PROMPT,
      sampleCount: 1,
    },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Erreur Imagen Edit (${response.status}): ${errorText}`)
  }

  const data = (await response.json()) as {
    predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>
  }
  const prediction = data.predictions?.[0]

  if (!prediction?.bytesBase64Encoded) {
    throw new Error('Aucune image générée par Imagen Edit.')
  }

  return {
    base64Data: prediction.bytesBase64Encoded,
    mimeType: prediction.mimeType ?? 'image/png',
    feedback:
      'Nettoyage de scène effectué : humains, véhicules et animaux supprimés automatiquement.',
  }
}
