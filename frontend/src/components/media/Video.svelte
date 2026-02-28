<script lang="ts">
  import { urlFor } from '@/utils/sanity/image'
  import { stegaClean } from '@sanity/client/stega'
  import type { ExpandedImage } from './types'

  interface Props {
    /** Video URL (Vimeo, Mux, .mp4 file) */
    videoUrl: string
    /** Poster image from Sanity */
    poster?: ExpandedImage | null
    /** Alt text for accessibility */
    alt?: string
    /** Loop video playback */
    loop?: boolean
    /** Fit mode for video */
    fit?: 'contain' | 'cover'
    /** Muted state */
    muted?: boolean
    /** Autoplay video (defaults to false in dev, true in prod) */
    autoplay?: boolean
    /** Show custom controls */
    controls?: boolean
    /** Additional CSS class */
    class?: string
    /** Playsinline for mobile */
    playsinline?: boolean
    /** When false, video is paused even if visible. Defaults to true in prod. */
    isActive?: boolean
  }

  // Disable autoplay in dev to save bandwidth
  const isDev = import.meta.env.DEV

  let {
    videoUrl,
    poster = null,
    alt = 'Video',
    loop = true,
    fit = 'cover',
    muted = true,
    autoplay = isDev ? false : true,
    controls = false,
    playsinline = true,
    class: className = '',
    isActive = isDev ? false : true,
  }: Props = $props()

  // Clean stega-encoded URL
  const cleanUrl = $derived(stegaClean(videoUrl))

  // Video element reference
  let videoEl: HTMLVideoElement | undefined = $state()

  // Playback state
  let isVisible = $state(false)
  let isReady = $state(false)
  let isPaused = $state(true)
  let isMutedLocal = $state<boolean | undefined>(undefined)
  let prevSrc: string | undefined = $state()

  // Derive effective muted state: local override or prop value
  let isMuted = $derived(isMutedLocal ?? muted)

  // Reset ready state and reload when source changes
  $effect(() => {
    if (!videoEl || !cleanUrl) return
    if (cleanUrl === prevSrc) return

    isReady = false
    prevSrc = cleanUrl
    videoEl.load()
  })

  function handleCanPlay() {
    isReady = true
  }

  // IntersectionObserver for viewport visibility
  $effect(() => {
    if (!videoEl) return

    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0].isIntersecting
      },
      { threshold: 0.1 }
    )

    observer.observe(videoEl)
    return () => observer.disconnect()
  })

  // Play/pause based on visibility, readiness, and active state
  $effect(() => {
    if (!videoEl || !autoplay || !isReady) return

    if (isVisible && isActive) {
      videoEl.play().catch(() => {
        // Silently catch autoplay blocks
      })
    } else {
      videoEl.pause()
    }
  })

  // Sync paused state with video element
  $effect(() => {
    if (videoEl) {
      isPaused = videoEl.paused
    }
  })

  // Generate poster URL from Sanity image
  const posterUrl = $derived.by(() => {
    if (!poster?.asset?._id) return undefined
    return urlFor({ _ref: poster.asset._id })
      .width(1920)
      .quality(80)
      .auto('format')
      .fit('max')
      .url()
  })

  // Control handlers
  function togglePlay() {
    if (!videoEl) return
    if (videoEl.paused) {
      videoEl.play().catch(() => {})
    } else {
      videoEl.pause()
    }
    isPaused = videoEl.paused
  }

  function toggleMute() {
    if (!videoEl) return
    videoEl.muted = !videoEl.muted
    isMutedLocal = videoEl.muted
  }
</script>

<div class="video-container {className}" class:has-controls={controls}>
  {#if cleanUrl}
    <video
      bind:this={videoEl}
      src={cleanUrl}
      class="video u-fit-{fit}"
      poster={posterUrl}
      preload="metadata"
      aria-label={alt}
      oncanplay={handleCanPlay}
      onplay={() => (isPaused = false)}
      onpause={() => (isPaused = true)}
      {loop}
      muted={isMuted}
      {playsinline}
    ></video>

    {#if controls}
      <div class="controls" class:visible={controls}>
        <button
          class="control-btn play-btn"
          class:paused={isPaused}
          onclick={togglePlay}
          aria-label={isPaused ? 'Play' : 'Pause'}
        >
          {#if isPaused}
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          {/if}
        </button>

        <button
          class="control-btn mute-btn"
          class:muted={isMuted}
          onclick={toggleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {#if isMuted}
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"
              />
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
              />
            </svg>
          {/if}
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .video-container {
    position: relative;
    width: 100%;
    height: 100%;
    background-color: var(--color-surface);
    overflow: hidden;
  }

  .video {
    display: block;
    width: 100%;
    height: 100%;
  }

  .u-fit-cover {
    object-fit: cover;
  }

  .u-fit-contain {
    object-fit: contain;
  }

  /* Custom controls */
  .controls {
    position: absolute;
    bottom: var(--size-12, 12px);
    left: var(--size-12, 12px);
    display: flex;
    gap: var(--size-8, 8px);
    opacity: 0;
    transition: opacity var(--transition-fast, 0.15s ease);
    pointer-events: none;
  }

  .video-container:hover .controls,
  .video-container:focus-within .controls {
    opacity: 1;
    pointer-events: auto;
  }

  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.6);
    color: white;
    cursor: pointer;
    transition:
      background-color var(--transition-fast, 0.15s ease),
      transform var(--transition-fast, 0.15s ease);
  }

  .control-btn:hover,
  .control-btn:focus-visible {
    background-color: rgba(0, 0, 0, 0.8);
    transform: scale(1.1);
  }

  .control-btn:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  .control-btn svg {
    width: 16px;
    height: 16px;
  }
</style>
