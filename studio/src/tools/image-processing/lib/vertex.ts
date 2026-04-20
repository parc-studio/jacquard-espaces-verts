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

import { applyCorrectionsPhoton, applyGeometryPhoton } from './photon'
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
}

const ANALYSIS_PROMPT = `You are an image analysis model. You will receive two images:
1. A **reference photo** showing the target colour grading and aesthetic (Swiss architectural photography style — neutral tones, slightly undersaturated vegetation, clean highlights).
2. The **input photo** to analyse.

Compare the input to the reference and prescribe fourteen correction values that will bring the input closer to the reference aesthetic.

## Reference image
The reference image shows a landscaped garden or nursery setting photographed in natural daylight. Young deciduous trees with slender trunks are staked along a path edged with grass, bark mulch, and low hedging. A polytunnel or greenhouse structure is visible in the background. The lighting is soft and slightly warm — overcast or late-morning — with gentle, even exposure across the scene.

The overall colour palette is muted and naturalistic. Greens are subdued sage-olive tones, never vivid emerald or neon. Grass, foliage, and hedging all share a restrained, slightly desaturated character with warm-cool balance leaning neutral. Earth tones (bark mulch, paths, soil) are soft brown-grey without heavy contrast. Highlights are clean but not blown; shadows hold detail without being lifted or crushed.

The desired look is calm, naturalistic, softly graded, and gently understated — not punchy, contrasty, or over-processed. Use the actual visual relationship between the input and the reference image, not assumptions about a particular photography style.

Bias strongly toward subtle adjustments. If the input already feels balanced, return values close to zero instead of forcing it toward a stronger processed look. Do not brighten shadows or lift highlights unless the need is visually obvious.

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

## 4. shadows (float, range −1.0 to +1.0)
Shadow recovery. Positive lifts shadows, negative deepens them.
- Deep crushed shadows → +0.20 to +0.35
- Moderate shadow loss → +0.08 to +0.18
- Balanced → +0.02 to +0.10
- Flat lighting / already bright shadows → −0.05 to +0.05

## 5. highlights (float, range −1.0 to +1.0)
Highlight recovery. Negative recovers blown highlights, positive lifts dull highlights.
- Severely blown → −0.15 to −0.30
- Moderate clipping → −0.05 to −0.15
- Well-preserved → +0.02 to +0.08
- Dull / needs lift → +0.08 to +0.16

## 6. whites (float, range −1.0 to +1.0)
Adjust the brightest tones. Positive expands whites (brighter), negative compresses (darker).
- Compare the brightest tones in the input to the reference.
- Most images need −0.20 to +0.20.

## 7. blacks (float, range −1.0 to +1.0)
Adjust the darkest tones. Positive lifts blacks (milky), negative deepens (richer).
- Compare the darkest tones in the input to the reference.
- Most images need −0.20 to +0.20.

## 8. temperature (float, range −0.35 to +0.35)
Blue-yellow white-balance shift. Negative = cooler, positive = warmer.
- The reference image is cool-to-neutral, not cold and not warm.
- Use small negative values if the input is too warm or yellow.
- Use small positive values only if the input is noticeably too cool compared to the reference.
- Most images should stay between −0.12 and +0.08.

## 9. tint (float, range −1.0 to +1.0)
Green–magenta white-balance shift. Negative = green, positive = magenta.
- Fluorescent lighting or green cast → +0.05 to +0.20.
- Magenta cast → −0.05 to −0.20.
- Neutral → 0.0.

## 10. saturation (float, range −0.35 to +0.25)
Global colour intensity. Negative desaturates, positive boosts.
- The reference style is restrained and slightly subdued.
- Keep greens natural and present, but avoid vivid emerald or neon vegetation.
- If foliage is noticeably richer, brighter, or more saturated than the reference, prefer negative values.
- For most exterior scenes with vegetation, stay between −0.18 and 0.00.
- Use small negative values when the input feels too vivid.
- Use small positive values only when the input is duller than the reference overall.

## 11. vibrance (float, range −1.0 to +1.0)
Selective saturation: boosts under-saturated colours more than already-vivid ones.
- If the input has dull muted tones compared to reference → positive (0.05 to 0.25).
- If the input is over-vivid → negative (−0.05 to −0.25).
- The reference style is slightly undersaturated — prefer small negative values.
- Avoid positive vibrance on scenes with healthy grass, shrubs, or tree canopies unless the vegetation is clearly flatter than the reference.

## 12. clarity (float, range −1.0 to +1.0)
Midtone local contrast. Positive adds punch/texture, negative softens.
- Architectural subjects with fine detail → +0.05 to +0.20.
- Already harsh/contrasty midtones → −0.05 to −0.15.
- Most images need 0.0 to +0.15.

## 13. levelsClipLow (float, range 0.000 to 0.020)
Black-point clipping percentile used for auto-levels.
- Lower values preserve more shadow detail.
- Higher values create firmer blacks and a slightly cleaner tonal floor.
- The reference keeps shadow detail, so stay modest.
- Most images should stay between 0.001 and 0.008.

## 14. levelsClipHigh (float, range 0.005 to 0.030)
White-point clipping percentile used for auto-levels.
- Lower values preserve more highlight detail.
- Higher values create cleaner, brighter highlights but can become too crisp.
- The reference has clean highlights without harsh clipping.
- Most images should stay between 0.008 and 0.018.

## Output format
Return a single JSON object with no markdown fences, no extra keys:
{"exposure": <float>, "contrast": <float>, "straightenAngle": <float>, "shadows": <float>, "highlights": <float>, "whites": <float>, "blacks": <float>, "temperature": <float>, "tint": <float>, "saturation": <float>, "vibrance": <float>, "clarity": <float>, "levelsClipLow": <float>, "levelsClipHigh": <float>}`

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
    // Geometry: keep full AI precision — straightening is binary-correct
    straightenAngle: compressed.straightenAngle,
  }
}

// ---------------------------------------------------------------------------
// Reference image — loaded once and cached (used for AI analysis prompt)
// ---------------------------------------------------------------------------

const REFERENCE_IMAGE_PATH = '/image-ref.jpeg'

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

  cachedRefImage = { base64, mimeType: blob.type || 'image/jpeg' }
  return cachedRefImage
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

// ---------------------------------------------------------------------------
// Orchestrator: analyse → correct → export
// ---------------------------------------------------------------------------

function formatParamSummary(params: CorrectionParams): string {
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
 * - Straightening via Photon (rotate + crop)
 * - AI-prescribed colour corrections via Photon WASM
 * - JPEG q=0.97 export
 */
export async function applyImageCorrections(
  imageUrl: string,
  params: CorrectionParams
): Promise<ProcessingResult> {
  // Load full-resolution image into Canvas.
  // Request PNG from the CDN to avoid double-JPEG compression — the only
  // lossy encode should be the final q=0.97 export at the end of this fn.
  const separator = imageUrl.includes('?') ? '&' : '?'
  const srcUrl = `${imageUrl}${separator}fm=png`
  const img = await loadImage(srcUrl)

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Impossible de créer le contexte Canvas 2D.')

  // Draw source image onto an initial canvas
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  ctx.drawImage(img, 0, 0)

  // Phase 1: Straighten via Photon (rotate + crop)
  await applyGeometryPhoton(canvas, ctx, params)

  // Phase 2: Apply AI-prescribed corrections via Photon WASM
  await applyCorrectionsPhoton(canvas, ctx, params)

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

  const paramSummary = formatParamSummary(params)

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
