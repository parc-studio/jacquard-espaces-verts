/**
 * Hybrid AI-analysis + Canvas-application image processor.
 *
 * 1. Sends the image to Vertex AI (Gemini) for analysis only (text output).
 *    The AI determines optimal correction parameters for the specific image.
 * 2. Applies those parameters deterministically via Canvas 2D.
 *    The AI never modifies pixels — it only prescribes adjustments.
 *
 * Requires GCP service account credentials configured via @sanity/studio-secrets
 * (see lib/secrets.ts) for the analysis step.
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
  const CHUNK = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
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

export async function getAccessToken(config: GcpConfig): Promise<string> {
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
  tint: number // [-1, 1] negative = green shift, positive = magenta shift
  saturation: number // [-1, 1] negative = desaturate, positive = boost
  whites: number // [-1, 1] highlight tone compression/expansion
  blacks: number // [-1, 1] shadow tone compression/expansion
  vibrance: number // [-1, 1] selective saturation (boosts muted colours more)
  clarity: number // [-1, 1] midtone local contrast
  levelsClipLow: number // [0, 0.05] — black point clip percentile
  levelsClipHigh: number // [0, 0.05] — white point clip percentile
  straightenAngle: number // [-10, 10] degrees — clockwise rotation to straighten
}

export const DEFAULT_PARAMS: CorrectionParams = {
  exposure: -0.06,
  contrast: -0.08,
  highlights: 0.11,
  shadows: 0.29,
  temperature: 0.0,
  tint: 0.0,
  saturation: -0.1,
  whites: 0.0,
  blacks: 0.0,
  vibrance: 0.0,
  clarity: 0.0,
  levelsClipLow: 0.003,
  levelsClipHigh: 0.015,
  straightenAngle: 0,
}

/**
 * Fixed aesthetic parameters — identical for every image.
 * Swiss architectural photography style (Ruedi Walti–inspired):
 * neutral colour temperature, slightly undersaturated vegetation,
 * gentle contrast with preserved highlights and natural tones.
 * exposure, straightenAngle, shadows, highlights, whites, blacks,
 * vibrance, clarity, and tint are determined per-image by the AI.
 */
export const FIXED_AESTHETIC: Pick<
  CorrectionParams,
  'contrast' | 'temperature' | 'saturation' | 'levelsClipLow' | 'levelsClipHigh'
> = {
  contrast: -0.08,
  temperature: 0.0,
  saturation: -0.1,
  levelsClipLow: 0.003,
  levelsClipHigh: 0.015,
}

