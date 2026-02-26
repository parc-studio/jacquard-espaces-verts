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
</script>

<svelte:window onkeydown={handleKeydown} />

<section
  class="project-carousel"
  aria-label="Galerie d'images du projet"
  aria-roledescription="carousel"
>
  <div class="carousel-viewport">
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
</style>
