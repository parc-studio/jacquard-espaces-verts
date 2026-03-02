/**
 * Gemini prompt templates for image processing.
 *
 * Each prompt is designed to produce consistent, professional results
 * for landscape architecture portfolio photography.
 */

export const PROMPTS = {
  equalize: `You are a professional photo editor specializing in landscape architecture photography.

Your task: Equalize and enhance the lighting of this outdoor/landscape photograph.

Requirements:
- Balance exposure across the entire image — lift shadows and recover highlights
- Ensure even, natural-looking illumination without harsh contrasts
- Preserve the original colors and atmosphere — do NOT shift color temperature
- Maintain natural-looking vegetation greens and sky blues
- Remove any color casts from mixed lighting
- Keep the image photorealistic — no artistic filters or stylization
- Preserve all architectural and landscape details
- Do NOT crop, rotate, or change the framing in any way
- Do NOT add, remove, or modify any objects in the scene

Output the corrected image at the same resolution and aspect ratio as the input.`,

  cadrage: `You are a professional photo editor specializing in landscape architecture photography composition.

Your task: Improve the framing and composition of this landscape/architectural photograph.

Requirements:
- Analyze the current composition and identify improvements
- Apply rule-of-thirds or golden ratio principles where appropriate
- Straighten any tilted horizons or architectural lines
- Crop to remove distracting elements at the edges while preserving the main subject
- Ensure key landscape or architectural features are well-positioned in the frame
- Maintain a professional, balanced composition
- Preserve the image quality — no artificial sharpening or noise
- Keep the image photorealistic — no artistic filters or stylization
- Do NOT alter lighting, colors, or exposure
- Do NOT add, remove, or modify any objects in the scene

Output the recomposed image. The aspect ratio may change slightly if cropping improves the composition, but preserve as much of the original image as possible.`,
} as const

/** Human-readable labels for processing modes (French) */
export const MODE_LABELS: Record<keyof typeof PROMPTS, string> = {
  equalize: 'Égaliser la lumière',
  cadrage: 'Ajuster le cadrage',
}

/** Short descriptions for processing modes (French) */
export const MODE_DESCRIPTIONS: Record<keyof typeof PROMPTS, string> = {
  equalize:
    'Équilibre l\u2019exposition, adoucit les ombres et récupère les hautes lumières pour un éclairage naturel et homogène.',
  cadrage:
    'Améliore la composition en appliquant les règles de cadrage, redresse les lignes et recadre pour un résultat professionnel.',
}
