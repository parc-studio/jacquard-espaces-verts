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
import type { CorrectionParams, ProcessingMode, ProcessingResult } from './types'

export type { CorrectionParams } from './types'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PRIMARY_ANALYSIS_MODEL = 'gemini-2.5-pro'
const FALLBACK_ANALYSIS_MODEL = 'gemini-2.5-flash'
const ANALYSIS_MODELS = [PRIMARY_ANALYSIS_MODEL, FALLBACK_ANALYSIS_MODEL] as const

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

export const DEFAULT_PARAMS: CorrectionParams = {
  exposure: -0.03,
  contrast: -0.05,
  highlights: 0.05,
  shadows: 0.14,
  temperature: 0.0,
  tint: 0.0,
  saturation: -0.1,
  whites: 0.0,
  blacks: 0.0,
  vibrance: -0.06,
  clarity: 0.0,
  levelsClipLow: 0.002,
  levelsClipHigh: 0.012,
  straightenAngle: 0,
  verticalPerspective: 0,
}

const AUTO_LEVELS_BLEND = 0.55
const SHADOW_CURVE_STRENGTH = 0.18
const HIGHLIGHT_CURVE_STRENGTH = 0.12
const GEOMETRY_CROP_RELIEF = 0.22
const GREEN_HUE_CENTER = 2.3
const GREEN_HUE_FALLOFF = 0.9
const GREEN_CHROMA_DAMPING = 0.42
const GREEN_VIBRANCE_ROLLOFF = 0.72
const GREEN_L_SUPPRESSION = 0.06
const CHROMA_BLEND_BOOST = 1.35

