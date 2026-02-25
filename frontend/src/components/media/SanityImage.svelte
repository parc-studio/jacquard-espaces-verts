<script lang="ts">
  import { sanityClient } from '@/utils/sanity/client'
  import Image from '@tylermcrobert/svelte-sanity-image'
  import type { PROJECT_QUERY_RESULT } from '../../../sanity.types'

  type ExpandedImage = NonNullable<PROJECT_QUERY_RESULT>['coverImage']

  /**
   * LQIP (Low Quality Image Placeholder) display options
   */
  type LqipMode = 'blur' | 'color' | 'none'

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
    /** LQIP placeholder mode */
    lqip?: LqipMode
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
    lqip = 'blur',
    aspect,
    width,
    height,
    quality = 80,
    class: className = '',
  }: Props = $props()

  // Track whether the full image has finished loading so the LQIP can fade out
  let imageLoaded = $state(false)

  // Derive the effective alt text with fallback chain
  // Priority: prop alt > fallbackAlt
  let effectiveAlt = $derived(alt || fallbackAlt || '')

  // Get dimensions from asset metadata
  let dimensions = $derived(image?.asset?.metadata?.dimensions)

  // Calculate aspect ratio: custom > image dimensions > default
  let aspectRatio = $derived(aspect ?? dimensions?.aspectRatio ?? 4 / 3)

  // Get LQIP data URL for placeholder
  let lqipUrl = $derived(
    lqip !== 'none' && image?.asset?.metadata?.lqip ? image.asset.metadata.lqip : null
  )

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

  // Compute wrapper styles
  let wrapperStyle = $derived.by(() => {
    const styles: string[] = []

    if (lqipUrl) {
      styles.push(`--lqip: url(${lqipUrl})`)
    }

    if (layout === 'contain') {
      styles.push(`--aspect-ratio: ${aspectRatio}`)
    }

    return styles.join('; ')
  })

  // Reset loaded state when the image source changes
  $effect(() => {
    void imageSource
    imageLoaded = false
  })
</script>

{#if imageSource}
  <div
    class="sanity-image {layout} {className}"
    class:has-lqip={lqipUrl && lqip === 'blur'}
    class:image-loaded={imageLoaded}
    style={wrapperStyle}
  >
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
      onload={() => (imageLoaded = true)}
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

  /* LQIP blur background */
  .sanity-image.has-lqip::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: var(--lqip);
    background-size: cover;
    background-position: center;
    filter: blur(20px);
    transform: scale(1.1); /* Prevent blur edges showing */
    z-index: 0;
    opacity: 1;
    transition: opacity var(--transition-slow);
  }

  /* Fade out the LQIP once the full image has loaded */
  .sanity-image.has-lqip.image-loaded::before {
    opacity: 0;
  }

  /* Hide LQIP once image loads */
  .sanity-image :global(img) {
    position: relative;
    z-index: 1;
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
