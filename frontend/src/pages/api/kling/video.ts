export const prerender = false

import type { APIRoute } from 'astro'
import { KLING_ACCESS_KEY, KLING_SECRET_KEY } from 'astro:env/server'

import { siteUrl, studioUrl } from '@/utils/sanity/client'

const KLING_API_BASE_URL = 'https://api-singapore.klingai.com'
const MAX_SUBMIT_RETRIES = 3
const RETRYABLE_ERROR_CODES = new Set([1302, 1303])
const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}

const ALLOWED_ORIGINS = new Set([
  'http://localhost:3333',
  'http://localhost:3334',
  siteUrl,
  studioUrl,
  'https://jacquard-espaces-verts.sanity.studio',
])

const FIXED_VIDEO_OPTIONS = {
  modelName: 'kling-v3',
  durationSeconds: 6,
  mode: 'pro',
  prompt:
    'Gentle breeze animates all vegetation throughout the scene. Leaves rustle softly, branches sway back and forth, grass ripples in waves. Wind affects every plant equally across all depths - foreground, midground, and background. Everything else remains perfectly still. Seamless cinemagraph loop.',
  negativePrompt:
    'camera movement, pan, tilt, zoom, shake, dolly, tracking shot, people, human, pedestrian, crowd, moving objects, moving vehicles, moving cars, moving animals, birds, moving clouds, changing lights, shifting shadows, artifacts, distortion, text',
} as const

interface KlingApiResponse<T> {
  code: number
  message: string
  request_id: string
  data: T
}

type KlingTaskStatus = 'submitted' | 'processing' | 'succeed' | 'failed'

interface KlingVideoCreateResponse {
  task_id?: string
  task_status?: KlingTaskStatus
}

interface KlingVideoTaskResponse {
  task_id?: string
  task_status: KlingTaskStatus
  task_status_msg?: string
  task_result?: {
    videos?: Array<{
      url?: string
      duration?: string
    }>
  }
}

class KlingApiError extends Error {
  code?: number
  status?: number

  constructor(message: string, options?: { code?: number; status?: number }) {
    super(message)
    this.name = 'KlingApiError'
    this.code = options?.code
    this.status = options?.status
  }
}

function isAllowedOrigin(origin: string | null): origin is string {
  return typeof origin === 'string' && ALLOWED_ORIGINS.has(origin)
}

function withCors(origin: string): Headers {
  const headers = new Headers(JSON_HEADERS)
  headers.set('Access-Control-Allow-Origin', origin)
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  headers.set('Access-Control-Max-Age', '600')
  headers.set('Vary', 'Origin')
  return headers
}

function jsonResponse(payload: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: withCors(origin),
  })
}

function bytesToBinaryString(bytes: Uint8Array): string {
  let result = ''
  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    result += String.fromCharCode(...chunk)
  }

  return result
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }

  return btoa(bytesToBinaryString(bytes))
}

function encodeBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function encodeBytesBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function getKlingSourceImageUrl(imageUrl: string): string {
  const separator = imageUrl.includes('?') ? '&' : '?'
  return `${imageUrl}${separator}fm=jpg&q=90&w=2048&fit=max`
}

async function createJwtToken(accessKey: string, secretKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const encoder = new TextEncoder()
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = encodeBase64Url(
    JSON.stringify({
      iss: accessKey,
      exp: now + 1800,
      nbf: now - 5,
    })
  )
  const signingInput = `${header}.${payload}`

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput))
  return `${signingInput}.${encodeBytesBase64Url(new Uint8Array(signature))}`
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let onAbort: (() => void) | null = null

    const cleanup = () => {
      if (onAbort && signal) {
        signal.removeEventListener('abort', onAbort)
      }
    }

    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)

    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer)
        reject(new Error('Génération annulée.'))
        return
      }

      onAbort = () => {
        clearTimeout(timer)
        cleanup()
        reject(new Error('Génération annulée.'))
      }

      signal.addEventListener('abort', onAbort, { once: true })
    }
  })
}

