/**
 * Link field fragment (sanity-plugin-link-field)
 * Spreads the internal link reference to include _type, slug, and title.
 */
export const linkFragment = `
  ...,
  internalLink->{ _type, _id, "slug": slug.current, title }
`

export const seoFragment = `
  seo {
    title,
    description,
    image
  }
`

/**
 * Image fragment for Sanity images with LQIP support
 * Works with both standalone images and media.image
 */
export const imageFragment = `
  asset->{
    _id,
    url,
    mimeType,
    metadata {
      lqip,
      dimensions { width, height, aspectRatio }
    }
  },
  hotspot,
  crop
`

/**
 * Media object fragment (image + optional videoUrl)
 */
export const mediaFragment = `
  image { ${imageFragment} },
  videoUrl
`

export const ctaFragment = `
  title,
  link { ${linkFragment} }
`

export const tagFragment = `
  _id,
  _type,
  name,
  "slug": slug.current
`

/**
 * Gallery item - inline image with alt and caption
 */
export const galleryItemFragment = `
  _key,
  ${imageFragment},
  caption
`

/**
 * Block content fragment
 * Expands markDefs so link annotations resolve internal references.
 * Use this wherever a blockContent field is projected.
 */
export const blockContentFragment = `
  ...,
  markDefs[] {
    ...,
    _type == "link" => { ${linkFragment} }
  }
`

export const projectFragment = `
  _id,
  _type,
  name,
  slug,
  coverImage { ${imageFragment} },
  description
`

export const projectDetailFragment = `
  ${projectFragment},
  gallery[] {
    ${galleryItemFragment}
  },
  tags[]->{
    ${tagFragment}
  },
  ${seoFragment}
`
