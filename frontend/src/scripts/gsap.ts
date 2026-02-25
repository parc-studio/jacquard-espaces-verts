import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type Lenis from 'lenis'

import { getLenis, LENIS_DESTROY_EVENT } from '@/scripts/lenis'

gsap.registerPlugin(ScrollTrigger)

gsap.defaults({
  ease: 'power3.inOut',
  duration: 0.8,
})

let syncedLenis: Lenis | null = null
let tickerCallback: ((time: number) => void) | null = null

export function unsyncLenisWithScrollTrigger(): void {
  if (syncedLenis) {
    syncedLenis.off('scroll', ScrollTrigger.update)
  }

  if (tickerCallback) {
    gsap.ticker.remove(tickerCallback)
    tickerCallback = null
  }

  syncedLenis = null
}

if (typeof window !== 'undefined') {
  window.addEventListener(LENIS_DESTROY_EVENT, unsyncLenisWithScrollTrigger)
}

/**
 * Connect Lenis scroll events to ScrollTrigger and let
 * GSAP's ticker drive Lenis's RAF loop.
 *
 * Must be called AFTER initLenis(). Safe to call multiple
 * times — rewires automatically if the Lenis instance changed.
 */
export function syncLenisWithScrollTrigger(): void {
  const lenis = getLenis()
  if (!lenis) {
    unsyncLenisWithScrollTrigger()
    return
  }
  if (lenis === syncedLenis) return

  // Tear down previous wiring
  unsyncLenisWithScrollTrigger()

  // Wire new instance
  lenis.on('scroll', ScrollTrigger.update)

  tickerCallback = (time: number) => {
    lenis.raf(time * 1000)
  }

  gsap.ticker.add(tickerCallback)
  gsap.ticker.lagSmoothing(0)

  syncedLenis = lenis
}

/**
 * Kill all ScrollTrigger instances.
 * Call before a DOM swap during page transitions.
 */
export function cleanupScrollTriggers(): void {
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill())
}

/**
 * Recalculate all ScrollTrigger positions.
 * Call after new DOM content has rendered.
 */
export function refreshScrollTriggers(): void {
  ScrollTrigger.refresh()
}

export { gsap, ScrollTrigger }
