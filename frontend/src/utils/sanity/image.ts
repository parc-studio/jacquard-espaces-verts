/**
 * Sanity Image URL Builder
 *
 * Returns an ImageUrlBuilder instance for chaining .width(), .height(), etc.
 *
 * @example
 * urlFor(image).width(800).url()
 * urlFor({ _ref: id }).width(1920).quality(80).auto('format').url()
 */

import { createImageUrlBuilder } from '@sanity/image-url'
import { sanityClient } from './client'

const builder = createImageUrlBuilder(sanityClient)

export const urlFor = (source: Parameters<typeof builder.image>[0]) => {
  return builder.image(source)
}
