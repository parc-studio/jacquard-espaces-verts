/**
 * Photon WASM adapter — replaces the Canvas 2D OKLab correction pipeline.
 *
 * Lazy-loads the @silvia-odwyer/photon WASM module on first use.
 * All functions that create PhotonImage instances are responsible for
 * calling `.free()` to release WASM linear memory.
 */

import type { CorrectionParams } from './types'

// ---------------------------------------------------------------------------
// Lazy WASM initialisation
// ---------------------------------------------------------------------------

type PhotonModule = typeof import('@silvia-odwyer/photon')

let photonModule: PhotonModule | null = null
let initPromise: Promise<PhotonModule> | null = null

async function initPhoton(): Promise<PhotonModule> {
  if (photonModule) return photonModule
  if (initPromise) return initPromise

  initPromise = (async () => {
    const mod = await import('@silvia-odwyer/photon')
    // Init the WASM module — pass explicit URL so Vite/Sanity serves the
    // binary from /static/ instead of trying to resolve via import.meta.url
    // inside node_modules (which returns an HTML 404).
    await (mod as unknown as { default: (input: string | URL) => Promise<unknown> }).default(
      '/static/photon_rs_bg.wasm'
    )
    photonModule = mod
    return mod
  })()

  return initPromise
}

// ---------------------------------------------------------------------------
// Bridge helpers
// ---------------------------------------------------------------------------

/**
 * Write a PhotonImage back onto a canvas/context pair.
 * Uses the native canvas API instead of Photon's `putImageData`, which
 * consumes (takes ownership of) the PhotonImage and would cause a
 * double-free if the caller also calls `.free()`.
 */
function photonToCanvas(
  image: import('@silvia-odwyer/photon').PhotonImage,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): void {
  const imgData = image.get_image_data()
  canvas.width = imgData.width
  canvas.height = imgData.height
  ctx.putImageData(imgData, 0, 0)
}

// ---------------------------------------------------------------------------
// Colour corrections via Photon
// ---------------------------------------------------------------------------

/**
 * Apply AI-prescribed correction parameters using Photon WASM.
 *
 * Pipeline order (matches the old OKLab pipeline's intent):
 *  1. Temperature / Tint — channel offsets in sRGB
 *  2. Exposure — brightness offset
 *  3. Contrast — contrast factor
 *  4. Auto-levels — normalize (histogram stretch)
 *  5. Highlights / Shadows — selective lightness via raw-pixel pass
 *  6. Whites / Blacks — endpoint lightness via raw-pixel pass
 *  7. Saturation — HSL global chroma
 *  8. Vibrance — selective chroma boost (raw-pixel pass)
 *  9. Clarity — sharpen convolution
 *
 * Mutates the canvas in-place.
 */
export async function applyCorrectionsPhoton(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  params: CorrectionParams
): Promise<void> {
  const ph = await initPhoton()
  let image = ph.open_image(canvas, ctx)

  try {
    // 1. Temperature / Tint — sRGB channel offsets
    //    temperature [-1,1] → warm = +R -B, cool = -R +B
    //    tint [-1,1] → negative = green shift (+G), positive = magenta shift (-G)
    const tempOffset = Math.round(params.temperature * 40)
    const tintOffset = Math.round(params.tint * 25)
    if (tempOffset !== 0 || tintOffset !== 0) {
      ph.alter_channels(image, tempOffset, -tintOffset, -tempOffset)
    }

    // 2. Exposure — brightness offset [-1,1] → [-80,80]
    const brightnessOffset = Math.round(params.exposure * 80)
    if (brightnessOffset !== 0) {
      ph.adjust_brightness(image, brightnessOffset)
    }

    // 3. Contrast — factor [-1,1] → [-80,80]
    const contrastFactor = params.contrast * 80
    if (Math.abs(contrastFactor) > 0.5) {
      ph.adjust_contrast(image, contrastFactor)
    }

    // 4. Auto-levels — histogram stretch (replaces levelsClipLow/High)
    if (params.levelsClipLow > 0.001 || params.levelsClipHigh > 0.005) {
      ph.normalize(image)
    }

    // 5–6. Highlights / Shadows / Whites / Blacks — raw-pixel luminance pass
    const tonalResult = applyTonalAdjustments(image, params)
    if (tonalResult) {
      image.free()
      image = tonalResult
    }

    // 7. Saturation [-1,1] → saturate or desaturate in HSL
    //    Photon expects 0–1 float; pass absolute value directly
    if (params.saturation > 0.005) {
      ph.saturate_hsl(image, params.saturation)
    } else if (params.saturation < -0.005) {
      ph.desaturate_hsl(image, -params.saturation)
    }

    // 8. Vibrance — selective chroma boost on muted colours (raw-pixel pass)
    if (Math.abs(params.vibrance) > 0.005) {
      const vibranceResult = applyVibrance(image, params.vibrance)
      image.free()
      image = vibranceResult
    }

    // 9. Clarity — sharpen convolution (applies a 3×3 kernel)
    if (params.clarity > 0.05) {
      ph.sharpen(image)
    }

    // Write result back to canvas
    photonToCanvas(image, canvas, ctx)
  } finally {
    image.free()
  }
}

