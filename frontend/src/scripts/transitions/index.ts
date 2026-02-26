/**
 * CSS-class-based page fade transition.
 *
 * Uses CSS @keyframes animations (not transitions) for reliability:
 * - Animations play immediately when the class is applied
 * - No need to force-reflow for the "from" state
 * - Works on freshly-inserted DOM elements (after Astro swap)
 *
 * The keyframes are defined in globals.css.
 */

export const FADE_OUT_CLASS = 'page-fade-out'
export const FADE_IN_CLASS = 'page-fade-in'

/** Fade duration in ms — keep in sync with the CSS animation value in globals.css. */
export const FADE_DURATION_MS = 300

/**
 * Fade the element out by adding the exit animation class.
 * Resolves after the animation duration.
 */
export function fadeOut(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    el.classList.add(FADE_OUT_CLASS)
    setTimeout(resolve, FADE_DURATION_MS)
  })
}
