<script lang="ts">
  import { onMount } from 'svelte'
  import type { HOME_PAGE_QUERY_RESULT } from '../../../sanity.types'

  import Media from './Media.svelte'

  type HomeSection = NonNullable<HOME_PAGE_QUERY_RESULT>['sections'][number]
  type ProjectReferenceSection = Extract<HomeSection, { _type: 'homeSectionProjectReference' }>
  type GalleryImage = ProjectReferenceSection['project']['mediaGallery'][number]
  type Expertise = NonNullable<ProjectReferenceSection['project']['expertises']>[number]

  interface Props {
    images: GalleryImage[]
    href: string
    title: string
    location?: string
    anneeDebut?: number
    anneeFin?: number | null
    expertises?: Expertise[] | null
    autoplayIntervalMs?: number
  }

  let {
    images,
    href,
    title,
    location = '',
    anneeDebut,
    anneeFin,
    expertises,
    autoplayIntervalMs = 3000,
  }: Props = $props()

  let yearsLabel = $derived.by(() => {
    if (!anneeDebut) return ''
    if (anneeFin && anneeFin !== anneeDebut) return `${anneeDebut}–${anneeFin}`
    return `${anneeDebut}`
  })

  let subtitle = $derived.by(() => {
    const parts: string[] = []
    if (location) parts.push(location)
    if (yearsLabel) parts.push(yearsLabel)
    return parts.join(', ')
  })

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
  {#if expertises?.length}
    <div class="gallery-expertises">
      {#each expertises as expertise (expertise._id)}
        <span class="gallery-expertise-label">{expertise.title}</span>
      {/each}
    </div>
  {/if}

  <div class="home-project-gallery-desktop" aria-label={`Galerie ${title}`}>
    {#each visibleDesktopImages as image (image._key)}
      <a {href} class="home-project-gallery-item">
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
        <a {href} class="home-project-gallery-slide">
          <Media media={{ image }} layout="cover" sizes="100vw" />
        </a>
      {/each}
    </div>
  </div>

  <div class="gallery-info">
    <span class="gallery-info-title">{title}</span>
    {#if subtitle}
      <span class="gallery-info-subtitle">{subtitle}</span>
    {/if}
  </div>
</div>

<style>
  .home-project-gallery {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--size-40);
    width: 100%;
    padding-block: 100px;
    background: var(--color-white);
  }

  .gallery-expertises {
    display: flex;
    gap: var(--size-10);
    justify-content: center;
    text-align: center;
    text-transform: uppercase;
    font-size: var(--text-16);
    font-weight: var(--font-weight-500);
    line-height: 1.125;
    font-feature-settings: var(--font-feature-settings-default);
  }

  .gallery-expertise-label {
    white-space: nowrap;
  }

  .home-project-gallery-desktop {
    display: flex;
    width: 100%;
  }

  .home-project-gallery-item {
    display: block;
    flex: 1 0 0;
    aspect-ratio: 500 / 400;
    overflow: hidden;
  }

  .home-project-gallery-mobile {
    display: none;
    overflow: hidden;
    width: 100%;
  }

  .home-project-gallery-track {
    display: flex;
    width: 100%;
    height: 100%;
    transition: transform var(--transition-smooth);
  }

  .home-project-gallery-slide {
    flex: 0 0 100%;
    aspect-ratio: 500 / 400;
    overflow: hidden;
  }

  .gallery-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--size-10);
    text-align: center;
    text-transform: uppercase;
    font-size: var(--text-16);
    font-weight: var(--font-weight-500);
    line-height: 1.125;
    font-feature-settings: var(--font-feature-settings-default);
  }

  .gallery-info-title,
  .gallery-info-subtitle {
    color: var(--color-black);
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
