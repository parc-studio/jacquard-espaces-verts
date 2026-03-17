<script lang="ts">
  import type { PROJECT_QUERY_RESULT } from '../../../sanity.types'
  import Media from './Media.svelte'

  type GalleryImage = NonNullable<PROJECT_QUERY_RESULT>['mediaGallery'][number]

  interface Props {
    images: GalleryImage[]
    activeIndex?: number
  }

  let { images, activeIndex = $bindable(0) }: Props = $props()

  let count = $derived(images.length)

  /** Indices of prev/next slides to preload (rendered but hidden) */
  let adjacentIndices = $derived.by(() => {
    if (count < 2) return new Set<number>()
    return new Set([(activeIndex - 1 + count) % count, (activeIndex + 1) % count])
  })

  let viewportEl: HTMLDivElement | undefined = $state()

  /** Guard to ignore scroll events caused by programmatic scrollTo */
  let isProgrammatic = false
  let scrollTimer: ReturnType<typeof setTimeout> | undefined

  function prev() {
    activeIndex = (activeIndex - 1 + count) % count
  }

  function next() {
    activeIndex = (activeIndex + 1) % count
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      prev()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      next()
    }
  }

  /** Detect if scroll-snap layout is active (mobile) */
  function isSnapActive(): boolean {
    return !!viewportEl && viewportEl.scrollWidth > viewportEl.clientWidth
  }

  /** Get the scrollLeft target for a given slide index using its offsetLeft */
  function slideOffsetLeft(idx: number): number {
    if (!viewportEl) return 0
    const slide = viewportEl.children[idx] as HTMLElement | undefined
    return slide?.offsetLeft ?? 0
  }

  /** On user scroll (touch swipe), derive activeIndex from the nearest slide by offsetLeft */
  function handleScroll() {
    if (isProgrammatic || !viewportEl) return
    clearTimeout(scrollTimer)
    scrollTimer = setTimeout(() => {
      if (!viewportEl) return
      const scrollLeft = viewportEl.scrollLeft
      const slides = Array.from(viewportEl.children) as HTMLElement[]
      let nearest = 0
      let minDist = Infinity
      slides.forEach((slide, i) => {
        const dist = Math.abs(slide.offsetLeft - scrollLeft)
        if (dist < minDist) {
          minDist = dist
          nearest = i
        }
      })
      if (nearest !== activeIndex && nearest >= 0 && nearest < count) {
        activeIndex = nearest
      }
    }, 80)
  }

  /** When activeIndex changes (keyboard, thumbnails), scroll to that slide on mobile */
  $effect(() => {
    const idx = activeIndex
    if (!viewportEl || !isSnapActive()) return
    const target = slideOffsetLeft(idx)
    if (Math.abs(viewportEl.scrollLeft - target) < 2) return
    isProgrammatic = true
    viewportEl.scrollTo({ left: target, behavior: 'smooth' })
    // Release guard after scroll settles
    setTimeout(() => {
      isProgrammatic = false
    }, 500)
  })

  /** Force-decode adjacent images so the bitmap is ready before the slide becomes active */
  $effect(() => {
    // Subscribe to activeIndex so this re-runs on navigation
    void activeIndex
    if (!viewportEl) return

    const imgs = viewportEl.querySelectorAll<HTMLImageElement>('.carousel-slide.is-adjacent img')

    for (const img of imgs) {
      const decode = () => img.decode().catch(() => {})
      if (img.complete) {
        decode()
      } else {
        img.addEventListener('load', decode, { once: true })
      }
    }
  })
</script>

<svelte:window onkeydown={handleKeydown} />

<section
  class="project-carousel"
  aria-label="Galerie d'images du projet"
  aria-roledescription="carousel"
>
  <div class="carousel-viewport" bind:this={viewportEl} onscroll={handleScroll}>
    {#each images as image, i (image._key)}
      {@const isActive = i === activeIndex}
      {@const isAdjacent = adjacentIndices.has(i)}
      <div
        class="carousel-slide"
        class:is-active={isActive}
        class:is-adjacent={!isActive && isAdjacent}
        role="group"
        aria-roledescription="slide"
        aria-label="Image {i + 1} sur {count}"
        aria-hidden={!isActive}
      >
        <Media media={image} layout="cover" sizes="100vw" priority={i === 0} />
      </div>
    {/each}
  </div>
</section>

<style>
  .project-carousel {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .project-carousel:focus-visible {
    outline: none;
  }

  .carousel-viewport {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .carousel-slide {
    position: absolute;
    inset: 0;
    display: none;
    pointer-events: none;
    height: 100%;
  }

  /* Adjacent slides: rendered so the browser loads + decodes images ahead of time */
  .carousel-slide.is-adjacent {
    display: block;
    visibility: hidden;
  }

  .carousel-slide.is-active {
    display: block;
    pointer-events: auto;
    position: relative;
  }

  /* ---- Mobile: scroll-snap carousel with peek ---- */
  @media (max-width: 768px) {
    .project-carousel {
      overflow: visible;
    }

    .carousel-viewport {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none; /* Firefox */
      /* Peek: next slide slightly visible on the right */
      padding-right: var(--size-12);
      padding-left: var(--size-12);
    }

    .carousel-viewport::-webkit-scrollbar {
      display: none; /* Chrome / Safari */
    }

    .carousel-slide {
      position: relative;
      display: block;
      /* Narrower than viewport so the next slide peeks */
      width: calc(100% - var(--size-12));
      height: 100%;
      flex-shrink: 0;
      scroll-snap-align: center;
      pointer-events: auto;
      padding-inline: var(--size-4);
      visibility: visible;
    }

    /* Switch to contain so images aren't cropped and sit centered */
    .carousel-slide :global(.sanity-image.cover) {
      height: 100%;
    }

    .carousel-slide :global(.sanity-image.cover img) {
      object-fit: contain;
    }
  }
</style>