async function readJsonOrThrow<T>(response: Response): Promise<KlingApiResponse<T>> {
  const text = await response.text().catch(() => '')
  let payload: KlingApiResponse<T> | null = null

  if (text) {
    try {
      payload = JSON.parse(text) as KlingApiResponse<T>
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    throw new KlingApiError(
      payload?.message || text || `Erreur Kling (${response.status} ${response.statusText}).`,
      {
        code: payload?.code,
        status: response.status,
      }
    )
  }

  if (!payload) {
    throw new KlingApiError('Réponse Kling invalide ou vide.', { status: response.status })
  }

  if (payload.code !== 0) {
    throw new KlingApiError(payload.message || `Erreur Kling ${payload.code}.`, {
      code: payload.code,
      status: response.status,
    })
  }

  return payload
}

async function fetchKling<T>(
  path: string,
  accessKey: string,
  secretKey: string,
  init: RequestInit,
  signal?: AbortSignal
): Promise<KlingApiResponse<T>> {
  const token = await createJwtToken(accessKey, secretKey)

  const response = await fetch(`${KLING_API_BASE_URL}${path}`, {
    ...init,
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  return readJsonOrThrow<T>(response)
}

async function submitVideoGeneration(
  imageUrl: string,
  accessKey: string,
  secretKey: string,
  signal?: AbortSignal
): Promise<{ taskId: string; taskStatus: KlingTaskStatus }> {
  const sourceImage = getKlingSourceImageUrl(imageUrl)
  const payload = {
    model_name: FIXED_VIDEO_OPTIONS.modelName,
    image: sourceImage,
    image_tail: sourceImage,
    prompt: FIXED_VIDEO_OPTIONS.prompt,
    negative_prompt: FIXED_VIDEO_OPTIONS.negativePrompt,
    duration: String(FIXED_VIDEO_OPTIONS.durationSeconds),
    mode: FIXED_VIDEO_OPTIONS.mode,
    sound: 'off',
    aspect_ratio: '16:9',
  }

  for (let attempt = 1; attempt <= MAX_SUBMIT_RETRIES; attempt++) {
    try {
      const response = await fetchKling<KlingVideoCreateResponse>(
        '/v1/videos/image2video',
        accessKey,
        secretKey,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        signal
      )

      if (!response.data?.task_id) {
        throw new KlingApiError('La réponse Kling ne contient pas de task_id.')
      }

      return {
        taskId: response.data.task_id,
        taskStatus: response.data.task_status ?? 'submitted',
      }
    } catch (error) {
      const klingError = error instanceof KlingApiError ? error : null
      const shouldRetry =
        !!klingError &&
        RETRYABLE_ERROR_CODES.has(klingError.code ?? -1) &&
        attempt < MAX_SUBMIT_RETRIES

      if (!shouldRetry) {
        throw error
      }

      await sleep(1_000 * 2 ** (attempt - 1), signal)
    }
  }

  throw new KlingApiError('Impossible de soumettre la génération vidéo à Kling.')
}

async function getVideoTask(
  taskId: string,
  accessKey: string,
  secretKey: string,
  signal?: AbortSignal
): Promise<KlingVideoTaskResponse> {
  const response = await fetchKling<KlingVideoTaskResponse>(
    `/v1/videos/image2video/${encodeURIComponent(taskId)}`,
    accessKey,
    secretKey,
    { method: 'GET' },
    signal
  )

  if (!response.data?.task_status) {
    throw new KlingApiError('La réponse Kling ne contient pas de task_status.')
  }

  return response.data
}

async function downloadVideoResult(
  videoUrl: string,
  signal?: AbortSignal
): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(videoUrl, { signal })
  if (!response.ok) {
    throw new Error(
      `Impossible de télécharger la vidéo générée par Kling (${response.status} ${response.statusText}).`
    )
  }

  const arrayBuffer = await response.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  return {
    base64: bytesToBase64(bytes),
    mimeType: response.headers.get('content-type') || 'video/mp4',
  }
}

export const OPTIONS: APIRoute = async ({ request }) => {
  const origin = request.headers.get('origin')
  if (!isAllowedOrigin(origin)) {
    return new Response(null, { status: 403, headers: JSON_HEADERS })
  }

  return new Response(null, {
    status: 204,
    headers: withCors(origin),
  })
}

export const GET: APIRoute = async ({ request }) => {
  const origin = request.headers.get('origin')

  if (!isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: 'Origin non autorisée.' }), {
      status: 403,
      headers: JSON_HEADERS,
    })
  }

  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    return jsonResponse({ error: 'Le proxy Kling n’est pas configuré côté frontend.' }, 503, origin)
  }

  const taskId = new URL(request.url).searchParams.get('taskId')?.trim() ?? ''
  if (!taskId) {
    return jsonResponse({ error: 'Le paramètre taskId est requis.' }, 400, origin)
  }

  try {
    const task = await getVideoTask(taskId, KLING_ACCESS_KEY, KLING_SECRET_KEY, request.signal)

    if (task.task_status === 'failed') {
      return jsonResponse(
        {
          error: task.task_status_msg || 'La génération Kling a échoué.',
          taskId,
          taskStatus: task.task_status,
        },
        502,
        origin
      )
    }

    if (task.task_status !== 'succeed') {
      return jsonResponse(
        {
          taskId,
          taskStatus: task.task_status,
          feedback: 'La génération vidéo Kling est en cours.',
        },
        202,
        origin
      )
    }

    const video = task.task_result?.videos?.[0]
    if (!video?.url) {
      return jsonResponse(
        {
          error: 'Kling a terminé la tâche sans fournir d’URL vidéo.',
          taskId,
          taskStatus: task.task_status,
        },
        502,
        origin
      )
    }

    const downloadedVideo = await downloadVideoResult(video.url, request.signal)

    return jsonResponse(
      {
        taskId,
        taskStatus: task.task_status,
        base64Data: downloadedVideo.base64,
        mimeType: downloadedVideo.mimeType,
        feedback:
          'Vidéo générée avec succès via Kling (kling-v3, 6s, qualité pro, boucle contrainte par image de début et de fin identiques).',
      },
      200,
      origin
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erreur inconnue lors de la récupération Kling.'
    const status =
      error instanceof KlingApiError && RETRYABLE_ERROR_CODES.has(error.code ?? -1) ? 429 : 502
    return jsonResponse({ error: message, taskId }, status, origin)
  }
}

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get('origin')

  if (!isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: 'Origin non autorisée.' }), {
      status: 403,
      headers: JSON_HEADERS,
    })
  }

  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    return jsonResponse({ error: 'Le proxy Kling n’est pas configuré côté frontend.' }, 503, origin)
  }

  try {
    const body = await request.json()
    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : ''

    if (!imageUrl) {
      return jsonResponse({ error: 'Le paramètre imageUrl est requis.' }, 400, origin)
    }

    new URL(imageUrl)

    const task = await submitVideoGeneration(
      imageUrl,
      KLING_ACCESS_KEY,
      KLING_SECRET_KEY,
      request.signal
    )

    return jsonResponse(
      {
        taskId: task.taskId,
        taskStatus: task.taskStatus,
        feedback: 'Tâche vidéo Kling créée. Vérification du statut en cours…',
      },
      202,
      origin
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erreur inconnue lors de la génération Kling.'
    const status =
      error instanceof KlingApiError && RETRYABLE_ERROR_CODES.has(error.code ?? -1) ? 429 : 502
    return jsonResponse({ error: message }, status, origin)
  }
}
