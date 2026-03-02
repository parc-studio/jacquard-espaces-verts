/**
 * Gemini API client wrapper for browser-side image processing.
 *
 * Uses @google/genai SDK which works identically in browser and Node.
 * The API key is read from the SANITY_STUDIO_GEMINI_API_KEY env var,
 * which Vite exposes to the browser at build time.
 */

import { GoogleGenAI } from '@google/genai'

import { PROMPTS } from './prompts'
import type { ProcessingMode, ProcessingResult } from './types'

/** Model to use for image editing (supports image output) */
const MODEL = 'gemini-2.5-flash'

let _client: GoogleGenAI | null = null

function isLocalDevelopmentStudio(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

function getGeminiApiKey(): string | null {
  if (!isLocalDevelopmentStudio()) {
    return null
  }

  const apiKey = import.meta.env.SANITY_STUDIO_GEMINI_API_KEY as string | undefined
  return typeof apiKey === 'string' && apiKey.length > 0 ? apiKey : null
}

/** Get or create the Gemini client. Throws if API key is missing. */
function getClient(): GoogleGenAI {
  if (_client) return _client

  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error(
      'Le traitement Gemini est disponible uniquement en Studio local (localhost) avec SANITY_STUDIO_GEMINI_API_KEY défini.'
    )
  }

  _client = new GoogleGenAI({ apiKey })
  return _client
}

/** Check whether the Gemini API key is configured */
export function isGeminiConfigured(): boolean {
  return getGeminiApiKey() !== null
}

/**
 * Process an image using Gemini.
 *
 * @param imageBase64 - Base64-encoded image data (no data URI prefix)
 * @param mimeType - MIME type of the input image (e.g. "image/jpeg")
 * @param mode - Processing mode (equalize or cadrage)
 * @returns Processing result with base64 output image and optional feedback
 */
export async function processImage(
  imageBase64: string,
  mimeType: string,
  mode: ProcessingMode
): Promise<ProcessingResult> {
  const client = getClient()
  const prompt = PROMPTS[mode]

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: imageBase64,
              mimeType,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseModalities: ['image', 'text'],
    },
  })

  // Extract image and text parts from response
  const parts = response.candidates?.[0]?.content?.parts ?? []

  let resultBase64: string | undefined
  let resultMimeType: string | undefined
  let feedback: string | undefined

  for (const part of parts) {
    if (part.inlineData?.data) {
      resultBase64 = part.inlineData.data
      resultMimeType = part.inlineData.mimeType ?? 'image/png'
    } else if (part.text) {
      feedback = part.text
    }
  }

  if (!resultBase64) {
    throw new Error(
      'Gemini n\u2019a pas retourné d\u2019image. ' +
        (feedback ? `Réponse : ${feedback}` : 'Aucune réponse.')
    )
  }

  return {
    base64Data: resultBase64,
    mimeType: resultMimeType ?? 'image/png',
    feedback,
  }
}

/**
 * Process an image through the full equalize → cadrage chain.
 *
 * 1. Runs equalize on the source image.
 * 2. Feeds the equalize result into cadrage.
 * 3. Returns the final cadrage result with combined feedback.
 *
 * A progress callback is invoked between steps so the UI can update.
 */
export async function processImageChain(
  imageBase64: string,
  mimeType: string,
  onProgress?: (step: 'equalize-done' | 'cadrage-done', intermediate?: ProcessingResult) => void
): Promise<ProcessingResult> {
  // Step 1: equalize
  const equalizeResult = await processImage(imageBase64, mimeType, 'equalize')
  onProgress?.('equalize-done', equalizeResult)

  // Step 2: cadrage on the equalized image
  const cadrageResult = await processImage(
    equalizeResult.base64Data,
    equalizeResult.mimeType,
    'cadrage'
  )
  onProgress?.('cadrage-done', cadrageResult)

  // Combine feedback from both steps
  const feedbackParts = [
    equalizeResult.feedback ? `[Lumière] ${equalizeResult.feedback}` : null,
    cadrageResult.feedback ? `[Cadrage] ${cadrageResult.feedback}` : null,
  ].filter(Boolean)

  return {
    base64Data: cadrageResult.base64Data,
    mimeType: cadrageResult.mimeType,
    feedback: feedbackParts.length > 0 ? feedbackParts.join('\n\n') : undefined,
  }
}
