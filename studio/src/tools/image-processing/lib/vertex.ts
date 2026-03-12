/**
 * Hybrid AI-analysis + Canvas-application image processor.
 *
 * 1. Sends the image to Vertex AI (Gemini) for analysis only (text output).
 *    The AI determines optimal correction parameters for the specific image.
 * 2. Applies those parameters deterministically via Canvas 2D.
 *    The AI never modifies pixels — it only prescribes adjustments.
 *
 * Requires GCP service account credentials in .env for the analysis step.
 */

import { fetchImageAsBase64 } from './sanity-assets'
import type { GcpConfig } from './secrets'
import type { ProcessingMode, ProcessingResult } from './types'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ANALYSIS_MODEL = 'gemini-2.5-flash-lite'

// ---------------------------------------------------------------------------
// Self-signed JWT auth (browser Web Crypto API)
// ---------------------------------------------------------------------------

let cachedToken: { token: string; expiresAt: number } | null = null

function base64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function strToBase64url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/g, '')
    .replace(/-----END (RSA )?PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

async function getAccessToken(config: GcpConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expiresAt > now + 300) return cachedToken.token

  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: config.clientEmail,
    sub: config.clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    iat: now,
    exp: now + 3600,
  }

  const headerB64 = strToBase64url(JSON.stringify(header))
  const payloadB64 = strToBase64url(JSON.stringify(payload))
  const signingInput = `${headerB64}.${payloadB64}`

  const key = await importPrivateKey(config.privateKey)
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  )
  const jwt = `${signingInput}.${base64url(sig)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  })

  if (!res.ok) {
    const err: { error_description?: string } = await res.json().catch(() => ({}))
    throw new Error(`Auth GCP échouée: ${err.error_description || res.statusText}`)
  }

  const data: { access_token: string; expires_in: number } = await res.json()
  cachedToken = { token: data.access_token, expiresAt: now + data.expires_in }
  return data.access_token
}

// ---------------------------------------------------------------------------
// AI analysis — Gemini vision → structured correction parameters
// ---------------------------------------------------------------------------

/** Correction parameters the AI prescribes per image. */
interface CorrectionParams {
  exposure: number // [-1, 1]
  contrast: number // [-1, 1]
  highlights: number // [-1, 1]
  shadows: number // [-1, 1]
  temperature: number // [-1, 1] negative = cool, positive = warm
  saturation: number // [-1, 1] negative = desaturate, positive = boost
  levelsClipLow: number // [0, 0.05] — black point clip percentile
  levelsClipHigh: number // [0, 0.05] — white point clip percentile
  straightenAngle: number // [-10, 10] degrees — clockwise rotation to straighten
}

const DEFAULT_PARAMS: CorrectionParams = {
  exposure: -0.06,
  contrast: 0.04,
  highlights: -0.18,
  shadows: 0.03,
  temperature: 0.06,
  saturation: -0.25,
  levelsClipLow: 0.003,
  levelsClipHigh: 0.003,
  straightenAngle: 0,
}

/**
 * Fixed aesthetic parameters — identical for every image.
 * Dark, muted, sepia-toned. Desaturated with a warm brown tint.
 * Only exposure and straightenAngle are determined per-image by the AI.
 */
const FIXED_AESTHETIC: Omit<CorrectionParams, 'exposure' | 'straightenAngle'> = {
  contrast: 0.04,
  highlights: -0.18,
  shadows: 0.03,
  temperature: 0.06,
  saturation: -0.25,
  levelsClipLow: 0.003,
  levelsClipHigh: 0.003,
}

const ANALYSIS_PROMPT = `You are a photo analysis assistant. You receive ONE outdoor/architectural photo.

Your ONLY job is to determine TWO things:
1. EXPOSURE CORRECTION: How much to brighten or darken this specific image so it is correctly exposed. Analyse the overall brightness — is it underexposed (dark), correct, or overexposed (bright)?
2. STRAIGHTEN ANGLE: How many degrees to rotate the image clockwise to make the horizon perfectly level and verticals truly vertical. Look at horizon lines, building edges, fence lines, tree trunks, lamp posts.