const ANALYSIS_PROMPT = `You are an image analysis model. You will receive two images:
1. A **reference photo** showing the target colour grading and aesthetic (Swiss architectural photography style — neutral tones, slightly undersaturated vegetation, clean highlights).
2. The **input photo** to analyse.

Compare the input to the reference and prescribe fifteen correction values that will bring the input closer to the reference aesthetic.

## Reference image
The reference image shows a landscaped garden or nursery setting photographed in natural daylight. Young deciduous trees with slender trunks are staked along a path edged with grass, bark mulch, and low hedging. A polytunnel or greenhouse structure is visible in the background. The lighting is soft and slightly warm — overcast or late-morning — with gentle, even exposure across the scene.

The overall colour palette is muted and naturalistic. Greens are subdued sage-olive tones, never vivid emerald or neon. Grass, foliage, and hedging all share a restrained, slightly desaturated character with warm-cool balance leaning neutral. Earth tones (bark mulch, paths, soil) are soft brown-grey without heavy contrast. Highlights are clean but not blown; shadows hold detail without being lifted or crushed.

The desired look is calm, naturalistic, softly graded, and gently understated — not punchy, contrasty, or over-processed. Use the actual visual relationship between the input and the reference image, not assumptions about a particular photography style.

Bias strongly toward subtle adjustments. If the input already feels balanced, return values close to zero instead of forcing it toward a stronger processed look. Do not brighten shadows, lift highlights, or correct perspective unless the need is visually obvious.

## 1. exposure (float, range −0.30 to +0.30)
Brighten or darken to achieve correct exposure.
- Severely underexposed → +0.12 to +0.20
- Moderately underexposed → +0.03 to +0.08
- Correctly exposed → −0.02 to +0.02
- Moderately overexposed → −0.05 to −0.10
- Severely overexposed → −0.12 to −0.20

## 2. contrast (float, range −0.30 to +0.30)
Global tone separation. Negative softens contrast, positive increases it.
- The reference look is gentle and controlled, not punchy.
- Use small negative values when the input feels harsh or too crisp.
- Use small positive values only if the input is visibly flatter than the reference.
- Most images should stay between −0.15 and +0.10.

## 3. straightenAngle (float, range −10.0 to +10.0, degrees)
Clockwise rotation to level the image. Be precise — even 0.5° matters.
- PRIORITY 1: Find the true horizon line. If visible (sky–ground boundary, water surface, flat roofline), align to it.
- PRIORITY 2: If no horizon is visible, use dominant horizontal lines: window sills, terrace edges, wall tops, path borders, fences.
- PRIORITY 3: If no strong horizontals, check verticals: building edges, columns, door frames, fence posts, lamp posts. If they lean consistently to one side, the image needs rotation.
- For garden/vegetation scenes, look for vertical tree trunks, fence posts, or building edges in the background.
- Positive = clockwise.
- Be conservative: prefer a small correction over an incorrect one. Rotation causes cropping, so only prescribe a non-zero value when you clearly see tilt.
- Keep most corrections between −1.2 and +1.2 degrees. Use larger values only for clearly crooked images.
- Return 0 if the image appears level or if you are unsure.

## 4. verticalPerspective (float, range −0.40 to +0.40)
Correct converging or diverging vertical lines (keystone effect) caused by the camera tilting up or down.
- If vertical building edges/walls/columns converge toward the top (camera tilted up, shot from below) → negative value.
- If verticals diverge toward the top (camera tilted down, shot from above) → positive value.
- If verticals are already parallel, or the scene has no strong vertical architectural references → 0.
- Be conservative: most photos need only −0.02 to −0.10. Large values cause significant cropping and visible reframing.
- Only correct obvious keystoning. Do not try to redesign the perspective or make the shot look more frontal than it really is.
- Do NOT correct intentional dramatic perspective (e.g. looking straight up at a tall building).
- Return 0 for garden/landscape scenes without clear vertical architectural lines.

## 5. shadows (float, range −1.0 to +1.0)
Shadow recovery. Positive lifts shadows, negative deepens them.
- Deep crushed shadows → +0.20 to +0.35
- Moderate shadow loss → +0.08 to +0.18
- Balanced → +0.02 to +0.10
- Flat lighting / already bright shadows → −0.05 to +0.05

## 6. highlights (float, range −1.0 to +1.0)
Highlight recovery. Negative recovers blown highlights, positive lifts dull highlights.
- Severely blown → −0.15 to −0.30
- Moderate clipping → −0.05 to −0.15
- Well-preserved → +0.02 to +0.08
- Dull / needs lift → +0.08 to +0.16

## 7. whites (float, range −1.0 to +1.0)
Adjust the brightest tones. Positive expands whites (brighter), negative compresses (darker).
- Compare the brightest tones in the input to the reference.
- Most images need −0.20 to +0.20.

## 8. blacks (float, range −1.0 to +1.0)
Adjust the darkest tones. Positive lifts blacks (milky), negative deepens (richer).
- Compare the darkest tones in the input to the reference.
- Most images need −0.20 to +0.20.

## 9. temperature (float, range −0.35 to +0.35)
Blue-yellow white-balance shift. Negative = cooler, positive = warmer.
- The reference image is cool-to-neutral, not cold and not warm.
- Use small negative values if the input is too warm or yellow.
- Use small positive values only if the input is noticeably too cool compared to the reference.
- Most images should stay between −0.12 and +0.08.

## 10. tint (float, range −1.0 to +1.0)
Green–magenta white-balance shift. Negative = green, positive = magenta.
- Fluorescent lighting or green cast → +0.05 to +0.20.
- Magenta cast → −0.05 to −0.20.
- Neutral → 0.0.

## 11. saturation (float, range −0.35 to +0.25)
Global colour intensity. Negative desaturates, positive boosts.
- The reference style is restrained and slightly subdued.
- Keep greens natural and present, but avoid vivid emerald or neon vegetation.
- If foliage is noticeably richer, brighter, or more saturated than the reference, prefer negative values.
- For most exterior scenes with vegetation, stay between −0.18 and 0.00.
- Use small negative values when the input feels too vivid.
- Use small positive values only when the input is duller than the reference overall.

## 12. vibrance (float, range −1.0 to +1.0)
Selective saturation: boosts under-saturated colours more than already-vivid ones.
- If the input has dull muted tones compared to reference → positive (0.05 to 0.25).
- If the input is over-vivid → negative (−0.05 to −0.25).
- The reference style is slightly undersaturated — prefer small negative values.
- Avoid positive vibrance on scenes with healthy grass, shrubs, or tree canopies unless the vegetation is clearly flatter than the reference.

## 13. clarity (float, range −1.0 to +1.0)
Midtone local contrast. Positive adds punch/texture, negative softens.
- Architectural subjects with fine detail → +0.05 to +0.20.
- Already harsh/contrasty midtones → −0.05 to −0.15.
- Most images need 0.0 to +0.15.

## 14. levelsClipLow (float, range 0.000 to 0.020)
Black-point clipping percentile used for auto-levels.
- Lower values preserve more shadow detail.
- Higher values create firmer blacks and a slightly cleaner tonal floor.
- The reference keeps shadow detail, so stay modest.
- Most images should stay between 0.001 and 0.008.

## 15. levelsClipHigh (float, range 0.005 to 0.030)
White-point clipping percentile used for auto-levels.
- Lower values preserve more highlight detail.
- Higher values create cleaner, brighter highlights but can become too crisp.
- The reference has clean highlights without harsh clipping.
- Most images should stay between 0.008 and 0.018.

## Output format
Return a single JSON object with no markdown fences, no extra keys:
{"exposure": <float>, "contrast": <float>, "straightenAngle": <float>, "verticalPerspective": <float>, "shadows": <float>, "highlights": <float>, "whites": <float>, "blacks": <float>, "temperature": <float>, "tint": <float>, "saturation": <float>, "vibrance": <float>, "clarity": <float>, "levelsClipLow": <float>, "levelsClipHigh": <float>}`

