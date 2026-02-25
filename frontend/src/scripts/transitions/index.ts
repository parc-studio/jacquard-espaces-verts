import { gsap } from '@/scripts/gsap'

// ─── Timing constants ────────────────────────────────────────
const EXIT_FADE_DURATION = 0.4
const ENTER_DURATION = 0.4
const REDUCED_MOTION_DURATION = 0.18
const EASE = 'power3.inOut'

// ─── Types ───────────────────────────────────────────────────

/**
 * Add new transition type names here.
 * Each type must have a matching entry in `exitTimelines` and `enterTimelines`.
 */
export type TransitionType = 'fade' | 'none'

export interface TransitionRuntimeContext {
  fromPath: string
  toPath: string
  isMobile: boolean
  prefersReducedMotion: boolean
}

type TimelineFactory = (
  container: HTMLElement,
  context: TransitionRuntimeContext
) => gsap.core.Timeline

// ─── Helpers ─────────────────────────────────────────────────

/** Maximum time (ms) to wait for any single transition timeline before force-resolving. */
const TRANSITION_TIMEOUT_MS = 2000

/**
 * Returns a Promise that resolves when the timeline completes, or after a safety
 * timeout so a stalled/empty timeline can never block navigation indefinitely.
 *
 * Uses `onComplete` directly rather than `totalDuration()` at call-time so the
 * check is not affected by lazily-added tweens.
 */
function waitForTimeline(timeline: gsap.core.Timeline): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      console.warn('[transitions] Timeline did not complete within timeout — forcing resolve.')
      resolve()
    }, TRANSITION_TIMEOUT_MS)

    timeline.eventCallback('onComplete', () => {
      clearTimeout(timeout)
      resolve()
    })

    timeline.eventCallback('onInterrupt', () => {
      clearTimeout(timeout)
      reject(new Error('Transition timeline was interrupted.'))
    })

    // If the timeline was already complete before we attached the callback
    // (e.g. a zero-duration "none" timeline), resolve immediately.
    if (timeline.totalDuration() === 0 || timeline.progress() === 1) {
      clearTimeout(timeout)
      resolve()
    }
  })
}

const DEFAULT_CONTEXT: TransitionRuntimeContext = {
  fromPath: '/',
  toPath: '/',
  isMobile: false,
  prefersReducedMotion: false,
}

// ─── Exit timelines (animate OLD page out before DOM swap) ───

const exitTimelines: Record<TransitionType, TimelineFactory> = {
  fade(container) {
    return gsap.timeline().to(container, {
      opacity: 0,
      duration: EXIT_FADE_DURATION,
      ease: EASE,
    })
  },

  none() {
    return gsap.timeline()
  },
}

// ─── Enter timelines (animate NEW page in after DOM swap) ────

const enterTimelines: Record<TransitionType, TimelineFactory> = {
  fade(container, context) {
    return gsap.timeline().fromTo(
      container,
      { opacity: 0 },
      {
        opacity: 1,
        duration: context.prefersReducedMotion ? REDUCED_MOTION_DURATION : ENTER_DURATION,
        ease: EASE,
        clearProps: 'opacity',
      }
    )
  },

  none() {
    return gsap.timeline()
  },
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Transition duration values in milliseconds.
 * Import this to synchronise CSS animation timings with GSAP transitions,
 * e.g. for coordinating loading indicators or CSS-driven overlays.
 */
export const transitionSpec = {
  exitFadeMs: EXIT_FADE_DURATION * 1000,
  enterMs: ENTER_DURATION * 1000,
} as const

/**
 * Play the exit animation for a transition type.
 * Resolves when the animation completes.
 */
export async function playExitTransition(
  type: TransitionType,
  container: HTMLElement,
  context: Partial<TransitionRuntimeContext> = {}
): Promise<void> {
  const resolvedContext = { ...DEFAULT_CONTEXT, ...context }
  const timeline = exitTimelines[type](container, resolvedContext)
  await waitForTimeline(timeline)
}

/**
 * Play the enter animation for a transition type.
 * Resolves when the animation completes.
 */
export async function playEnterTransition(
  type: TransitionType,
  container: HTMLElement,
  context: Partial<TransitionRuntimeContext> = {}
): Promise<void> {
  const resolvedContext = { ...DEFAULT_CONTEXT, ...context }
  const timeline = enterTimelines[type](container, resolvedContext)
  await waitForTimeline(timeline)
}
