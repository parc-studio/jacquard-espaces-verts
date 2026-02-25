/**
 * Sanity Image Builder
 *
 * Helper for generating optimized image URLs from Sanity assets.
 */

import { createImageUrlBuilder } from '@sanity/image-url'
import { sanityClient } from './client'

export const imageBuilder = createImageUrlBuilder(sanityClient)

/**
 * Build an image URL from a Sanity image reference
 *
 * @example
 * const url = urlFor(image).width(800).url()
 */
export const urlFor = (source: Parameters<typeof imageBuilder.image>[0]) => {
  return imageBuilder.image(source)
}