type AnalysisResult = CorrectionParams

function compressMagnitude(value: number, softLimit: number, tailFactor: number): number {
  const magnitude = Math.abs(value)
  if (magnitude <= softLimit) return value
  return Math.sign(value) * (softLimit + (magnitude - softLimit) * tailFactor)
}

/**
 * How much the AI-prescribed values can deviate from DEFAULT_PARAMS.
 * 0 = always use defaults, 1 = fully trust the AI.
 * At 0.4 the AI can move each param only 40% of the way from the default.
 */
const AI_DEVIATION_FACTOR = 0.4

function normalizeConservativeParams(params: CorrectionParams): CorrectionParams {
  // First compress extreme outliers
  const compressed: CorrectionParams = {
    ...params,
    exposure: compressMagnitude(params.exposure, 0.08, 0.6),
    shadows: compressMagnitude(params.shadows, 0.12, 0.45),
    highlights: compressMagnitude(params.highlights, 0.08, 0.5),
    whites: compressMagnitude(params.whites, 0.1, 0.55),
    blacks: compressMagnitude(params.blacks, 0.1, 0.55),
    saturation:
      params.saturation <= 0
        ? compressMagnitude(params.saturation, 0.12, 0.8)
        : compressMagnitude(params.saturation, 0.03, 0.3),
    vibrance:
      params.vibrance <= 0
        ? compressMagnitude(params.vibrance, 0.16, 0.75)
        : compressMagnitude(params.vibrance, 0.04, 0.25),
    straightenAngle: compressMagnitude(params.straightenAngle, 0.35, 0.5),
    verticalPerspective: compressMagnitude(params.verticalPerspective, 0.03, 0.4),
  }

  // Then blend toward DEFAULT_PARAMS so the output stays close to the labo look
  const blend = (key: keyof CorrectionParams) =>
    DEFAULT_PARAMS[key] + (compressed[key] - DEFAULT_PARAMS[key]) * AI_DEVIATION_FACTOR

  return {
    exposure: blend('exposure'),
    contrast: blend('contrast'),
    highlights: blend('highlights'),
    shadows: blend('shadows'),
    whites: blend('whites'),
    blacks: blend('blacks'),
    temperature: blend('temperature'),
    tint: blend('tint'),
    saturation: blend('saturation'),
    vibrance: blend('vibrance'),
    clarity: blend('clarity'),
    levelsClipLow: blend('levelsClipLow'),
    levelsClipHigh: blend('levelsClipHigh'),
    // Geometry: keep full AI precision — straightening/perspective are binary-correct
    straightenAngle: compressed.straightenAngle,
    verticalPerspective: compressed.verticalPerspective,
  }
}