const ANALYSIS_PROMPT = `You are an image analysis model. You will receive two images:
1. A **reference photo** showing the target colour grading and aesthetic (Swiss architectural photography style — neutral tones, slightly undersaturated vegetation, clean highlights).
2. The **input photo** to analyse.

Compare the input to the reference and prescribe nine correction values that will bring the input closer to the reference aesthetic.

## 1. exposure (float, range −0.30 to +0.30)
Brighten or darken to achieve correct exposure.
- Severely underexposed → +0.15 to +0.25
- Moderately underexposed → +0.05 to +0.12
- Correctly exposed → −0.02 to +0.02
- Moderately overexposed → −0.05 to −0.10
- Severely overexposed → −0.12 to −0.20

## 2. straightenAngle (float, range −10.0 to +10.0, degrees)
Clockwise rotation to level the image.
- Identify dominant horizontal/vertical references (rooflines, building edges, horizon).
- Positive = clockwise. Most images need −2.0 to +2.0°. Return 0 if already level.

## 3. shadows (float, range −1.0 to +1.0)
Shadow recovery. Positive lifts shadows, negative deepens them.
- Deep crushed shadows → +0.30 to +0.50
- Moderate shadow loss → +0.15 to +0.30
- Balanced → +0.05 to +0.15
- Flat lighting / already bright shadows → −0.05 to +0.05

## 4. highlights (float, range −1.0 to +1.0)
Highlight recovery. Negative recovers blown highlights, positive lifts dull highlights.
- Severely blown → −0.15 to −0.30
- Moderate clipping → −0.05 to −0.15
- Well-preserved → +0.05 to +0.15
- Dull / needs lift → +0.15 to +0.30

## 5. whites (float, range −1.0 to +1.0)
Adjust the brightest tones. Positive expands whites (brighter), negative compresses (darker).
- Compare the brightest tones in the input to the reference.
- Most images need −0.20 to +0.20.

## 6. blacks (float, range −1.0 to +1.0)
Adjust the darkest tones. Positive lifts blacks (milky), negative deepens (richer).
- Compare the darkest tones in the input to the reference.
- Most images need −0.20 to +0.20.

## 7. vibrance (float, range −1.0 to +1.0)
Selective saturation: boosts under-saturated colours more than already-vivid ones.
- If the input has dull muted tones compared to reference → positive (0.05 to 0.25).
- If the input is over-vivid → negative (−0.05 to −0.25).
- The reference style is slightly undersaturated — prefer small negative values.

## 8. clarity (float, range −1.0 to +1.0)
Midtone local contrast. Positive adds punch/texture, negative softens.
- Architectural subjects with fine detail → +0.05 to +0.20.
- Already harsh/contrasty midtones → −0.05 to −0.15.
- Most images need 0.0 to +0.15.

## 9. tint (float, range −1.0 to +1.0)
Green–magenta white-balance shift. Negative = green, positive = magenta.
- Fluorescent lighting or green cast → +0.05 to +0.20.
- Magenta cast → −0.05 to −0.20.
- Neutral → 0.0.

## Output format
Return a single JSON object with no markdown fences, no extra keys:
{"exposure": <float>, "straightenAngle": <float>, "shadows": <float>, "highlights": <float>, "whites": <float>, "blacks": <float>, "vibrance": <float>, "clarity": <float>, "tint": <float>}`

type AnalysisResult = CorrectionParams

// ---------------------------------------------------------------------------
// Reference image — loaded once and cached
// ---------------------------------------------------------------------------

const REFERENCE_IMAGE_PATH = '/image_ref.png'

let cachedRefImage: { base64: string; mimeType: string } | null = null

async function loadReferenceImageBase64(): Promise<{ base64: string; mimeType: string }> {
  if (cachedRefImage) return cachedRefImage

  const response = await fetch(REFERENCE_IMAGE_PATH)
  if (!response.ok) {
    throw new Error(`Impossible de charger l'image de référence (${response.status})`)
  }
  const blob = await response.blob()
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const CHUNK = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  const base64 = btoa(binary)

  cachedRefImage = { base64, mimeType: blob.type || 'image/png' }
  return cachedRefImage
}

// ---------------------------------------------------------------------------
// Histogram analysis & matching (per-channel CDF)
// ---------------------------------------------------------------------------

interface ChannelStats {
  histogram: Uint32Array
  cdf: Float64Array
}

function computeChannelStats(
  data: Uint8Array,
  channelOffset: number,
  stride: number
): ChannelStats {
  const histogram = new Uint32Array(256)
  for (let i = channelOffset; i < data.length; i += stride) {
    histogram[data[i]]++
  }
  const total = data.length / stride
  const cdf = new Float64Array(256)
  cdf[0] = histogram[0] / total
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + histogram[i] / total
  }
  return { histogram, cdf }
}

function buildHistogramMatchLut(
  sourceCdf: Float64Array,
  refCdf: Float64Array,
  blend: number
): Uint8Array {
  const lut = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    const srcVal = sourceCdf[i]
    // Find closest match in reference CDF
    let j = 0
    while (j < 255 && refCdf[j] < srcVal) j++
    // Blend between original and matched value
    lut[i] = clamp(Math.round(i * (1 - blend) + j * blend))
  }
  return lut
}

