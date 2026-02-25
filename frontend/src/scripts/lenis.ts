import Lenis from 'lenis'

declare global {
  interface Window {
    lenis: Lenis | null
  }
}

let lenis: Lenis | null = null
export const LENIS_DESTROY_EVENT = 'lenis:destroy'

/**
 * Create a new Lenis smooth-scroll instance.
 * RAF is NOT started here — GSAP's ticker drives lenis.raf()
 * via syncLenisWithScrollTrigger() in gsap.ts.
 */
export function initLenis(): Lenis {
  if (lenis) lenis.destroy()

  lenis = new Lenis({
    autoRaf: false,
  })

  window.lenis = lenis
  return lenis
}

export function getLenis(): Lenis | null {
  return lenis
}

/**
 * Tear down the Lenis instance and remove it from the window.
 * Call this when fully unmounting the app or before a hard navigation
 * that bypasses Astro's View Transitions (e.g. external redirects).
 * For soft navigations within the app, initLenis() re-initialises automatically.
 */
export function destroyLenis(): void {
  window.dispatchEvent(new Event(LENIS_DESTROY_EVENT))

  if (lenis) {
    lenis.destroy()
    lenis = null
    window.lenis = null
  }
}