// ---------------------------------------------------------------------------
// Reference image — loaded once and cached
// ---------------------------------------------------------------------------

const REFERENCE_IMAGE_PATH = '/image-ref.jpeg'

let cachedRefImage: { base64: string; mimeType: string } | null = null

export async function loadReferenceImageBase64(): Promise<{ base64: string; mimeType: string }> {
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

  cachedRefImage = { base64, mimeType: blob.type || 'image/jpeg' }
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
      temperature: 0,
    },
  }

  const body = JSON.stringify(payload)
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  const requestAnalysis = async (model: (typeof ANALYSIS_MODELS)[number]): Promise<Response> => {
    const url =
      `https://${config.region}-aiplatform.googleapis.com/v1beta1` +
      `/projects/${config.projectId}/locations/${config.region}` +
      `/publishers/google/models/${model}:generateContent`

    let lastError: string | undefined

    for (let attempt = 0; attempt < 2; attempt++) {
      let response: Response

      try {
        response = await fetch(url, { method: 'POST', headers, body })
      } catch (networkErr) {
        lastError = networkErr instanceof Error ? networkErr.message : String(networkErr)
        if (attempt === 0) {
          console.warn(
            '[image-processing] AI analysis network error, retrying in 2 s…',
            model,
            lastError
          )
          await new Promise((r) => setTimeout(r, 2000))
          continue
        }
        throw new Error(`Analyse IA échouée avec ${model} (erreur réseau): ${lastError}`, {
          cause: networkErr,
        })
      }

      if (response.ok) return response

      lastError = await response.text().catch(() => '')
      if (response.status >= 500 && attempt === 0) {
        console.warn('[image-processing] AI analysis 5xx, retrying in 2 s…', model, response.status)
        await new Promise((r) => setTimeout(r, 2000))
        continue
      }

      console.warn('AI analysis failed:', model, response.status, response.statusText, lastError)
      throw new Error(
        `Analyse IA échouée avec ${model} (${response.status} ${response.statusText}). ` +
          `Vérifiez que le modèle est disponible dans la région ${config.region}. ` +
          `Détails: ${(lastError ?? '').slice(0, 200)}`
      )
    }

    throw new Error(
      `Analyse IA échouée avec ${model} après 2 tentatives: ${lastError ?? 'Erreur inconnue'}`
    )
  }

  let response: Response | undefined
  let lastFailure: Error | undefined

  for (const model of ANALYSIS_MODELS) {
    try {
      response = await requestAnalysis(model)
      if (model !== PRIMARY_ANALYSIS_MODEL) {
        console.warn(
          `[image-processing] Fallback model used for analysis: ${PRIMARY_ANALYSIS_MODEL} -> ${FALLBACK_ANALYSIS_MODEL}`
        )
      }
      break
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      lastFailure = error
      if (model === PRIMARY_ANALYSIS_MODEL) {
        console.warn(
          `[image-processing] Primary analysis model failed, falling back to ${FALLBACK_ANALYSIS_MODEL}:`,
          error.message
        )
        continue
      }
      throw error
    }
  }

  if (!response?.ok) {
    throw lastFailure ?? new Error('Analyse IA échouée sans réponse exploitable.')
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

    return normalizeConservativeParams({
      exposure: num('exposure', -0.3, 0.3, DEFAULT_PARAMS.exposure),
      contrast: num('contrast', -0.3, 0.3, DEFAULT_PARAMS.contrast),
      straightenAngle: num('straightenAngle', -10, 10, DEFAULT_PARAMS.straightenAngle),
      verticalPerspective: num(
        'verticalPerspective',
        -0.4,
        0.4,
        DEFAULT_PARAMS.verticalPerspective
      ),
      shadows: num('shadows', -1, 1, DEFAULT_PARAMS.shadows),
      highlights: num('highlights', -1, 1, DEFAULT_PARAMS.highlights),
      temperature: num('temperature', -0.35, 0.35, DEFAULT_PARAMS.temperature),
      tint: num('tint', -1, 1, DEFAULT_PARAMS.tint),
      saturation: num('saturation', -0.35, 0.25, DEFAULT_PARAMS.saturation),
      whites: num('whites', -1, 1, DEFAULT_PARAMS.whites),
      blacks: num('blacks', -1, 1, DEFAULT_PARAMS.blacks),
      vibrance: num('vibrance', -1, 1, DEFAULT_PARAMS.vibrance),
      clarity: num('clarity', -1, 1, DEFAULT_PARAMS.clarity),
      levelsClipLow: num('levelsClipLow', 0, 0.02, DEFAULT_PARAMS.levelsClipLow),
      levelsClipHigh: num('levelsClipHigh', 0.005, 0.03, DEFAULT_PARAMS.levelsClipHigh),
    })
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
  const gamma = 1.0 - params.exposure * 0.32
  const satFactor = 1.0 + params.saturation * 1.0

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
    // Chrominance blend is boosted relative to lightness so the reference's
    // colour palette pulls harder without over-flattening tonality.
    if (ctBlend > 0) {
      const chromaBlend = Math.min(ctBlend * CHROMA_BLEND_BOOST, 1)
      const tA = (a - sMeanA) * ctScaleA + ctOffA
      const tBv = (bv - sMeanBv) * ctScaleBv + ctOffBv
      a = a + (tA - a) * chromaBlend
      bv = bv + (tBv - bv) * chromaBlend
    }

    // --- Auto-levels on OKLab L ---
    const autoLeveledL = (L - lLow) / lRange
    L = L + (autoLeveledL - L) * AUTO_LEVELS_BLEND

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
    L += params.shadows * SHADOW_CURVE_STRENGTH * (1 - L) * (1 - L)
    L += params.highlights * HIGHLIGHT_CURVE_STRENGTH * L * L
    L += params.contrast * 0.1 * Math.sin(Math.PI * L) * (0.5 - Math.abs(L - 0.5))

    // --- Saturation + green desaturation in OKLab chroma ---
    const chroma = Math.sqrt(a * a + bv * bv)
    if (chroma > 0.0001) {
      // Green hue in OKLab: atan2(b, a) ≈ 2.3 rad
      const hue = Math.atan2(bv, a)
      const greenness = Math.max(0, 1 - Math.abs(hue - GREEN_HUE_CENTER) / GREEN_HUE_FALLOFF)

      // --- Green lightness suppression: mute overly bright vegetation ---
      L -= greenness * GREEN_L_SUPPRESSION * L

      const greenDamping = 1 - greenness * GREEN_CHROMA_DAMPING
      const effectiveSat = satFactor * greenDamping

      a *= effectiveSat
      bv *= effectiveSat

      // --- Vibrance: selective chroma boost (more on low-chroma pixels) ---
      if (Math.abs(params.vibrance) > 0.005) {
        const normChroma = Math.min(chroma * 5, 1)
        const greenVibranceLimit = 1 - greenness * GREEN_VIBRANCE_ROLLOFF
        const vibranceFactor = 1.0 + params.vibrance * 0.6 * (1 - normChroma)
        a *= vibranceFactor
        bv *= vibranceFactor
        if (params.vibrance > 0) {
          a *= greenVibranceLimit
          bv *= greenVibranceLimit
        }
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

function relaxCropDimension(inscribed: number, original: number): number {
  return Math.max(
    1,
    Math.round(Math.min(inscribed + (original - inscribed) * GEOMETRY_CROP_RELIEF, original))
  )
}

function formatParamSummary(params: CorrectionParams, blend?: number): string {
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
  if (Math.abs(params.verticalPerspective) > 0.01) {
    parts.push(`perspective=${params.verticalPerspective.toFixed(2)}`)
  }
  if (blend !== undefined) {
    parts.push(`blend=${blend.toFixed(2)}`)
  }
  return parts.join(', ')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * AI analysis — sends the image + reference to Gemini and returns correction
 * parameters. Falls back to DEFAULT_PARAMS on any failure.
 */
export { analyzeImage }

/**
 * Apply correction parameters to an image and return the result as base64 JPEG.
 *
 * This is the "apply" half of the split pipeline. It handles:
 * - Canvas load at full resolution
 * - Vertical perspective correction (keystone)
 * - Straightening (rotate + crop)
 * - OKLab colour transfer from reference (adaptive blend)
 * - AI-prescribed corrections
 * - JPEG q=0.97 export
 *
 * @param blendOverride — If provided, overrides the adaptive blend factor.
 */
export async function applyImageCorrections(
  imageUrl: string,
  params: CorrectionParams,
  options?: { blendOverride?: number }
): Promise<ProcessingResult> {
  // Load full-resolution image into Canvas
  const separator = imageUrl.includes('?') ? '&' : '?'
  const srcUrl = `${imageUrl}${separator}fm=png`
  const img = await loadImage(srcUrl)

  let curW = img.naturalWidth
  let curH = img.naturalHeight

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Impossible de créer le contexte Canvas 2D.')

  // Draw source image onto an initial canvas for geometry pipeline
  canvas.width = curW
  canvas.height = curH
  ctx.drawImage(img, 0, 0)

  // ---------------------------------------------------------------
  // Phase 1: Vertical perspective correction (keystone)
  // ---------------------------------------------------------------
  const kVal = params.verticalPerspective
  if (Math.abs(kVal) > 0.01) {
    const srcData = ctx.getImageData(0, 0, curW, curH)
    const srcPixels = srcData.data

    // Compute the inscribed crop rectangle — narrowest valid row width
    // At row y, the horizontal scale is s = 1 + k * (1 - 2*y/h)
    // The narrowest row determines the crop width.
    // Blend between the full inscribed crop (no black border) and the
    // original frame to preserve more of the composition while staying borderless.
    const sTop = 1 + kVal // scale at y=0
    const sBot = 1 - kVal // scale at y=h
    const minScale = Math.min(Math.abs(sTop), Math.abs(sBot))
    const inscribedW = curW * minScale
    const cropW = relaxCropDimension(inscribedW, curW)
    const cropH = curH
    const cx = curW / 2

    // Output canvas
    const perspCanvas = document.createElement('canvas')
    perspCanvas.width = cropW
    perspCanvas.height = cropH
    const perspCtx = perspCanvas.getContext('2d')!
    const outData = perspCtx.createImageData(cropW, cropH)
    const outPixels = outData.data
    const outCx = cropW / 2

    for (let y = 0; y < cropH; y++) {
      const t = curH > 1 ? y / (curH - 1) : 0.5
      const s = 1 + kVal * (1 - 2 * t)

      for (let x = 0; x < cropW; x++) {
        // Map output pixel to source coordinates
        const srcX = cx + (x - outCx) / s
        const srcY = y

        // Bilinear interpolation
        const x0 = Math.floor(srcX)
        const y0 = Math.floor(srcY)
        const x1 = x0 + 1
        const y1 = y0 + 1
        const fx = srcX - x0
        const fy = srcY - y0

        // Clamp to source bounds
        const sx0 = Math.max(0, Math.min(curW - 1, x0))
        const sy0 = Math.max(0, Math.min(curH - 1, y0))
        const sx1 = Math.max(0, Math.min(curW - 1, x1))
        const sy1 = Math.max(0, Math.min(curH - 1, y1))

        const i00 = (sy0 * curW + sx0) * 4
        const i10 = (sy0 * curW + sx1) * 4
        const i01 = (sy1 * curW + sx0) * 4
        const i11 = (sy1 * curW + sx1) * 4

        const w00 = (1 - fx) * (1 - fy)
        const w10 = fx * (1 - fy)
        const w01 = (1 - fx) * fy
        const w11 = fx * fy

        const outIdx = (y * cropW + x) * 4
        outPixels[outIdx] =
          srcPixels[i00] * w00 + srcPixels[i10] * w10 + srcPixels[i01] * w01 + srcPixels[i11] * w11
        outPixels[outIdx + 1] =
          srcPixels[i00 + 1] * w00 +
          srcPixels[i10 + 1] * w10 +
          srcPixels[i01 + 1] * w01 +
          srcPixels[i11 + 1] * w11
        outPixels[outIdx + 2] =
          srcPixels[i00 + 2] * w00 +
          srcPixels[i10 + 2] * w10 +
          srcPixels[i01 + 2] * w01 +
          srcPixels[i11 + 2] * w11
        outPixels[outIdx + 3] = 255
      }
    }

    perspCtx.putImageData(outData, 0, 0)

    // Replace main canvas with perspective-corrected result
    curW = cropW
    curH = cropH
    canvas.width = curW
    canvas.height = curH
    ctx.drawImage(perspCanvas, 0, 0)

    // Release scratch
    perspCanvas.width = 0
    perspCanvas.height = 0
  }

  // ---------------------------------------------------------------
  // Phase 2: Straighten if needed (rotate + crop to avoid black borders)
  // ---------------------------------------------------------------
  let tmpCanvas: HTMLCanvasElement | undefined
  const angle = params.straightenAngle
  if (Math.abs(angle) > 0.05) {
    const rad = (angle * Math.PI) / 180
    const cosA = Math.abs(Math.cos(rad))
    const sinA = Math.abs(Math.sin(rad))

    // Inscribed rectangle that fits inside the rotated image without black borders
    const inscribedW = (curW * cosA - curH * sinA) / (cosA * cosA - sinA * sinA)
    const inscribedH = (curH * cosA - curW * sinA) / (cosA * cosA - sinA * sinA)
    const finalW = relaxCropDimension(inscribedW, curW)
    const finalH = relaxCropDimension(inscribedH, curH)

    tmpCanvas = document.createElement('canvas')
    tmpCanvas.width = curW
    tmpCanvas.height = curH
    const tmpCtx = tmpCanvas.getContext('2d')!
    tmpCtx.imageSmoothingEnabled = true
    tmpCtx.imageSmoothingQuality = 'high'
    tmpCtx.translate(curW / 2, curH / 2)
    tmpCtx.rotate(rad)
    tmpCtx.drawImage(canvas, -curW / 2, -curH / 2)

    canvas.width = finalW
    canvas.height = finalH
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    const sx = Math.round((curW - finalW) / 2)
    const sy = Math.round((curH - finalH) / 2)
    ctx.drawImage(tmpCanvas, sx, sy, finalW, finalH, 0, 0, finalW, finalH)
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

  // Compute OKLab colour transfer from reference image (adaptive blend)
  let colorTransfer: ColorTransferParams | undefined
  let blendUsed: number | undefined
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

      // Colour transfer is disabled by default (blend=0) — the adaptive blend
      // was pulling images too far from natural appearance.  Pass a non-zero
      // blendOverride to re-enable it from the labo couleur slider.
      const blend = options?.blendOverride ?? 0
      blendUsed = blend

      colorTransfer = { ref: refStats, blend }

      // Release ref canvas
      refCanvas.width = 0
      refCanvas.height = 0
    }
  } catch (err) {
    console.error('[image-processing] Failed to load reference image for colour transfer:', err)
  }

  // Apply AI-prescribed corrections
  applyCorrections(imageData, params, colorTransfer)
  ctx.putImageData(imageData, 0, 0)

  // Release scratch canvases
  if (tmpCanvas) {
    tmpCanvas.width = 0
    tmpCanvas.height = 0
  }

  // Export as high-quality JPEG
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Échec de l'export Canvas."))),
      'image/jpeg',
      0.97
    )
  })

  // Release main canvas
  canvas.width = 0
  canvas.height = 0

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error('Échec de la conversion base64.'))
    reader.readAsDataURL(blob)
  })

  const paramSummary = formatParamSummary(params, blendUsed)

  return {
    base64Data: base64,
    mimeType: 'image/jpeg',
    feedback: `Correction IA adaptée (${paramSummary})`,
  }
}

