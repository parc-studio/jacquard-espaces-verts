/**
 * Kling video generation client for the Studio.
 *
 * The Studio talks to the Astro API route directly. The frontend server holds
 * the Kling credentials, performs the async polling, and returns a normalized
 * processing result for the existing Studio review/upload flow.
 */

import { LOCAL_URL, SITE_URL } from '../../../../constants'

import type { ProcessingResult } from './types'

const LOCAL_PROXY_BASE_URLS = [LOCAL_URL, 'http://localhost:4322'] as const
const POLL_INTERVAL_MS = 5_000
const MAX_POLL_DURATION_MS = 900_000

type KlingTaskStatus = 'submitted' | 'processing' | 'succeed' | 'failed'

interface KlingCreateTaskResponse {
  taskId: string
  taskStatus: KlingTaskStatus
  feedback?: string
}

type KlingPollTaskResponse =
  | (ProcessingResult & {
      taskId: string
      taskStatus: 'succeed'
      feedback?: string
    })
  | {
      taskId: string
      taskStatus: 'submitted' | 'processing'
      feedback?: string
    }
  | {
      taskId: string
      taskStatus: 'failed'
      error: string
    }

function getProxyBaseUrls(): string[] {
  if (typeof window === 'undefined') {
    return [SITE_URL]
  }

  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return [...new Set(LOCAL_PROXY_BASE_URLS)]
  }

  return [SITE_URL]
}

function isLikelyNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error && /failed to fetch|networkerror|load failed/i.test(error.message))
  )
}

function formatElapsed(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return remainingSeconds > 0 ? `${minutes}min ${remainingSeconds}s` : `${minutes}min`
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)

    if (!signal) {
      return
    }

    if (signal.aborted) {
      clearTimeout(timer)
      reject(new Error('Génération annulée.'))
      return
    }

    const onAbort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      reject(new Error('Génération annulée.'))
    }

    signal.addEventListener('abort', onAbort, { once: true })
  })
}

async function createVideoTask(
  proxyBaseUrl: string,
  imageUrl: string,
  signal?: AbortSignal
): Promise<KlingCreateTaskResponse> {
  const response = await fetch(`${proxyBaseUrl}/api/kling/video`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imageUrl }),
  })

  const payload = (await response.json().catch(() => null)) as
    | (KlingCreateTaskResponse & { error?: never })
    | { error?: string }
    | null

  if (!response.ok) {
    throw new Error(
      payload && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Erreur lors de l’appel au proxy Kling (${response.status}).`
    )
  }

  if (!payload || !('taskId' in payload) || typeof payload.taskId !== 'string') {
    throw new Error('Réponse invalide renvoyée par le proxy Kling lors de la création de tâche.')
  }

  return payload
}

async function pollVideoTask(
  proxyBaseUrls: string[],
  taskId: string,
  options?: { signal?: AbortSignal; onProgress?: (status: string) => void }
): Promise<ProcessingResult> {
  const startTime = Date.now()
  let activeProxyIndex = 0

  while (true) {
    const elapsed = Date.now() - startTime
    if (elapsed > MAX_POLL_DURATION_MS) {
      throw new Error(
        `Délai d'attente dépassé (${formatElapsed(MAX_POLL_DURATION_MS)}). La génération vidéo prend plus de temps que prévu.`
      )
    }

    const proxyBaseUrl = proxyBaseUrls[activeProxyIndex]

    try {
      const response = await fetch(
        `${proxyBaseUrl}/api/kling/video?taskId=${encodeURIComponent(taskId)}`,
        {
          method: 'GET',
          signal: options?.signal,
        }
      )

      const payload = (await response.json().catch(() => null)) as
        | (KlingPollTaskResponse & { error?: never })
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(
          payload && 'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : `Erreur lors du suivi de la tâche Kling (${response.status}).`
        )
      }

      if (!payload || !('taskStatus' in payload) || typeof payload.taskStatus !== 'string') {
        throw new Error('Réponse invalide renvoyée par le proxy Kling lors du suivi de tâche.')
      }

      if (payload.taskStatus === 'succeed') {
        if (!('base64Data' in payload) || !('mimeType' in payload)) {
          throw new Error('Réponse invalide renvoyée par le proxy Kling.')
        }

        return payload
      }

      options?.onProgress?.(
        payload.feedback || `Génération vidéo Kling en cours… (${formatElapsed(elapsed)})`
      )
      await sleep(POLL_INTERVAL_MS, options?.signal)
    } catch (error) {
      if (isLikelyNetworkError(error) && activeProxyIndex < proxyBaseUrls.length - 1) {
        const failedProxyBaseUrl = proxyBaseUrl
        activeProxyIndex += 1
        options?.onProgress?.(
          `Proxy vidéo indisponible sur ${failedProxyBaseUrl}, essai sur ${proxyBaseUrls[activeProxyIndex]}…`
        )
        continue
      }

      throw error
    }
  }
}

export async function generateVideoFromImage(
  imageUrl: string,
  options?: { signal?: AbortSignal; onProgress?: (status: string) => void }
): Promise<ProcessingResult> {
  const proxyBaseUrls = getProxyBaseUrls()
  let lastNetworkError: Error | null = null

  for (const [index, proxyBaseUrl] of proxyBaseUrls.entries()) {
    const isRetry = index > 0
    options?.onProgress?.(
      isRetry
        ? `Proxy vidéo indisponible sur ${proxyBaseUrls[index - 1]}, essai sur ${proxyBaseUrl}…`
        : 'Soumission de la tâche vidéo Kling…'
    )

    try {
      const payload = await createVideoTask(proxyBaseUrl, imageUrl, options?.signal)

      options?.onProgress?.(payload.feedback || 'Tâche vidéo Kling créée. Vérification en cours…')

      return await pollVideoTask(proxyBaseUrls.slice(index), payload.taskId, options)
    } catch (error) {
      if (isLikelyNetworkError(error) && index < proxyBaseUrls.length - 1) {
        lastNetworkError = error instanceof Error ? error : new Error('Échec réseau inconnu.')
        continue
      }

      throw error
    }
  }

  throw new Error(
    lastNetworkError?.message ||
      'Impossible de joindre le proxy Kling local. Vérifiez que le frontend tourne sur http://localhost:4321 ou http://localhost:4322.'
  )
}
