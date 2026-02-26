import Lenis from 'lenis'

declare global {
  interface Window {
    lenis: Lenis | null
  }
}

let lenis: Lenis | null = null

/**
 * Create a new Lenis smooth-scroll instance.
 */
export function initLenis(): Lenis {
  if (lenis) lenis.destroy()

  lenis = new Lenis({
    autoRaf: true,
    lerp: 0.15,
    wheelMultiplier: 0.9,
    touchMultiplier: 0.9,
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
  if (lenis) {
    lenis.destroy()
    lenis = null
    window.lenis = null
  }
}
