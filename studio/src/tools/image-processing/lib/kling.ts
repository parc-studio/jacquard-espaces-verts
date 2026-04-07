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
        : 'Appel du service vidéo Kling…'
    )

    try {
      const response = await fetch(`${proxyBaseUrl}/api/kling/video`, {
        method: 'POST',
        signal: options?.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl }),
      })

      const payload = (await response.json().catch(() => null)) as
        | (ProcessingResult & { error?: never })
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(
          payload && 'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : `Erreur lors de l’appel au proxy Kling (${response.status}).`
        )
      }

      if (!payload || !('base64Data' in payload) || !('mimeType' in payload)) {
        throw new Error('Réponse invalide renvoyée par le proxy Kling.')
      }

      return payload
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
