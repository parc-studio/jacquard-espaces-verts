/**
 * Gemini API client wrapper for browser-side image processing.
 *
 * Uses @google/genai SDK which works identically in browser and Node.
 * The API key is read from the SANITY_STUDIO_GEMINI_API_KEY env var,
 * which Vite exposes to the browser at build time.
 */

import { GoogleGenAI } from '@google/genai'

import type { ProcessingMode, ProcessingResult } from './types'
import { PROMPTS } from './prompts'

/** Model to use for image editing (supports image output) */
const MODEL = 'gemini-2.5-flash'

let _client: GoogleGenAI | null = null

/** Get or create the Gemini client. Throws if API key is missing. */
function getClient(): GoogleGenAI {
  if (_client) return _client

  const apiKey = import.meta.env.SANITY_STUDIO_GEMINI_API_KEY as string | undefined
  if (!apiKey) {
    throw new Error(
      'Clé API Gemini manquante. Ajoutez SANITY_STUDIO_GEMINI_API_KEY dans votre fichier .env.'
    )
  }

  _client = new GoogleGenAI({ apiKey })
  return _client
}

/** Check whether the Gemini API key is configured */
export function isGeminiConfigured(): boolean {
  return !!import.meta.env.SANITY_STUDIO_GEMINI_API_KEY
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
