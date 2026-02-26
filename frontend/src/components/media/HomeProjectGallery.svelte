<script lang="ts">
  import type { HOME_PAGE_QUERY_RESULT } from '../../../sanity.types'
  import { onMount } from 'svelte'

  import Media from './Media.svelte'

  type HomeSection = NonNullable<HOME_PAGE_QUERY_RESULT>['sections'][number]
  type ProjectReferenceSection = Extract<HomeSection, { _type: 'homeSectionProjectReference' }>
  type GalleryImage = ProjectReferenceSection['project']['mediaGallery'][number]

  interface Props {
    images: GalleryImage[]
    href: string
    title: string
    autoplayIntervalMs?: number
    isLastSection?: boolean
  }

  let { images, href, title, autoplayIntervalMs = 3000, isLastSection = false }: Props = $props()

  let currentIndex = $state(0)
  let isPaused = $state(false)
  let isMobileViewport = $state(false)
  let autoplayTimer: number | null = null

  let visibleDesktopImages = $derived(images.slice(0, 4))
  let desktopColumns = $derived(Math.max(1, Math.min(visibleDesktopImages.length, 4)))

  function stopAutoplay(): void {
    if (autoplayTimer !== null) {
      window.clearInterval(autoplayTimer)
      autoplayTimer = null
    }
  }

  function startAutoplay(): void {
    if (typeof window === 'undefined') return

    stopAutoplay()

    if (!isMobileViewport || isPaused || document.hidden || images.length <= 1) {
      return
    }

    autoplayTimer = window.setInterval(() => {
      currentIndex = (currentIndex + 1) % images.length
    }, autoplayIntervalMs)
  }

  function handlePause(): void {
    isPaused = true
  }

  function handleResume(): void {
    isPaused = false
  }

  $effect(() => {
    if (currentIndex >= images.length && images.length > 0) {
      currentIndex = 0
    }
  })

  $effect(() => {
    if (typeof window === 'undefined') return

    startAutoplay()

    return () => {
      stopAutoplay()
    }
  })

  onMount(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)')

    const updateViewport = () => {
      isMobileViewport = mediaQuery.matches
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopAutoplay()
      } else {
        startAutoplay()
      }
    }

    updateViewport()

    mediaQuery.addEventListener('change', updateViewport)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      mediaQuery.removeEventListener('change', updateViewport)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      stopAutoplay()
    }
  })
</script>

<div class="home-project-gallery" style={`--gallery-columns: ${desktopColumns};`}>
  <div class="home-project-gallery-desktop" aria-label={`Galerie ${title}`}>
    {#each visibleDesktopImages as image (image._key)}
      <a
        {href}
        class={isLastSection
          ? 'home-project-gallery-item is-last-section'
          : 'home-project-gallery-item'}
      >
        <Media media={{ image }} layout="cover" sizes="(max-width: 768px) 100vw, 25vw" />
      </a>
    {/each}
  </div>

  <div
    class="home-project-gallery-mobile"
    aria-label={`Galerie ${title}`}
    role="group"
    onpointerdown={handlePause}
    onpointerup={handleResume}
    onpointercancel={handleResume}
    onpointerleave={handleResume}
  >
    <div
      class="home-project-gallery-track"
      style={`transform: translate3d(-${currentIndex * 100}%, 0, 0);`}
    >
      {#each images as image (image._key)}
        <a
          {href}
          class={isLastSection
            ? 'home-project-gallery-slide is-last-section'
            : 'home-project-gallery-slide'}
        >
          <Media media={{ image }} layout="cover" sizes="100vw" />
        </a>
      {/each}
    </div>
  </div>
</div>

<style>
  .home-project-gallery {
    width: 100%;
    height: 100%;
  }

  .home-project-gallery-desktop {
    display: grid;
    grid-template-columns: repeat(var(--gallery-columns), minmax(0, 1fr));
    width: 100%;
    height: 100%;
    min-height: 50vh;
  }

  .home-project-gallery-item {
    display: block;
    min-height: 50vh;
    overflow: hidden;
  }

  .home-project-gallery-item.is-last-section {
    border-radius: 0 0 var(--size-20) var(--size-20);
  }

  .home-project-gallery-mobile {
    display: none;
    overflow: hidden;
    width: 100%;
    min-height: 50vh;
  }

  .home-project-gallery-track {
    display: flex;
    width: 100%;
    height: 100%;
    transition: transform var(--transition-smooth);
  }

  .home-project-gallery-slide {
    flex: 0 0 100%;
    min-height: 50vh;
    overflow: hidden;
  }

  .home-project-gallery-slide.is-last-section {
    border-radius: 0;
  }

  @media (max-width: 768px) {
    .home-project-gallery-desktop {
      display: none;
    }

    .home-project-gallery-mobile {
      display: block;
    }
  }
</style>