/**
 * Build per-channel histogram matching LUTs from source ImageData
 * to a reference ImageData. Returns [rLut, gLut, bLut].
 * `blend` controls how aggressively the match is applied (0 = none, 1 = full).
 */
function buildHistogramMatchLuts(
  sourceData: Uint8ClampedArray,
  refData: Uint8ClampedArray,
  blend: number
): [Uint8Array, Uint8Array, Uint8Array] {
  const srcR = computeChannelStats(sourceData as unknown as Uint8Array, 0, 4)
  const srcG = computeChannelStats(sourceData as unknown as Uint8Array, 1, 4)
  const srcB = computeChannelStats(sourceData as unknown as Uint8Array, 2, 4)
  const refR = computeChannelStats(refData as unknown as Uint8Array, 0, 4)
  const refG = computeChannelStats(refData as unknown as Uint8Array, 1, 4)
  const refB = computeChannelStats(refData as unknown as Uint8Array, 2, 4)

  return [
    buildHistogramMatchLut(srcR.cdf, refR.cdf, blend),
    buildHistogramMatchLut(srcG.cdf, refG.cdf, blend),
    buildHistogramMatchLut(srcB.cdf, refB.cdf, blend),
  ]
}

async function analyzeImage(imageUrl: string, config: GcpConfig): Promise<AnalysisResult> {
  const token = await getAccessToken(config)

  const [rawImg, refImg] = await Promise.all([
    fetchImageAsBase64(imageUrl),
    loadReferenceImageBase64(),
  ])

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
          { inlineData: { mimeType: refImg.mimeType, data: refImg.base64 } },
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
      whites: num('whites', -1, 1, DEFAULT_PARAMS.whites),
      blacks: num('blacks', -1, 1, DEFAULT_PARAMS.blacks),
      vibrance: num('vibrance', -1, 1, DEFAULT_PARAMS.vibrance),
      clarity: num('clarity', -1, 1, DEFAULT_PARAMS.clarity),
      tint: num('tint', -1, 1, DEFAULT_PARAMS.tint),
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
 * Pipeline (all composed into 3 per-channel LUTs where possible, then a single pixel pass):
 *  1. Histogram match — CDF-based per-channel match to reference (optional)
 *  2. Auto-levels    — luminance histogram stretch (same LUT for R/G/B → no colour shift)
 *  3. Whites/Blacks  — top/bottom 15% luminance compression/expansion
 *  4. Exposure       — gamma curve
 *  5. White balance  — proportional R/G/B scaling (temperature + tint)
 *  6. Tone curve     — shadow lift + highlight recovery + S-curve contrast
 *  7. Clarity        — midtone local contrast via unsharp mask on luminance
 *  8. Saturation     — luma-preserving with green taming
 *  9. Vibrance       — selective saturation (inverse-weighted by current saturation)
 */
export function applyCorrections(
  imageData: ImageData,
  params: CorrectionParams,
  histogramMatchLuts?: [Uint8Array, Uint8Array, Uint8Array]
): void {
  const { data } = imageData
  const totalPixels = data.length / 4

  // --- 1. Optional histogram matching (pre-applied in-place) ---
  if (histogramMatchLuts) {
    const [hmR, hmG, hmB] = histogramMatchLuts
    for (let i = 0; i < data.length; i += 4) {
      data[i] = hmR[data[i]]
      data[i + 1] = hmG[data[i + 1]]
      data[i + 2] = hmB[data[i + 2]]
    }
  }

  // --- 2. Luminance histogram for auto-levels ---
  const lumHist = new Uint32Array(256)
  for (let i = 0; i < data.length; i += 4) {
    const l = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    lumHist[l]++
  }
  const lowVal = percentile(lumHist, params.levelsClipLow, totalPixels)
  const highVal = percentile(lumHist, 1 - params.levelsClipHigh, totalPixels)
  const levelsLut = buildLevelsLut(lowVal, highVal)

  // --- 3. Whites/Blacks (top/bottom 15% luminance adjustment) ---
  const whitesBlacksLut = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    let v = i / 255
    if (v < 0.15) {
      const t = v / 0.15
      v = v + params.blacks * 0.15 * (1 - t) * (1 - t)
    }
    if (v > 0.85) {
      const t = (v - 0.85) / 0.15
      v = v + params.whites * 0.15 * t * t
    }
    whitesBlacksLut[i] = clamp(Math.round(v * 255))
  }

  // --- 4. Exposure (gamma) ---
  const gamma = 1.0 - params.exposure * 0.4
  const gammaLut = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    gammaLut[i] = clamp(Math.round(255 * Math.pow(i / 255, gamma)))
  }

  // --- 5. White balance (proportional R/G/B scaling with temperature + tint) ---
  const rScale = 1.0 + params.temperature * 0.06
  const gScale = 1.0 - params.tint * 0.04
  const bScale = 1.0 - params.temperature * 0.08

  // --- 6. Tone curve (shadow lift + highlight recovery + contrast S-curve) ---
  const toneLut = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    let v = i / 255
    v = v + params.shadows * 0.3 * (1 - v) * (1 - v)
    v = v + params.highlights * 0.3 * v * v
    v = v + params.contrast * 0.1 * Math.sin(Math.PI * v) * (0.5 - Math.abs(v - 0.5))
    toneLut[i] = clamp(Math.round(v * 255))
  }

  // --- Compose into per-channel LUTs: levels → whites/blacks → gamma → WB → tone ---
  const rLut = new Uint8Array(256)
  const gLut = new Uint8Array(256)
  const bLut = new Uint8Array(256)

  for (let i = 0; i < 256; i++) {
    const afterWB = whitesBlacksLut[levelsLut[i]]
    const afterGamma = gammaLut[afterWB]
    rLut[i] = toneLut[clamp(Math.round(afterGamma * rScale))]
    gLut[i] = toneLut[clamp(Math.round(afterGamma * gScale))]
    bLut[i] = toneLut[clamp(Math.round(afterGamma * bScale))]
  }

  // --- 6. Clarity (local contrast via unsharp mask on luminance) ---
  const w = imageData.width
  const h = imageData.height
  const clarityStrength = params.clarity * 0.4
  let blurredLum: Float32Array | null = null

  if (Math.abs(clarityStrength) > 0.005) {
    const lumChannel = new Float32Array(w * h)
    for (let idx = 0; idx < totalPixels; idx++) {
      const off = idx * 4
      // Use post-LUT values so blurredLum and lumC (in the pixel pass) share the same domain
      lumChannel[idx] =
        0.299 * rLut[data[off]] + 0.587 * gLut[data[off + 1]] + 0.114 * bLut[data[off + 2]]
    }

    const radius = Math.min(40, Math.max(10, Math.round(Math.min(w, h) * 0.02)))
    const blurTemp = new Float32Array(w * h)

    // Horizontal pass
    for (let y = 0; y < h; y++) {
      let sum = 0
      let count = 0
      for (let x = 0; x <= radius && x < w; x++) {
        sum += lumChannel[y * w + x]
        count++
      }
      for (let x = 0; x < w; x++) {
        blurTemp[y * w + x] = sum / count
        const right = x + radius + 1
        if (right < w) {
          sum += lumChannel[y * w + right]
          count++
        }
        const left = x - radius
        if (left >= 0) {
          sum -= lumChannel[y * w + left]
          count--
        }
      }
    }

    // Vertical pass
    blurredLum = new Float32Array(w * h)
    for (let x = 0; x < w; x++) {
      let sum = 0
      let count = 0
      for (let y = 0; y <= radius && y < h; y++) {
        sum += blurTemp[y * w + x]
        count++
      }
      for (let y = 0; y < h; y++) {
        blurredLum[y * w + x] = sum / count
        const bottom = y + radius + 1
        if (bottom < h) {
          sum += blurTemp[bottom * w + x]
          count++
        }
        const top = y - radius
        if (top >= 0) {
          sum -= blurTemp[top * w + x]
          count--
        }
      }
    }
  }

  // --- 7. Combined pixel pass: LUT → clarity → saturation → vibrance ---
  const satFactor = 1.0 + params.saturation * 0.8

  for (let px = 0; px < totalPixels; px++) {
    const i = px * 4
    let r = rLut[data[i]]
    let g = gLut[data[i + 1]]
    let b = bLut[data[i + 2]]

    // Clarity: unsharp-mask on luminance
    if (blurredLum) {
      const lumC = 0.299 * r + 0.587 * g + 0.114 * b
      const detail = lumC - blurredLum[px]
      const boost = detail * clarityStrength
      r = clamp(Math.round(r + boost))
      g = clamp(Math.round(g + boost))
      b = clamp(Math.round(b + boost))
    }

    // Luminance for saturation adjustments
    const lum = 0.299 * r + 0.587 * g + 0.114 * b

    // Green desaturation: tame overly vivid greens (15%)
    const maxC = Math.max(r, g, b)
    const greenDominance = maxC > 30 ? Math.max(0, (g - Math.max(r, b)) / maxC) : 0

    // Base saturation (luma-preserving) with green taming
    const effectiveSat = satFactor * (1 - greenDominance * 0.15)
    r = clamp(Math.round(lum + (r - lum) * effectiveSat))
    g = clamp(Math.round(lum + (g - lum) * effectiveSat))
    b = clamp(Math.round(lum + (b - lum) * effectiveSat))

    // Vibrance: selective saturation (boost under-saturated more than saturated)
    if (Math.abs(params.vibrance) > 0.005) {
      const maxRGB = Math.max(r, g, b)
      const minRGB = Math.min(r, g, b)
      const currentSat = maxRGB > 0 ? (maxRGB - minRGB) / maxRGB : 0
      const vibranceFactor = 1.0 + params.vibrance * 0.6 * (1 - currentSat)
      const vLum = 0.299 * r + 0.587 * g + 0.114 * b
      r = clamp(Math.round(vLum + (r - vLum) * vibranceFactor))
      g = clamp(Math.round(vLum + (g - vLum) * vibranceFactor))
      b = clamp(Math.round(vLum + (b - vLum) * vibranceFactor))
    }

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

  // Step 3: Build histogram-match LUTs from reference image
  let histMatchLuts: [Uint8Array, Uint8Array, Uint8Array] | undefined
  try {
    const refBase64 = await loadReferenceImageBase64()
    if (refBase64) {
      const refImg = await loadImage(`data:${refBase64.mimeType};base64,${refBase64.base64}`)
      const refCanvas = document.createElement('canvas')
      refCanvas.width = refImg.naturalWidth
      refCanvas.height = refImg.naturalHeight
      const refCtx = refCanvas.getContext('2d')!
      refCtx.drawImage(refImg, 0, 0)
      const refData = refCtx.getImageData(0, 0, refCanvas.width, refCanvas.height)
      histMatchLuts = buildHistogramMatchLuts(imageData.data, refData.data, 0.6)
    }
  } catch {
    // Reference image unavailable — proceed without histogram matching
  }

  // Step 4: Apply AI-prescribed corrections
  applyCorrections(imageData, params, histMatchLuts)
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
    `blancs=${params.whites.toFixed(2)}`,
    `noirs=${params.blacks.toFixed(2)}`,
    `temp=${params.temperature.toFixed(2)}`,
    `teinte=${params.tint.toFixed(2)}`,
    `sat=${params.saturation.toFixed(2)}`,
    `vibrance=${params.vibrance.toFixed(2)}`,
    `clarte=${params.clarity.toFixed(2)}`,
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
  const result = await processImage(imageUrl, 'auto_correct', config)
  onProgress?.('analysis-done')
  onProgress?.('correction-done')
  return result
}