/**
 * Full single-image pipeline: analyse → apply → export.
 * Used by the single-image workflow and as the fallback for legacy callers.
 */
export async function processImage(
  imageUrl: string,
  mode: ProcessingMode,
  config: GcpConfig
): Promise<ProcessingResult> {
  if (mode !== 'auto_correct') {
    throw new Error(`Mode non supporté: ${mode as string}`)
  }

  let params: CorrectionParams
  let analysisFailed = false

  try {
    params = await analyzeImage(imageUrl, config)
  } catch {
    analysisFailed = true
    params = { ...DEFAULT_PARAMS }
  }

  const result = await applyImageCorrections(imageUrl, params)

  if (analysisFailed) {
    const paramSummary = formatParamSummary(params)
    return {
      ...result,
      feedback: `⚠ Analyse IA échouée — correction appliquée avec les valeurs par défaut (${paramSummary})`,
      analysisFailed,
    }
  }

  return result
}

/**
 * Chained pipeline with real progress callbacks.
 *
 * Fires 'analysis-done' after AI analysis completes (before correction),
 * then 'correction-done' after Canvas processing finishes.
 */
export async function processImageChain(
  imageUrl: string,
  config: GcpConfig,
  onProgress?: (step: 'analysis-done' | 'correction-done', intermediate?: ProcessingResult) => void
): Promise<ProcessingResult> {
  let params: CorrectionParams
  let analysisFailed = false

  try {
    params = await analyzeImage(imageUrl, config)
  } catch {
    analysisFailed = true
    params = { ...DEFAULT_PARAMS }
  }

  onProgress?.('analysis-done')

  const result = await applyImageCorrections(imageUrl, params)
  onProgress?.('correction-done')

  if (analysisFailed) {
    const paramSummary = formatParamSummary(params)
    return {
      ...result,
      feedback: `⚠ Analyse IA échouée — correction appliquée avec les valeurs par défaut (${paramSummary})`,
      analysisFailed,
    }
  }

  return result
}