EXPOSURE GUIDE:
- Very dark / underexposed → +0.10 to +0.20
- Slightly dark → +0.03 to +0.08
- Correctly exposed → -0.02 to +0.02
- Slightly bright → -0.03 to -0.08
- Overexposed → -0.10 to -0.15

STRAIGHTEN GUIDE:
- Look for the strongest horizontal reference line (horizon, roofline, water surface, path edge).
- Look for vertical reference lines (building corners, door frames, lamp posts, tree trunks).
- A POSITIVE angle rotates clockwise. Use positive if the image tilts left (left side lower).
- A NEGATIVE angle rotates counter-clockwise. Use negative if the image tilts right (right side lower).
- Most photos need between -2.0 and +2.0 degrees. Only exceed this for severely tilted images.
- If the image is already level, use exactly 0.
- Be PRECISE — 0.5 degree matters. Analyse carefully.

Return ONLY a JSON object (no markdown fences):
{
  "comment": string,  // 1-2 sentences: what you observe about exposure and geometry.
  "exposure": float,  // [-0.30, +0.30]
  "straightenAngle": float  // [-10, +10] degrees clockwise
}`

interface AnalysisResult extends CorrectionParams {
  comment: string
}

async function analyzeImage(imageUrl: string, config: GcpConfig): Promise<AnalysisResult> {
  const token = await getAccessToken(config)

  const rawImg = await fetchImageAsBase64(imageUrl)

  const url =
    `https://${config.region}-aiplatform.googleapis.com/v1beta1` +
    `/projects/${config.projectId}/locations/${config.region}` +
    `/publishers/google/models/${ANALYSIS_MODEL}:generateContent`

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: ANALYSIS_PROMPT },
          { inlineData: { mimeType: rawImg.mimeType, data: rawImg.base64 } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
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
    console.warn('AI analysis failed:', response.status, response.statusText, errBody)
    throw new Error(
      `Analyse IA échouée (${response.status} ${response.statusText}). ` +
        `Vérifiez que le modèle "${ANALYSIS_MODEL}" est disponible dans la région ${config.region}. ` +
        `Détails: ${errBody.slice(0, 200)}`
    )
  }

  const result: {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  } = await response.json()

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return { ...DEFAULT_PARAMS, comment: '' }

  try {
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PARAMS, comment: '' }
    const p = parsed as Record<string, unknown>

    // Validate and clamp each parameter
    const num = (key: string, min: number, max: number, fallback: number): number => {
      const v = p[key]
      if (typeof v !== 'number' || !isFinite(v)) return fallback
      return Math.max(min, Math.min(max, v))
    }

    return {
      comment: typeof p.comment === 'string' ? p.comment : '',
      exposure: num('exposure', -0.3, 0.3, DEFAULT_PARAMS.exposure),
      straightenAngle: num('straightenAngle', -10, 10, DEFAULT_PARAMS.straightenAngle),
      // All aesthetic params come from FIXED_AESTHETIC — not from the AI
      ...FIXED_AESTHETIC,
    }
  } catch {
    return { ...DEFAULT_PARAMS, comment: '' }
  }
}

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Impossible de charger l'image: ${url}`))
    img.src = url
  })
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

// ---------------------------------------------------------------------------
// Parameterised pixel corrections
// ---------------------------------------------------------------------------

function percentile(channel: Uint32Array, pct: number, totalPixels: number): number {
  const target = Math.floor(totalPixels * pct)
  let sum = 0
  for (let i = 0; i < 256; i++) {
    sum += channel[i]
    if (sum >= target) return i
  }
  return 255
}

function buildLevelsLut(low: number, high: number): Uint8Array {
  const lut = new Uint8Array(256)
  const range = Math.max(high - low, 1)
  for (let i = 0; i < 256; i++) {
    lut[i] = clamp(Math.round(((i - low) / range) * 255))
  }
  return lut
}

/**
 * Apply AI-prescribed corrections to ImageData.
 *
 * Pipeline (all composed into 3 per-channel LUTs, then a single pixel pass):
 *  1. Auto-levels  — luminance histogram stretch (same LUT for R/G/B → no colour shift)
 *  2. Exposure     — gamma curve
 *  3. White balance — proportional R/B scaling (temp > 0 = warm, < 0 = cool)
 *  4. Tone curve   — shadow lift + highlight recovery + S-curve contrast
 *  5. Saturation   — per-pixel HSL-based boost/cut (preserves luminance)
 */
