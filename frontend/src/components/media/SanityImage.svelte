<script lang="ts">
  import { urlFor } from '@/utils/sanity/image'
  import type { ExpandedImage } from './types'

  type LayoutMode = 'contain' | 'cover'

  interface Props {
    image: ExpandedImage | null | undefined
    layout?: LayoutMode
    alt?: string
    fallbackAlt?: string
    sizes?: string | null
    priority?: boolean
    aspect?: number
    width?: number
    height?: number
    quality?: number
    class?: string
  }

  let {
    image,
    layout = 'contain',
    alt,
    fallbackAlt = '',
    sizes = '100vw',
    priority = false,
    aspect,
    width,
    height,
    quality = 85,
    class: className = '',
  }: Props = $props()

  /** Breakpoints for srcset – covers up to 2× retina on wide displays */
  const BREAKPOINTS = [640, 750, 828, 1080, 1200, 1920, 2048, 2560, 3840]

  let effectiveAlt = $derived(alt || fallbackAlt || '')
  let dimensions = $derived(image?.asset?.metadata?.dimensions)
  let nativeWidth = $derived(dimensions?.width ?? 3840)
  let aspectRatio = $derived(aspect ?? dimensions?.aspectRatio ?? 4 / 3)

  /** Image source with hotspot/crop for the URL builder */
  let imageSource = $derived.by(() => {
    if (!image?.asset?._id) return null
    return {
      asset: { _ref: image.asset._id },
      hotspot: image.hotspot ?? undefined,
      crop: image.crop ?? undefined,
    }
  })

  /** Build a Sanity CDN URL at a given pixel width (auto-format serves WebP/AVIF) */
  function buildUrl(w: number): string {
    if (!imageSource) return ''
    let builder = urlFor(imageSource).auto('format').quality(quality).width(w)
    if (aspect) {
      builder = builder.height(Math.round(w / aspect)).fit('crop')
    }
    return builder.url()
  }

  let outputWidth = $derived(width ?? nativeWidth)
  let outputHeight = $derived(height ?? Math.round(outputWidth / aspectRatio))

  let srcset = $derived.by(() => {
    if (!imageSource || sizes === null) return undefined
    const bps = BREAKPOINTS.filter((bp) => bp <= nativeWidth)
    if (!bps.includes(nativeWidth) && nativeWidth > 0) bps.push(nativeWidth)
    if (!bps.length) return undefined
    return bps.map((bp) => `${buildUrl(bp)} ${bp}w`).join(', ')
  })

  let src = $derived(imageSource ? buildUrl(Math.min(outputWidth, nativeWidth)) : '')

  let wrapperStyle = $derived(layout === 'contain' ? `--aspect-ratio: ${aspectRatio}` : undefined)
</script>

{#if imageSource}
  <div class="sanity-image {layout} {className}" style={wrapperStyle}>
    <img
      {src}
      {srcset}
      {sizes}
      alt={effectiveAlt}
      width={outputWidth}
      height={outputHeight}
      loading={priority ? 'eager' : 'lazy'}
      fetchpriority={priority ? 'high' : undefined}
      decoding={priority ? 'sync' : 'async'}
    />
  </div>
{/if}

<style>
  .sanity-image {
    position: relative;
    overflow: hidden;
  }

  .sanity-image.contain {
    aspect-ratio: var(--aspect-ratio, auto);
  }

  .sanity-image.cover {
    width: 100%;
    height: 100%;
  }

  img {
    width: 100%;
    height: 100%;
  }

  .contain img {
    object-fit: contain;
  }

  .cover img {
    object-fit: cover;
  }
</style>
