<script lang="ts">
  import { sanityClient } from '@/utils/sanity/client'
  import Image from '@tylermcrobert/svelte-sanity-image'
  import type { ExpandedImage } from './types'

  /**
   * Image layout modes:
   * - contain: Image maintains aspect ratio, sized to fit within bounds
   * - cover: Image covers the container, may be cropped
   */
  type LayoutMode = 'contain' | 'cover'

  interface Props {
    /** Image object from Sanity GROQ query */
    image: ExpandedImage | null | undefined
    /** Layout mode - 'contain' shows full image, 'cover' fills container */
    layout?: LayoutMode
    /** Custom alt text (falls back to asset.altText, then fallbackAlt) */
    alt?: string
    /** Fallback alt text when no alt is provided (e.g., project name) */
    fallbackAlt?: string
    /** Responsive sizes attribute for srcset */
    sizes?: string | null
    /** Mark as high priority (eager loading, high fetchpriority) */
    priority?: boolean
    /** Custom aspect ratio (overrides image dimensions) */
    aspect?: number
    /** Max width for srcset generation */
    width?: number
    /** Max height for srcset generation */
    height?: number
    /** Image quality (1-100) */
    quality?: number
    /** Additional CSS class(es) to apply to wrapper */
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
    quality = 80,
    class: className = '',
  }: Props = $props()

  // Derive the effective alt text with fallback chain
  // Priority: prop alt > fallbackAlt
  let effectiveAlt = $derived(alt || fallbackAlt || '')

  // Get dimensions from asset metadata
  let dimensions = $derived(image?.asset?.metadata?.dimensions)

  // Calculate aspect ratio: custom > image dimensions > default
  let aspectRatio = $derived(aspect ?? dimensions?.aspectRatio ?? 4 / 3)

  // Build image source object for the library
  // The library expects { asset: { _ref } } but can also work with _id
  let imageSource = $derived.by(() => {
    if (!image?.asset?._id) return null

    return {
      asset: { _ref: image.asset._id },
      hotspot: image.hotspot ?? undefined,
      crop: image.crop ?? undefined,
    }
  })

  let wrapperStyle = $derived(layout === 'contain' ? `--aspect-ratio: ${aspectRatio}` : undefined)
</script>

{#if imageSource}
  <div class="sanity-image {layout} {className}" style={wrapperStyle}>
    <Image
      client={sanityClient}
      image={imageSource}
      alt={effectiveAlt}
      {sizes}
      {quality}
      loading={priority ? 'eager' : 'lazy'}
      fetchpriority={priority ? 'high' : undefined}
      {width}
      {height}
      {aspect}
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

  .sanity-image :global(img) {
    width: 100%;
    height: 100%;
  }

  .sanity-image.contain :global(img) {
    object-fit: contain;
  }

  .sanity-image.cover :global(img) {
    object-fit: cover;
  }
</style>