/**
 * IQR-based normalization of correction parameters across a project.
 *
 * For each tonal parameter, replaces outliers (> 1.5× IQR from median)
 * with the median value. `straightenAngle` is always per-image and never
 * normalized. Fixed aesthetic params are untouched.
 */
export function normalizeParamsForProject(paramsList: CorrectionParams[]): CorrectionParams[] {
  if (paramsList.length <= 2) return paramsList.map((p) => ({ ...p }))

  /** Keys that get normalized (AI-determined tonal params). */
  const tonalKeys: (keyof CorrectionParams)[] = [
    'exposure',
    'shadows',
    'highlights',
    'whites',
    'blacks',
    'vibrance',
    'clarity',
    'tint',
  ]

  // Collect values per key and compute stats
  const stats = new Map<
    keyof CorrectionParams,
    { median: number; q1: number; q3: number; iqr: number }
  >()

  for (const key of tonalKeys) {
    const vals = paramsList.map((p) => p[key]).sort((a, b) => a - b)
    const n = vals.length
    const q1 = vals[Math.floor(n * 0.25)]
    const q3 = vals[Math.floor(n * 0.75)]
    const median = vals[Math.floor(n * 0.5)]
    stats.set(key, { median, q1, q3, iqr: q3 - q1 })
  }

  // Replace outliers with median
  return paramsList.map((p) => {
    const out = { ...p }
    for (const key of tonalKeys) {
      const s = stats.get(key)!
      const lo = s.q1 - 1.5 * s.iqr
      const hi = s.q3 + 1.5 * s.iqr
      if (out[key] < lo || out[key] > hi) {
        out[key] = s.median
      }
    }
    return out
  })
}