// ---------------------------------------------------------------------------
// Raw-pixel passes for params without direct Photon equivalents
// ---------------------------------------------------------------------------

/**
 * Selective lightness adjustments for highlights, shadows, whites, blacks.
 *
 * Operates directly on the RGBA raw pixels via `get_raw_pixels()`.
 * Uses approximate luminance (Rec. 601) to identify tonal regions, then
 * applies additive adjustments scaled by the region mask.
 *
 * Returns a NEW PhotonImage with modified pixels, or `null` if no change
 * was needed. Caller must free the old image when swapping.
 */
function applyTonalAdjustments(
  image: import('@silvia-odwyer/photon').PhotonImage,
  params: CorrectionParams
): import('@silvia-odwyer/photon').PhotonImage | null {
  const { highlights, shadows, whites, blacks } = params

  // Skip if all tonal params are near zero
  if (
    Math.abs(highlights) < 0.005 &&
    Math.abs(shadows) < 0.005 &&
    Math.abs(whites) < 0.005 &&
    Math.abs(blacks) < 0.005
  ) {
    return null
  }

  const raw = image.get_raw_pixels()
  const w = image.get_width()
  const h = image.get_height()
  const n = w * h

  for (let px = 0; px < n; px++) {
    const i = px * 4
    const r = raw[i]
    const g = raw[i + 1]
    const b = raw[i + 2]

    // Rec. 601 luminance [0, 255]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    const lumNorm = lum / 255 // [0, 1]

    let adjustment = 0

    // Shadows: target dark regions (lum < 0.3), strongest at black
    if (shadows !== 0) {
      const shadowMask = Math.max(0, 1 - lumNorm / 0.3)
      adjustment += shadows * 80 * shadowMask * shadowMask
    }

    // Highlights: target bright regions (lum > 0.7), strongest at white
    if (highlights !== 0) {
      const highlightMask = Math.max(0, (lumNorm - 0.7) / 0.3)
      adjustment += highlights * 80 * highlightMask * highlightMask
    }

    // Blacks: target very dark regions (lum < 0.15)
    if (blacks !== 0) {
      const blackMask = Math.max(0, 1 - lumNorm / 0.15)
      adjustment += blacks * 60 * blackMask * blackMask
    }

    // Whites: target very bright regions (lum > 0.85)
    if (whites !== 0) {
      const whiteMask = Math.max(0, (lumNorm - 0.85) / 0.15)
      adjustment += whites * 60 * whiteMask * whiteMask
    }

    if (adjustment !== 0) {
      raw[i] = clamp8(r + adjustment)
      raw[i + 1] = clamp8(g + adjustment)
      raw[i + 2] = clamp8(b + adjustment)
    }
  }

  // Return a new PhotonImage with the modified pixels
  const { PhotonImage } = photonModule!
  return new PhotonImage(raw, w, h)
}

