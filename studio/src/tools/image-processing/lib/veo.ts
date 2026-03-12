/**
 * VEO video generation via Vertex AI.
 *
 * Uses the image-to-video endpoint (predictLongRunning) with the
 * veo-3.1-fast-generate-001 model. The API is async: we submit a
 * generation request, then poll until the video is ready.
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

const VEO_MODEL = 'veo-3.1-fast-generate-001'
const POLL_INTERVAL_MS = 10_000
const MAX_POLL_DURATION_MS = 600_000

// ---------------------------------------------------------------------------
// Prompt — hardcoded vegetation-breeze loop
// ---------------------------------------------------------------------------

const VEO_PROMPT = `Use the reference image ONLY as the base.
Keep exactly the same composition, framing, lighting, color grading.
The camera must be 100% locked: no pan, no zoom, no shake, no reframing.

HARD STATIC MASK (NON-VEGETATION MUST NOT MOVE):
Treat all non-vegetation areas as a frozen still photo.
Every pixel that is not vegetation must be IDENTICAL in every frame:

Architecture: buildings, walls, windows, doors, balconies, signs, fences, benches, pavement, roads.
Humans: bodies, faces, hair, clothes, bags, shadows and reflections of people.
Vehicles: cars, buses, bikes, scooters, wheels, lights, mirrors, reflections on metal and glass.
Sky and environment: sky, clouds, sun, fog, haze, birds, wires, streetlights.
Other elements: water, fountains, reflections in windows, shop fronts, street furniture.

There must be ZERO motion and ZERO flicker in these areas from first to last frame.
Do not change global lighting, exposure, color balance or shadows over time.

ANIMATION (ONLY VEGETATION):
Animate ONLY the vegetation in the scene:
tree leaves and branches
bushes
hedges
grass
climbing plants and any visible green plants

Add a gentle breeze: movement is clearly visible but moderate (no storm, no fast wind).
Leaves and branches sway softly, then come back toward their original position.

PERFECT LOOP:
Duration: about 3–5 seconds.
The first and last frame must be visually identical.
The plant motion must be cyclical and seamless, with no popping, no jump, no sudden reset.

DO NOT:
Do not move humans at all (no blinking, no breathing, no micro movement).
Do not move vehicles at all (no wheel rotation, no body movement, no light change).
Do not move water or reflections.
Do not move buildings, roads, sky, clouds or shadows.
Do not add particles, dust, rain, snow, birds, lens flares or any new elements.

Output: one seamless looping video where ONLY trees and plants move in a gentle breeze and everything else remains perfectly frozen like a still photograph`

// ---------------------------------------------------------------------------
// Submit — image-to-video generation request
// ---------------------------------------------------------------------------

async function submitVideoGeneration(
  imageBase64: string,
  imageMimeType: string,
  config: GcpConfig
): Promise<string> {
  const token = await getAccessToken(config)

  const url =
    `https://${config.region}-aiplatform.googleapis.com/v1` +
    `/projects/${config.projectId}/locations/${config.region}` +
    `/publishers/google/models/${VEO_MODEL}:predictLongRunning`

  const payload = {
    instances: [
      {
        prompt: VEO_PROMPT,
        image: {
          bytesBase64Encoded: imageBase64,
          mimeType: imageMimeType,
        },
      },
    ],
    parameters: {
      aspectRatio: '16:9',
      durationSeconds: 4,
      sampleCount: 1,
      generateAudio: false,
      personGeneration: 'dont_allow',
    },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    throw new Error(
      `Échec de la soumission VEO (${response.status} ${response.statusText}). ` +
        `Vérifiez que le modèle "${VEO_MODEL}" est disponible dans la région ${config.region}. ` +
        `Détails : ${errBody.slice(0, 300)}`
    )
  }

  const data: { name?: string } = await response.json()
  if (!data.name) {
    throw new Error('La réponse VEO ne contient pas de nom d\u2019opération.')
  }

  return data.name
}

// ---------------------------------------------------------------------------
// Poll — wait for the long-running operation to complete
// ---------------------------------------------------------------------------

interface VeoVideoEntry {
  bytesBase64Encoded?: string
  gcsUri?: string
  mimeType?: string
}

interface VeoPollResponse {
  name: string
  done?: boolean
  response?: {
    videos?: VeoVideoEntry[]
    raiMediaFilteredCount?: number
    raiMediaFilteredReasons?: string[]
  }
  error?: { message?: string; code?: number }
}

function formatElapsed(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}min ${rem}s` : `${m}min`
}

async function pollVideoOperation(
  operationName: string,
  config: GcpConfig,
  options?: { signal?: AbortSignal; onProgress?: (status: string) => void }
): Promise<{ base64: string; mimeType: string }> {
  const token = await getAccessToken(config)
  const startTime = Date.now()

  // Extract model path from operationName for the fetchPredictOperation endpoint
  // operationName format: "projects/.../models/MODEL_ID/operations/OP_ID"
  const modelPath = operationName.replace(/\/operations\/.*$/, '')

  const url =
    `https://${config.region}-aiplatform.googleapis.com/v1` + `/${modelPath}:fetchPredictOperation`

  while (true) {
    if (options?.signal?.aborted) {
      throw new Error('Génération annulée.')
    }

    const elapsed = Date.now() - startTime
    if (elapsed > MAX_POLL_DURATION_MS) {
      throw new Error(
        `Délai d\u2019attente dépassé (${formatElapsed(MAX_POLL_DURATION_MS)}). ` +
          'La génération vidéo prend plus de temps que prévu.'
      )
    }

    options?.onProgress?.(`Génération en cours… ${formatElapsed(elapsed)}`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ operationName }),
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      throw new Error(
        `Erreur lors du polling VEO (${response.status}). Détails : ${errBody.slice(0, 300)}`
      )
    }

    const data: VeoPollResponse = await response.json()

    if (data.error) {
      throw new Error(`Erreur VEO : ${data.error.message ?? `Code ${data.error.code}`}`)
    }

    if (data.done) {
      const filtered = data.response?.raiMediaFilteredCount ?? 0
      if (filtered > 0) {
        const reasons =
          data.response?.raiMediaFilteredReasons?.join(', ') ?? 'politique IA responsable'
        throw new Error(
          `La vidéo a été filtrée par les politiques de sécurité de Google (${reasons}). ` +
            'Essayez avec une autre image.'
        )
      }

      const video = data.response?.videos?.[0]
      if (!video?.bytesBase64Encoded) {
        throw new Error(
          'La réponse VEO ne contient pas de données vidéo. ' +
            'Vérifiez que storageUri n\u2019est pas configuré.'
        )
      }

      return {
        base64: video.bytesBase64Encoded,
        mimeType: video.mimeType ?? 'video/mp4',
      }
    }

    // Wait before next poll
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, POLL_INTERVAL_MS)
      if (options?.signal) {
        const onAbort = () => {
          clearTimeout(timer)
          reject(new Error('Génération annulée.'))
        }
        if (options.signal.aborted) {
          clearTimeout(timer)
          reject(new Error('Génération annulée.'))
          return
        }
        options.signal.addEventListener('abort', onAbort, { once: true })
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a short looping video from an image using VEO (Vertex AI).
 *
 * The image is sent to VEO with a hardcoded vegetation-breeze prompt.
 * The function handles the full async flow: submit → poll → return result.
 *
 * @param imageUrl - Sanity CDN URL of the source image
 * @param config - GCP credentials
 * @param options.signal - AbortSignal for cancellation
 * @param options.onProgress - Called with status text during polling
 */
export async function generateVideoFromImage(
  imageUrl: string,
  config: GcpConfig,
  options?: { signal?: AbortSignal; onProgress?: (status: string) => void }
): Promise<ProcessingResult> {
  // Step 1: Fetch source image as base64
  options?.onProgress?.('Préparation de l\u2019image…')
  const rawImg = await fetchImageAsBase64(imageUrl)

  if (options?.signal?.aborted) {
    throw new Error('Génération annulée.')
  }

  // Step 2: Submit to VEO
  options?.onProgress?.('Soumission de la requête VEO…')
  const operationName = await submitVideoGeneration(rawImg.base64, rawImg.mimeType, config)

  // Step 3: Poll until complete
  const video = await pollVideoOperation(operationName, config, options)

  return {
    base64Data: video.base64,
    mimeType: video.mimeType,
    feedback: 'Vidéo générée avec succès (4s, 16:9, brise végétale)',
  }
}
