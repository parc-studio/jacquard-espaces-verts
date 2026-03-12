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
export interface CorrectionParams {
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

export const DEFAULT_PARAMS: CorrectionParams = {
  exposure: -0.06,
  contrast: -0.15,
  highlights: 0.11,
  shadows: 0.29,
  temperature: 0.17,
  saturation: -0.06,
  levelsClipLow: 0.004,
  levelsClipHigh: 0.021,
  straightenAngle: 0,
}

/**
 * Fixed aesthetic parameters — identical for every image.
 * Dark, muted, sepia-toned. Desaturated with a warm brown tint.
 * exposure, straightenAngle, shadows, and highlights are determined per-image by the AI.
 */
export const FIXED_AESTHETIC: Omit<
  CorrectionParams,
  'exposure' | 'straightenAngle' | 'shadows' | 'highlights'
> = {
  contrast: -0.15,
  temperature: 0.17,
  saturation: -0.06,
  levelsClipLow: 0.004,
  levelsClipHigh: 0.021,
}

const ANALYSIS_PROMPT = `You are an image analysis model. You will receive exactly one outdoor or architectural photograph.

Analyse the image and return four numeric values:

## 1. exposure (float, range −0.30 to +0.30)
Determine how much to brighten or darken this image to achieve correct exposure.
- Evaluate the overall luminance distribution: is the image underexposed (too dark), correctly exposed, or overexposed (too bright)?
- Mapping:
  · Severely underexposed  → +0.15 to +0.25
  · Moderately underexposed → +0.05 to +0.12
  · Correctly exposed       → −0.02 to +0.02
  · Moderately overexposed  → −0.05 to −0.10
  · Severely overexposed    → −0.12 to −0.20

## 2. straightenAngle (float, range −10.0 to +10.0, degrees)
Determine the clockwise rotation needed to level the image.
- Identify the dominant horizontal reference: horizon line, roofline, water surface, path edge, fence line.
- Identify vertical references: building corners, door frames, lamp posts, tree trunks.
- Convention: positive = clockwise rotation. If the left side is lower than the right, return a positive value.
- Most images need −2.0 to +2.0 degrees. Exceed this only for clearly tilted images.
- If the image is already level, return exactly 0.
- Precision matters: 0.5° makes a visible difference.

## 3. shadows (float, range −1.0 to +1.0)
Determine how much shadow recovery is needed.
- Evaluate how much detail is lost in the dark areas of the image.
- Mapping:
  · Deep crushed shadows, backlit subject    → +0.30 to +0.50
  · Moderate shadow loss, some detail hidden  → +0.15 to +0.30
  · Balanced shadows, good detail             → +0.05 to +0.15
  · Shadows already bright / flat lighting    → −0.05 to +0.05
  · Needs deeper blacks for contrast          → −0.10 to −0.20

## 4. highlights (float, range −1.0 to +1.0)
Determine how much highlight recovery is needed.
- Evaluate whether bright areas (sky, reflections, white surfaces) are clipped or blown out.
- Mapping:
  · Severely blown highlights, white sky      → −0.15 to −0.30
  · Moderate clipping in bright areas         → −0.05 to −0.15
  · Well-preserved highlights                 → +0.05 to +0.15
  · Dull / flat highlights needing lift        → +0.15 to +0.30
  · Overcast / low-contrast scene needing pop  → +0.10 to +0.20

## Output format
Return a single JSON object with no markdown fences, no extra keys:
{"exposure": <float>, "straightenAngle": <float>, "shadows": <float>, "highlights": <float>}`

type AnalysisResult = CorrectionParams

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
  if (!text) return { ...DEFAULT_PARAMS }

  try {
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PARAMS }
    const p = parsed as Record<string, unknown>

    const num = (key: string, min: number, max: number, fallback: number): number => {
      const v = p[key]
      if (typeof v !== 'number' || !isFinite(v)) return fallback
      return Math.max(min, Math.min(max, v))
    }

    return {
      exposure: num('exposure', -0.3, 0.3, DEFAULT_PARAMS.exposure),
      straightenAngle: num('straightenAngle', -10, 10, DEFAULT_PARAMS.straightenAngle),
      shadows: num('shadows', -1, 1, DEFAULT_PARAMS.shadows),
      highlights: num('highlights', -1, 1, DEFAULT_PARAMS.highlights),
      ...FIXED_AESTHETIC,
    }
  } catch {
    return { ...DEFAULT_PARAMS }
  }
}

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

export function loadImage(url: string): Promise<HTMLImageElement> {
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
export function applyCorrections(imageData: ImageData, params: CorrectionParams): void {
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
  // Step 1: AI analysis — fallback to defaults on failure
  let params: CorrectionParams
  let analysisFailed = false

  try {
    params = await analyzeImage(imageUrl, config)
  } catch {
    analysisFailed = true
    params = { ...DEFAULT_PARAMS }
  }

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
    feedback: analysisFailed
      ? `⚠ Analyse IA échouée — correction appliquée avec les valeurs par défaut (${paramSummary})`
      : `Correction IA adaptée (${paramSummary})`,
    analysisFailed,
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
