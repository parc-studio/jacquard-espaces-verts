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

const VEO_MODEL = 'veo-3.1-generate-001'
const POLL_INTERVAL_MS = 10_000
const MAX_POLL_DURATION_MS = 600_000

// ---------------------------------------------------------------------------
// Prompt — hardcoded vegetation-breeze loop
// ---------------------------------------------------------------------------

const VEO_PROMPT = `Cinemagraph style video where the first and last frames are identical to create a seamless loop.
Camera: Static shot. The camera is completely fixed.
Subject: ALL trees, leaves, grass, bushes, and green vegetation throughout the ENTIRE scene, equally in the foreground, midground, and far background.
Action: EVERY piece of vegetation in the distance and foreground is swaying noticeably and dynamically in a moderate wind. Leaves are visibly rustling and branches are moving back and forth continuously. The wind affects all plants across the whole image depth.
Scene: The rest of the scene is a perfectly frozen photograph. Remove all humans, pedestrians, and people from the scene entirely. If they cannot be completely removed, they must be perfectly frozen statues with zero movement. Buildings, roads, vehicles, water, reflections, and the sky are also perfectly motionless.`

const VEO_NEGATIVE_PROMPT = `camera movement, pan, tilt, zoom, shake, dolly, tracking shot, people, human, pedestrian, crowd, moving objects, moving vehicles, moving cars, moving animals, birds, moving clouds, changing lights, shifting shadows, artifacts, distortion, text`

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
        negativePrompt: VEO_NEGATIVE_PROMPT,
        image: {
          bytesBase64Encoded: imageBase64,
          mimeType: imageMimeType,
        },
        lastFrame: {
          bytesBase64Encoded: imageBase64,
          mimeType: imageMimeType,
        },
      },
    ],
    parameters: {
      aspectRatio: '16:9',
      durationSeconds: 6,
      sampleCount: 1,
      generateAudio: false,
      personGeneration: 'allow_adult',
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

    // Refresh token each iteration — polls can last up to 10 minutes
    const token = await getAccessToken(config)

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
    feedback: 'Vidéo générée avec succès (brise végétale, caméra fixe)',
  }
}