function applyCorrections(imageData: ImageData, params: CorrectionParams): void {
  const { data } = imageData
  const totalPixels = data.length / 4

  // --- 1. Luminance histogram for auto-levels ---
  const lumHist = new Uint32Array(256)
  for (let i = 0; i < data.length; i += 4) {
    const l = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    lumHist[l]++
  }
  const lowVal = percentile(lumHist, params.levelsClipLow, totalPixels)
  const highVal = percentile(lumHist, 1 - params.levelsClipHigh, totalPixels)
  const levelsLut = buildLevelsLut(lowVal, highVal)

  // --- 2. Exposure (gamma) ---
  const gamma = 1.0 - params.exposure * 0.4
  const gammaLut = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    gammaLut[i] = clamp(Math.round(255 * Math.pow(i / 255, gamma)))
  }

  // --- 3. White balance (proportional R/B scaling) ---
  const rScale = 1.0 + params.temperature * 0.06
  const bScale = 1.0 - params.temperature * 0.08

  // --- 4. Tone curve (shadow lift + highlight recovery + contrast S-curve) ---
  const toneLut = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    let v = i / 255
    // Shadow lift (film-like: raises the black point gently)
    v = v + params.shadows * 0.3 * (1 - v) * (1 - v)
    // Highlight recovery (smooth rolloff)
    v = v + params.highlights * 0.3 * v * v
    // S-curve contrast: gentle, film-like — reduced multiplier
    v = v + params.contrast * 0.1 * Math.sin(Math.PI * v) * (0.5 - Math.abs(v - 0.5))
    toneLut[i] = clamp(Math.round(v * 255))
  }

  // --- Compose into per-channel LUTs: levels → gamma → WB → tone ---
  const rLut = new Uint8Array(256)
  const gLut = new Uint8Array(256)
  const bLut = new Uint8Array(256)

  for (let i = 0; i < 256; i++) {
    const afterGamma = gammaLut[levelsLut[i]]
    rLut[i] = toneLut[clamp(Math.round(afterGamma * rScale))]
    gLut[i] = toneLut[afterGamma]
    bLut[i] = toneLut[clamp(Math.round(afterGamma * bScale))]
  }

  // --- 5. Saturation (HSL-based, preserves luminance) ---
  // Reduced multiplier for film-like muted response. Negative saturation = desaturate.
  const satFactor = 1.0 + params.saturation * 0.8

  // --- Single pass over pixel data ---
  for (let i = 0; i < data.length; i += 4) {
    let r = rLut[data[i]]
    let g = gLut[data[i + 1]]
    let b = bLut[data[i + 2]]

    // Saturation adjustment in linear space (luma-preserving)
    const lum = 0.299 * r + 0.587 * g + 0.114 * b

    // Gentle green desaturation: tame overly vivid greens without
    // shifting hue — Walti’s greens are true/natural, just controlled.
    const maxC = Math.max(r, g, b)
    const greenDominance = maxC > 30 ? Math.max(0, (g - Math.max(r, b)) / maxC) : 0

    // Saturation adjustment (luma-preserving) with extra green taming
    const effectiveSat = satFactor * (1 - greenDominance * 0.25)
    r = clamp(Math.round(lum + (r - lum) * effectiveSat))
    g = clamp(Math.round(lum + (g - lum) * effectiveSat))
    b = clamp(Math.round(lum + (b - lum) * effectiveSat))

    // Sepia tint: blend toward warm brown (112, 96, 78) at ~12% strength
    const sepiaStrength = 0.12
    r = clamp(Math.round(r + (112 - r) * sepiaStrength))
    g = clamp(Math.round(g + (96 - g) * sepiaStrength))
    b = clamp(Math.round(b + (78 - b) * sepiaStrength))

    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
  }
}

// ---------------------------------------------------------------------------
// Orchestrator: analyse → correct → export
// ---------------------------------------------------------------------------

