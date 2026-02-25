/**
 * Portable Text — Mark & Annotation Components
 *
 * Decorators: Strong, Em, Code
 * Annotations: Link (sanity-plugin-link-field)
 *
 * To add a new annotation (e.g. highlight):
 * 1. Create marks/Highlight.svelte
 * 2. Export it from this file
 * 3. Add it to the `marks` object in PortableText.svelte
 */
export { default as Strong } from './Strong.svelte'
export { default as Em } from './Em.svelte'
export { default as Code } from './Code.svelte'
export { default as Link } from './Link.svelte'
