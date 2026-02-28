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

  /** On user scroll (touch swipe), derive activeIndex from scroll position */
  function handleScroll() {
    if (isProgrammatic || !viewportEl) return
    clearTimeout(scrollTimer)
    scrollTimer = setTimeout(() => {
      if (!viewportEl) return
      const w = viewportEl.clientWidth
      if (w === 0) return
      const idx = Math.round(viewportEl.scrollLeft / w)
      if (idx !== activeIndex && idx >= 0 && idx < count) {
        activeIndex = idx
      }
    }, 80)
  }

  /** When activeIndex changes (keyboard, thumbnails), scroll to that slide on mobile */
  $effect(() => {
    const idx = activeIndex
    if (!viewportEl || !isSnapActive()) return
    const target = idx * viewportEl.clientWidth
    if (Math.abs(viewportEl.scrollLeft - target) < 2) return
    isProgrammatic = true
    viewportEl.scrollTo({ left: target, behavior: 'smooth' })
    // Release guard after scroll settles
    setTimeout(() => {
      isProgrammatic = false
    }, 500)
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
      <div
        class="carousel-slide"
        class:is-active={i === activeIndex}
        role="group"
        aria-roledescription="slide"
        aria-label="Image {i + 1} sur {count}"
        aria-hidden={i !== activeIndex}
      >
        <Media media={{ image }} layout="cover" sizes="75vw" priority={i === 0} />
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
  }

  .carousel-slide.is-active {
    display: block;
    pointer-events: auto;
    position: relative;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  /* ---- Mobile: scroll-snap carousel ---- */
  @media (max-width: 768px) {
    .carousel-viewport {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none; /* Firefox */
    }

    .carousel-viewport::-webkit-scrollbar {
      display: none; /* Chrome / Safari */
    }

    .carousel-slide {
      position: relative;
      display: block;
      width: 100%;
      height: 100%;
      flex-shrink: 0;
      scroll-snap-align: center;
      pointer-events: auto;
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