async function processImageHybrid(imageUrl: string, config: GcpConfig): Promise<ProcessingResult> {
  // Step 1: AI analyses the image and prescribes parameters
  const { comment, ...params } = await analyzeImage(imageUrl, config)
  console.log('[Image Processing] AI comment:', comment)
  console.log('[Image Processing] AI params:', JSON.stringify(params, null, 2))

  // Step 2: Load full-resolution image into Canvas (no downscaling)
  const separator = imageUrl.includes('?') ? '&' : '?'
  const srcUrl = `${imageUrl}${separator}fm=png`
  const img = await loadImage(srcUrl)

  const w = img.naturalWidth
  const h = img.naturalHeight

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Impossible de créer le contexte Canvas 2D.')

  // Step 2b: Straighten if needed (rotate + crop to avoid black borders)
  const angle = params.straightenAngle
  if (Math.abs(angle) > 0.05) {
    const rad = (angle * Math.PI) / 180
    const cosA = Math.abs(Math.cos(rad))
    const sinA = Math.abs(Math.sin(rad))

    // Compute the largest axis-aligned rectangle that fits inside the rotated image
    // (no black borders) using the standard inner-crop formula
    const cropW = (w * cosA - h * sinA) / (cosA * cosA - sinA * sinA)
    const cropH = (h * cosA - w * sinA) / (cosA * cosA - sinA * sinA)
    const finalW = Math.max(1, Math.round(Math.min(cropW, w)))
    const finalH = Math.max(1, Math.round(Math.min(cropH, h)))

    // Draw rotated onto a temp canvas at original size, then crop center
    const tmpCanvas = document.createElement('canvas')
    tmpCanvas.width = w
    tmpCanvas.height = h
    const tmpCtx = tmpCanvas.getContext('2d')!
    tmpCtx.translate(w / 2, h / 2)
    tmpCtx.rotate(rad)
    tmpCtx.drawImage(img, -w / 2, -h / 2)

    // Crop to inner rect
    canvas.width = finalW
    canvas.height = finalH
    const sx = Math.round((w - finalW) / 2)
    const sy = Math.round((h - finalH) / 2)
    ctx.drawImage(tmpCanvas, sx, sy, finalW, finalH, 0, 0, finalW, finalH)
  } else {
    canvas.width = w
    canvas.height = h
    ctx.drawImage(img, 0, 0)
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

  // Step 3: Apply AI-prescribed corrections
  applyCorrections(imageData, params)
  ctx.putImageData(imageData, 0, 0)

  // Step 4: Export as high-quality JPEG
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Échec de l'export Canvas."))),
      'image/jpeg',
      0.97
    )
  })

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error('Échec de la conversion base64.'))
    reader.readAsDataURL(blob)
  })

  const parts = [
    `expo=${params.exposure.toFixed(2)}`,
    `contraste=${params.contrast.toFixed(2)}`,
    `HL=${params.highlights.toFixed(2)}`,
    `ombres=${params.shadows.toFixed(2)}`,
    `temp=${params.temperature.toFixed(2)}`,
    `sat=${params.saturation.toFixed(2)}`,
  ]
  if (Math.abs(params.straightenAngle) > 0.05) {
    parts.push(`redressé=${params.straightenAngle.toFixed(1)}°`)
  }
  const paramSummary = parts.join(', ')

  return {
    base64Data: base64,
    mimeType: 'image/jpeg',
    feedback: `Correction IA adaptée (${paramSummary})`,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function processImage(
  imageUrl: string,
  mode: ProcessingMode,
  config: GcpConfig
): Promise<ProcessingResult> {
  if (mode === 'auto_correct') return processImageHybrid(imageUrl, config)
  throw new Error(`Mode non supporté: ${mode as string}`)
}

export async function processImageChain(
  imageUrl: string,
  config: GcpConfig,
  onProgress?: (step: 'analysis-done' | 'correction-done', intermediate?: ProcessingResult) => void
): Promise<ProcessingResult> {
  onProgress?.('analysis-done')
  const result = await processImage(imageUrl, 'auto_correct', config)
  onProgress?.('correction-done')
  return result
}
