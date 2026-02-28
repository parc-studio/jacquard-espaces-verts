<script lang="ts">
  import SanityImage from './SanityImage.svelte'
  import type { ExpandedImage } from './types'
  import Video from './Video.svelte'

  interface MediaObject {
    image?: ExpandedImage | null
    videoUrl?: string | null
  }

  interface Props {
    /** Media object from Sanity GROQ query */
    media: MediaObject | null | undefined
    /** Layout mode - 'contain' shows full media, 'cover' fills container */
    layout?: 'contain' | 'cover'
    /** Custom alt text (falls back to asset.altText, then fallbackAlt) */
    alt?: string
    /** Fallback alt text when no alt is provided */
    fallbackAlt?: string
    /** Responsive sizes attribute for srcset (images only) */
    sizes?: string | null
    /** Mark as high priority for eager loading (images only) */
    priority?: boolean
    /** Additional CSS class(es) */
    class?: string
    /** Video-specific: loop playback */
    loop?: boolean
    /** Video-specific: muted state */
    muted?: boolean
    /** Video-specific: autoplay (defaults to false in dev, true in prod) */
    autoplay?: boolean
    /** Video-specific: show custom controls */
    controls?: boolean
    /** Video-specific: pause even if visible */
    isActive?: boolean
  }

  let {
    media,
    layout = 'contain',
    alt,
    fallbackAlt = '',
    sizes = '100vw',
    priority = false,
    class: className = '',
    loop = true,
    muted = true,
    autoplay,
    controls = false,
    isActive,
  }: Props = $props()

  // Determine what type of media we have
  let hasVideo = $derived(!!media?.videoUrl)
  let hasImage = $derived(!!media?.image?.asset)

  // Log error if media has no content
  $effect(() => {
    if (media && !hasVideo && !hasImage) {
      console.error('[Media] Media object has no video URL or image asset:', media)
    }
  })
</script>

{#if hasVideo && media?.videoUrl}
  <!-- Video with optional image as poster -->
  <Video
    videoUrl={media.videoUrl}
    poster={media.image}
    alt={alt || fallbackAlt}
    fit={layout}
    {loop}
    {muted}
    {autoplay}
    {controls}
    {isActive}
    class={className}
  />
{:else if hasImage && media?.image}
  <!-- Image only -->
  <SanityImage
    image={media.image}
    {layout}
    {alt}
    {fallbackAlt}
    {sizes}
    {priority}
    class={className}
  />
{/if}
