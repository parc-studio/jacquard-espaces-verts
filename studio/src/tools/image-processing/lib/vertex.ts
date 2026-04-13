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
// OKLab perceptual color space utilities (Float32 precision)
// ---------------------------------------------------------------------------

/** Statistics of an image's color distribution in OKLab space. */
export interface OklabStats {
  meanL: number
  meanA: number
  meanB: number
  stdL: number
  stdA: number
  stdB: number
  lHist: Uint32Array
}

/** Parameters for colour transfer: CDF matching on L, Reinhard on a/b. */
export interface ColorTransferParams {
  ref: OklabStats
  blend: number // 0 = no transfer, 1 = full transfer
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function linearToSrgb(c: number): number {
  c = Math.max(0, Math.min(1, c))
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

function linearToOklab(r: number, g: number, b: number): [number, number, number] {
  let l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  let m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  let s = 0.0883024619 * r + 0.2220049874 * g + 0.6396926208 * b

  l = Math.cbrt(Math.max(0, l))
  m = Math.cbrt(Math.max(0, m))
  s = Math.cbrt(Math.max(0, s))

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function oklabToLinear(L: number, a: number, bv: number): [number, number, number] {
  const l = L + 0.3963377774 * a + 0.2158037573 * bv
  const m = L - 0.1055613458 * a - 0.0638541728 * bv
  const s = L - 0.0894841775 * a - 1.291485548 * bv

  return [
    4.0767416621 * l * l * l - 3.3077115913 * m * m * m + 0.2309699292 * s * s * s,
    -1.2684380046 * l * l * l + 2.6097574011 * m * m * m - 0.3413193965 * s * s * s,
    -0.0041960863 * l * l * l - 0.7034186147 * m * m * m + 1.707614701 * s * s * s,
  ]
}

const OKLAB_L_BINS = 1024

/**
 * Compute OKLab color statistics for an image.
 * Uses every 4th pixel for performance — statistically equivalent.
 */
export function computeOklabStats(data: Uint8ClampedArray): OklabStats {
  const stride = 4 // sample every 4th pixel
  const pixelStride = stride * 4
  const lHist = new Uint32Array(OKLAB_L_BINS)
  let count = 0
  let sumL = 0,
    sumA = 0,
    sumB = 0
  let sumL2 = 0,
    sumA2 = 0,
    sumB2 = 0

  for (let i = 0; i < data.length; i += pixelStride) {
    const lr = srgbToLinear(data[i] / 255)
    const lg = srgbToLinear(data[i + 1] / 255)
    const lb = srgbToLinear(data[i + 2] / 255)
    const [L, a, b] = linearToOklab(lr, lg, lb)
    sumL += L
    sumA += a
    sumB += b
    sumL2 += L * L
    sumA2 += a * a
    sumB2 += b * b
    lHist[Math.min(OKLAB_L_BINS - 1, Math.max(0, Math.round(L * (OKLAB_L_BINS - 1))))]++
    count++
  }

  const meanL = sumL / count
  const meanA = sumA / count
  const meanB = sumB / count
  return {
    meanL,
    meanA,
    meanB,
    stdL: Math.sqrt(Math.max(0, sumL2 / count - meanL * meanL)),
    stdA: Math.sqrt(Math.max(0, sumA2 / count - meanA * meanA)),
    stdB: Math.sqrt(Math.max(0, sumB2 / count - meanB * meanB)),
    lHist,
  }
}

/**
 * Build a CDF-based luminance transfer LUT.
 * Maps each source L bin to the reference L value at the same CDF percentile.
 * This is the Polarr-style "refer to an image" approach for luminance.
 */
function buildLCdfLut(srcHist: Uint32Array, refHist: Uint32Array, bins: number): Float32Array {
  const srcCdf = new Float32Array(bins)
  const refCdf = new Float32Array(bins)
  let srcTotal = 0,
    refTotal = 0
  for (let i = 0; i < bins; i++) {
    srcTotal += srcHist[i]
    refTotal += refHist[i]
  }

  let acc = 0
  for (let i = 0; i < bins; i++) {
    acc += srcHist[i]
    srcCdf[i] = acc / srcTotal
  }
  acc = 0
  for (let i = 0; i < bins; i++) {
    acc += refHist[i]
    refCdf[i] = acc / refTotal
  }

  // For each source bin, find the reference bin at the same CDF percentile
  const lut = new Float32Array(bins)
  let j = 0
  for (let i = 0; i < bins; i++) {
    while (j < bins - 1 && refCdf[j] < srcCdf[i]) j++
    lut[i] = j / (bins - 1)
  }
  return lut
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
// Parameterised pixel corrections — OKLab Float32 pipeline
// ---------------------------------------------------------------------------

/**
 * Apply AI-prescribed corrections to ImageData using perceptually uniform
 * OKLab colour space and Float32 precision throughout.
 *
 * Pipeline:
 *  1. sRGB → Linear light (proper gamma decode)
 *  2. White balance — proportional R/G/B scaling in linear light
 *  3. Linear → OKLab (perceptually uniform)
 *  4. CDF histogram matching on L + Reinhard on a/b (Polarr-style reference transfer)
 *  5. Auto-levels — OKLab L histogram stretch (perceptually uniform)
 *  6. Whites/Blacks — top/bottom 15% L compression/expansion
 *  7. Exposure — gamma curve on OKLab L
 *  8. Tone curve — shadow lift + highlight recovery + S-curve contrast on L
 *  9. Saturation — OKLab chroma scaling with green hue taming
 * 10. Vibrance — selective chroma boost (inverse-weighted by current chroma)
 * 11. OKLab → Linear → sRGB (gamma encode, single quantisation to 8-bit)
 * 12. Clarity — midtone local contrast via unsharp mask (post-pipeline, 8-bit)
 */
export function applyCorrections(
  imageData: ImageData,
  params: CorrectionParams,
  colorTransfer?: ColorTransferParams
): void {
  const { data, width: w, height: h } = imageData
  const n = data.length / 4

  // Pre-compute white balance multipliers (applied in linear light)
  const rScale = 1.0 + params.temperature * 0.06
  const gScale = 1.0 - params.tint * 0.04
  const bScale = 1.0 - params.temperature * 0.08

  // ---------------------------------------------------------------
  // Pass 1: Convert to OKLab, compute stats for auto-levels
  // ---------------------------------------------------------------
  const lHist = new Uint32Array(OKLAB_L_BINS)

  // Accumulate source OKLab chrominance stats for Reinhard a/b transfer
  let sMeanA = 0,
    sMeanBv = 0
  let sVarA = 0,
    sVarBv = 0

  for (let px = 0; px < n; px++) {
    const i = px * 4
    // sRGB → Linear
    const lr = srgbToLinear(data[i] / 255) * rScale
    const lg = srgbToLinear(data[i + 1] / 255) * gScale
    const lb = srgbToLinear(data[i + 2] / 255) * bScale
    // Linear → OKLab
    const [L, a, bv] = linearToOklab(lr, lg, lb)
    sMeanA += a
    sMeanBv += bv
    sVarA += a * a
    sVarBv += bv * bv
    // OKLab L histogram
    lHist[Math.min(OKLAB_L_BINS - 1, Math.max(0, Math.round(L * (OKLAB_L_BINS - 1))))]++
  }

  sMeanA /= n
  sMeanBv /= n
  const sStdA = Math.sqrt(Math.max(0, sVarA / n - sMeanA * sMeanA))
  const sStdBv = Math.sqrt(Math.max(0, sVarBv / n - sMeanBv * sMeanBv))

  // Compute auto-levels percentiles from OKLab L histogram
  const lowTarget = Math.floor(n * params.levelsClipLow)
  const highTarget = Math.floor(n * (1 - params.levelsClipHigh))
  let lowBin = 0,
    highBin = OKLAB_L_BINS - 1
  let cumSum = 0
  for (let i = 0; i < OKLAB_L_BINS; i++) {
    cumSum += lHist[i]
    if (cumSum >= lowTarget) {
      lowBin = i
      break
    }
  }
  cumSum = 0
  for (let i = 0; i < OKLAB_L_BINS; i++) {
    cumSum += lHist[i]
    if (cumSum >= highTarget) {
      highBin = i
      break
    }
  }
  const lLow = lowBin / (OKLAB_L_BINS - 1)
  const lHigh = highBin / (OKLAB_L_BINS - 1)
  const lRange = Math.max(lHigh - lLow, 0.001)

  // Pre-compute colour transfer: CDF matching for L, Reinhard for a/b
  let ctBlend = 0,
    ctScaleA = 1,
    ctScaleBv = 1,
    ctOffA = 0,
    ctOffBv = 0
  let lCdfLut: Float32Array | null = null
  if (colorTransfer) {
    const { ref, blend } = colorTransfer
    ctBlend = blend
    ctScaleA = ref.stdA / Math.max(sStdA, 0.001)
    ctScaleBv = ref.stdB / Math.max(sStdBv, 0.001)
    ctOffA = ref.meanA
    ctOffBv = ref.meanB
    lCdfLut = buildLCdfLut(lHist, ref.lHist, OKLAB_L_BINS)
  }

  // Pre-compute correction constants
  const gamma = 1.0 - params.exposure * 0.4
  const satFactor = 1.0 + params.saturation * 0.8

  // ---------------------------------------------------------------
  // Pass 2: Apply all corrections per-pixel in Float32
  // ---------------------------------------------------------------
  for (let px = 0; px < n; px++) {
    const i = px * 4
    // --- sRGB → Linear ---
    const lr = srgbToLinear(data[i] / 255) * rScale
    const lg = srgbToLinear(data[i + 1] / 255) * gScale
    const lb = srgbToLinear(data[i + 2] / 255) * bScale

    // --- Linear → OKLab ---
    let [L, a, bv] = linearToOklab(lr, lg, lb)

    // --- CDF histogram matching on lightness (Polarr-style) ---
    if (lCdfLut) {
      const lutIdx = Math.min(OKLAB_L_BINS - 1, Math.max(0, Math.round(L * (OKLAB_L_BINS - 1))))
      const targetL = lCdfLut[lutIdx]
      L = L + (targetL - L) * ctBlend
    }

    // --- Reinhard transfer on chrominance (a, b) ---
    if (ctBlend > 0) {
      const tA = (a - sMeanA) * ctScaleA + ctOffA
      const tBv = (bv - sMeanBv) * ctScaleBv + ctOffBv
      a = a + (tA - a) * ctBlend
      bv = bv + (tBv - bv) * ctBlend
    }

    // --- Auto-levels on OKLab L ---
    L = (L - lLow) / lRange

    // --- Whites/Blacks on OKLab L ---
    if (L < 0.15) {
      const t = L / 0.15
      L += params.blacks * 0.15 * (1 - t) * (1 - t)
    }
    if (L > 0.85) {
      const t = (L - 0.85) / 0.15
      L += params.whites * 0.15 * t * t
    }

    // --- Exposure (gamma on L) ---
    L = Math.pow(Math.max(0, L), gamma)

    // --- Tone curve (shadow lift + highlight recovery + contrast S-curve) ---
    L += params.shadows * 0.3 * (1 - L) * (1 - L)
    L += params.highlights * 0.3 * L * L
    L += params.contrast * 0.1 * Math.sin(Math.PI * L) * (0.5 - Math.abs(L - 0.5))

    // --- Saturation + green desaturation in OKLab chroma ---
    const chroma = Math.sqrt(a * a + bv * bv)
    if (chroma > 0.0001) {
      // Green hue in OKLab: atan2(b, a) ≈ 2.3 rad
      const hue = Math.atan2(bv, a)
      const greenness = Math.max(0, 1 - Math.abs(hue - 2.3) / 0.8)
      const greenDamping = 1 - greenness * 0.15
      const effectiveSat = satFactor * greenDamping

      a *= effectiveSat
      bv *= effectiveSat

      // --- Vibrance: selective chroma boost (more on low-chroma pixels) ---
      if (Math.abs(params.vibrance) > 0.005) {
        const normChroma = Math.min(chroma * 5, 1)
        const vibranceFactor = 1.0 + params.vibrance * 0.6 * (1 - normChroma)
        a *= vibranceFactor
        bv *= vibranceFactor
      }
    }

    // --- OKLab → Linear ---
    let [rOut, gOut, bOut] = oklabToLinear(L, a, bv)
    rOut = Math.max(0, rOut)
    gOut = Math.max(0, gOut)
    bOut = Math.max(0, bOut)

    // --- Linear → sRGB (single 8-bit quantisation) ---
    data[i] = clamp(Math.round(linearToSrgb(rOut) * 255))
    data[i + 1] = clamp(Math.round(linearToSrgb(gOut) * 255))
    data[i + 2] = clamp(Math.round(linearToSrgb(bOut) * 255))
  }

  // ---------------------------------------------------------------
  // Post-pass: Clarity (unsharp mask on luminance, 8-bit domain)
  // ---------------------------------------------------------------
  const clarityStrength = params.clarity * 0.4
  if (Math.abs(clarityStrength) > 0.005) {
    const lumChannel = new Float32Array(n)
    for (let px = 0; px < n; px++) {
      const off = px * 4
      lumChannel[px] = 0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2]
    }

    const radius = Math.min(40, Math.max(10, Math.round(Math.min(w, h) * 0.02)))
    const blurTemp = new Float32Array(n)

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
    const blurredLum = new Float32Array(n)
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

    // Apply unsharp mask
    for (let px = 0; px < n; px++) {
      const off = px * 4
      const detail = lumChannel[px] - blurredLum[px]
      const boost = detail * clarityStrength
      data[off] = clamp(Math.round(data[off] + boost))
      data[off + 1] = clamp(Math.round(data[off + 1] + boost))
      data[off + 2] = clamp(Math.round(data[off + 2] + boost))
    }
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

  // Step 3: Compute OKLab colour transfer from reference image
  let colorTransfer: ColorTransferParams | undefined
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
      const refStats = computeOklabStats(refData.data)
      colorTransfer = { ref: refStats, blend: 0.6 }
    }
  } catch {
    // Reference image unavailable — proceed without colour transfer
  }

  // Step 4: Apply AI-prescribed corrections
  applyCorrections(imageData, params, colorTransfer)
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
