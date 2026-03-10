/**
 * Cloudinary API client wrapper for browser-side image processing.
 *
 * Uses direct Cloudinary REST API to upload images, apply transformations,
 * and download the result. Secure credentials are only loaded on localhost.
 */

import type { ProcessingMode, ProcessingResult } from './types'

function isLocalDevelopmentStudio(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

function getCloudinaryConfig() {
  if (!isLocalDevelopmentStudio()) {
    return null
  }

  const cloudName = import.meta.env.SANITY_STUDIO_CLOUDINARY_CLOUD_NAME as string | undefined
  const apiKey = import.meta.env.SANITY_STUDIO_CLOUDINARY_API_KEY as string | undefined
  const apiSecret = import.meta.env.SANITY_STUDIO_CLOUDINARY_API_SECRET as string | undefined

  if (!cloudName || !apiKey || !apiSecret) {
    return null
  }

  return { cloudName, apiKey, apiSecret }
}

/** Check whether Cloudinary config is complete */
export function isCloudinaryConfigured(): boolean {
  return getCloudinaryConfig() !== null
}

async function generateSignature(
  params: Record<string, string>,
  apiSecret: string
): Promise<string> {
  // Sort keys alphabetically
  const sortedKeys = Object.keys(params).sort()

  // Create string to sign: key=value&key2=value2
  const stringToSign = sortedKeys.map((k) => `${k}=${params[k]}`).join('&') + apiSecret

  // Hash with SHA-1 (Web Crypto API)
  const encoder = new TextEncoder()
  const data = encoder.encode(stringToSign)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Process an image using Cloudinary API.
 * Uploads the image, applies transformations, and downloads back the result.
 */
export async function processImage(
  imageBase64: string,
  mimeType: string,
  mode: ProcessingMode
): Promise<ProcessingResult> {
  const config = getCloudinaryConfig()

  if (!config) {
    throw new Error(
      'Le traitement Cloudinary est disponible uniquement en Studio local (localhost) avec SANITY_STUDIO_CLOUDINARY_* définis.'
    )
  }

  // 1. Determine transformations based on mode
  // Lumière (equalize): e_improve,e_auto_color
  // Cadrage (composition): c_auto,g_auto (smart crop/framing)
  const transformation = mode === 'equalize' ? 'e_improve,e_auto_color' : 'c_fill,g_auto' // Cadrage often needs fill with auto gravity, or just c_auto,g_auto. We'll use c_auto,g_auto for best smart framing

  const timestamp = Math.round(Date.now() / 1000).toString()

  const paramsToSign = {
    timestamp,
    transformation,
  }

  const signature = await generateSignature(paramsToSign, config.apiSecret)

  // 2. Upload to Cloudinary with transformations
  const formData = new FormData()
  formData.append('file', `data:${mimeType};base64,${imageBase64}`)
  formData.append('api_key', config.apiKey)
  formData.append('timestamp', timestamp)
  formData.append('signature', signature)
  formData.append('transformation', transformation)

  const uploadUrl = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  })

  if (!uploadResponse.ok) {
    const errorData = await uploadResponse.json().catch(() => ({}))
    throw new Error(`Cloudinary error: ${errorData.error?.message || uploadResponse.statusText}`)
  }

  const uploadResult = await uploadResponse.json()
  const secureUrl = uploadResult.secure_url

  if (!secureUrl) {
    throw new Error('Cloudinary n\u2019a pas retourné d\u2019URL d\u2019image valide.')
  }

  // 3. Download the transposed image to convert it back to Base64
  const downloadResponse = await fetch(secureUrl)
  if (!downloadResponse.ok) {
    throw new Error(`Failed to download processed image: ${downloadResponse.statusText}`)
  }

  const blob = await downloadResponse.blob()
  const resultBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      // FileReader result includes 'data:<mime>;base64,' prefix which we need to strip
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

  return {
    base64Data: resultBase64,
    mimeType: blob.type || 'image/jpeg',
    feedback: `Appliqué le traitement automatique Cloudinary : ${transformation}`,
  }
}

/**
 * Process an image through the full equalize → cadrage chain.
 */
export async function processImageChain(
  imageBase64: string,
  mimeType: string,
  onProgress?: (step: 'equalize-done' | 'cadrage-done', intermediate?: ProcessingResult) => void
): Promise<ProcessingResult> {
  const equalizeResult = await processImage(imageBase64, mimeType, 'equalize')
  onProgress?.('equalize-done', equalizeResult)

  const cadrageResult = await processImage(
    equalizeResult.base64Data,
    equalizeResult.mimeType,
    'cadrage'
  )
  onProgress?.('cadrage-done', cadrageResult)

  return {
    base64Data: cadrageResult.base64Data,
    mimeType: cadrageResult.mimeType,
    feedback: `[Lumière] ${equalizeResult.feedback}\n\n[Cadrage] ${cadrageResult.feedback}`,
  }
}
