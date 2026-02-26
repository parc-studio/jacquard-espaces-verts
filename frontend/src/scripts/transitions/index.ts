/**
 * Page transition constants.
 *
 * The actual fade animation is handled by the View Transitions API
 * via ::view-transition-old/new(root) CSS in BaseLayout.
 *
 * Keep --transition-duration in tokens.css in sync with this value.
 */

/** Single-phase duration in ms (fade-out OR fade-in). Total transition = 2×. */
export const FADE_DURATION_MS = 300