/**
 * Vibrance — selective saturation that boosts muted colours more than vivid ones.
 *
 * Operates on raw pixels. For each pixel, computes approximate saturation
 * (max-min of RGB channels / max), then applies a chroma boost inversely
 * weighted by current saturation.
 *
 * Returns a NEW PhotonImage with modified pixels. Caller must free the old image.
 */
function applyVibrance(
  image: import('@silvia-odwyer/photon').PhotonImage,
  vibrance: number
): import('@silvia-odwyer/photon').PhotonImage {
  const raw = image.get_raw_pixels()
  const w = image.get_width()
  const h = image.get_height()
  const n = w * h
  const strength = vibrance * 1.5

  for (let px = 0; px < n; px++) {
    const i = px * 4
    const r = raw[i]
    const g = raw[i + 1]
    const b = raw[i + 2]

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)

    if (max === 0) continue

    // Approximate saturation [0, 1]
    const sat = (max - min) / max
    // Inverse weight: boost more for low saturation
    const weight = (1 - sat) * strength

    // Shift each channel away from the grey point (average)
    const avg = (r + g + b) / 3
    raw[i] = clamp8(r + (r - avg) * weight)
    raw[i + 1] = clamp8(g + (g - avg) * weight)
    raw[i + 2] = clamp8(b + (b - avg) * weight)
  }

  const { PhotonImage } = photonModule!
  return new PhotonImage(raw, w, h)
}

function clamp8(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v)
}

// ---------------------------------------------------------------------------
// Geometry: straighten via Photon rotate + crop
// ---------------------------------------------------------------------------

/**
 * Apply straightening (rotation + inscribed-rect crop) via Photon WASM.
 *
 * Must be called BEFORE colour corrections because rotation changes
 * the canvas dimensions.
 *
 * Mutates the canvas in-place.
 */
export async function applyGeometryPhoton(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  params: CorrectionParams
): Promise<void> {
  const angle = params.straightenAngle
  if (Math.abs(angle) < 0.05) return

  const ph = await initPhoton()
  const source = ph.open_image(canvas, ctx)
  const srcW = source.get_width()
  const srcH = source.get_height()

  // Photon's rotate() borrows source (does not consume it) and returns a new image
  const rotated = ph.rotate(source, angle)
  source.free()

  try {
    // Compute inscribed rectangle (largest axis-aligned rect fitting inside
    // the rotated original frame without black borders)
    const rad = Math.abs((angle * Math.PI) / 180)
    const cosA = Math.cos(rad)
    const sinA = Math.sin(rad)

    const inscribedW = (srcW * cosA - srcH * sinA) / (cosA * cosA - sinA * sinA)
    const inscribedH = (srcH * cosA - srcW * sinA) / (cosA * cosA - sinA * sinA)

    // Relax crop to preserve more composition (same factor as old pipeline)
    const CROP_RELIEF = 0.22
    const finalW = Math.max(
      1,
      Math.round(Math.min(inscribedW + (srcW - inscribedW) * CROP_RELIEF, srcW))
    )
    const finalH = Math.max(
      1,
      Math.round(Math.min(inscribedH + (srcH - inscribedH) * CROP_RELIEF, srcH))
    )

    // Crop from the centre of the rotated image
    const rotW = rotated.get_width()
    const rotH = rotated.get_height()
    const x1 = Math.round((rotW - finalW) / 2)
    const y1 = Math.round((rotH - finalH) / 2)
    const x2 = x1 + finalW
    const y2 = y1 + finalH

    const cropped = ph.crop(rotated, x1, y1, x2, y2)
    rotated.free()

    // Resize canvas to match cropped dimensions and write result
    canvas.width = cropped.get_width()
    canvas.height = cropped.get_height()
    photonToCanvas(cropped, canvas, ctx)
    cropped.free()
  } catch (err) {
    rotated.free()
    throw err
  }
}
