<script lang="ts">
  import { getLenis } from '@/scripts/lenis'
  import type { PROJECT_QUERY_RESULT, Slug } from '../../../sanity.types'
  import Media from '../media/Media.svelte'
  import ProjectCarousel from '../media/ProjectCarousel.svelte'

  type Project = NonNullable<PROJECT_QUERY_RESULT>

  interface NextProject {
    titre: string
    slug: Slug
    localisation: string
    anneeDebut: number
    anneeFin: number | null
  }

  interface Props {
    project: Project
    nextProject?: NextProject | null
  }

  let { project, nextProject }: Props = $props()

  let activeIndex = $state(0)
  let heroEl: HTMLElement | undefined = $state()

  function captureHeroRef(node: HTMLElement) {
    heroEl = node
  }

  const galleryImages = $derived(project.mediaGallery ?? [])
  const imageCount = $derived(galleryImages.length)

  function prevSlide() {
    activeIndex = (activeIndex - 1 + imageCount) % imageCount
  }

  function nextSlide() {
    activeIndex = (activeIndex + 1) % imageCount
  }

  const infoCol1 = $derived(
    [
      {
        label: 'Budget',
        value: project.budget ? `${project.budget.toLocaleString('fr-FR')} €` : null,
      },
      {
        label: 'Expertises',
        values: project.expertises?.map((e) => e.title).filter(Boolean) ?? [],
      },
      {
        label: 'Techniques',
        values: project.techniques ?? [],
      },
      {
        label: 'Aire',
        value: project.aireM2 ? `${project.aireM2.toLocaleString('fr-FR')} m²` : null,
      },
    ].filter((row) => ('values' in row ? (row.values?.length ?? 0) > 0 : !!row.value))
  )

  const infoCol2 = $derived(
    [
      { label: "Maître d'ouvrage", value: project.maitreOuvrage },
      { label: "Maître d'œuvre", value: project.maitreOeuvre },
      { label: 'Architecte', value: project.architecte },
    ].filter((row) => !!row.value)
  )

  const yearDisplay = $derived(
    project.anneeFin ? `${project.anneeDebut}–${project.anneeFin}` : `${project.anneeDebut}`
  )

  const nextYearDisplay = $derived(
    nextProject
      ? nextProject.anneeFin
        ? `${nextProject.anneeDebut}–${nextProject.anneeFin}`
        : `${nextProject.anneeDebut}`
      : ''
  )

  function scrollToInfo() {
    const lenis = getLenis()
    if (lenis) {
      lenis.scrollTo('#project-info', { offset: 0 })
    } else {
      document.getElementById('project-info')?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  function scrollToHeroWithSlide(index: number) {
    activeIndex = index
    const lenis = getLenis()
    if (lenis) {
      lenis.scrollTo(heroEl ?? '#project-hero', { offset: 0 })
    } else {
      heroEl?.scrollIntoView({ behavior: 'smooth' })
    }
  }
</script>

<!-- Section 1: Hero -->
<section class="project-hero" id="project-hero" use:captureHeroRef>
  <div class="hero-sidebar">
    <div class="hero-sidebar-top">
      <a href="/" class="back-link">← retour</a>
      <h1 class="project-title">{project.titre}</h1>
      <div class="project-meta">
        {#if project.localisation}
          <p class="project-location">{project.localisation}</p>
        {/if}
        <p class="project-year">{yearDisplay}</p>
      </div>
    </div>
    <button class="info-cta" onclick={scrollToInfo}> Informations </button>
  </div>

  <div class="hero-carousel">
    <ProjectCarousel images={galleryImages} bind:activeIndex />
  </div>

  {#if imageCount > 1}
    <button
      class="carousel-zone carousel-zone-prev"
      onclick={prevSlide}
      aria-label="Image précédente"
    >
      <span class="visually-hidden">Précédent</span>
    </button>
    <button
      class="carousel-zone carousel-zone-next"
      onclick={nextSlide}
      aria-label="Image suivante"
    >
      <span class="visually-hidden">Suivant</span>
    </button>
  {/if}
</section>

<!-- Section 2: Info -->
<section class="project-info" id="project-info">
  <div class="info-content">
    <div class="info-grid">
      {#if infoCol1.length > 0}
        <div class="info-col info-col-1">
          {#each infoCol1 as row (row.label)}
            <div class="info-row">
              <dt>{row.label}</dt>
              {#if 'values' in row && (row.values?.length ?? 0) > 0}
                <dd>
                  {#each row.values as val, vi (vi)}
                    <span class="info-value-item">{val}</span>
                  {/each}
                </dd>
              {:else if 'value' in row && row.value}
                <dd>{row.value}</dd>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
      {#if infoCol2.length > 0}
        <div class="info-col info-col-2">
          {#each infoCol2 as row (row.label)}
            <div class="info-row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    {#if galleryImages.length > 1}
      <div class="project-thumbs">
        {#each galleryImages as image, i (image._key)}
          <button
            class="thumb"
            class:is-active={i === activeIndex}
            onclick={() => scrollToHeroWithSlide(i)}
            aria-label="Voir l'image {i + 1}"
          >
            <Media media={{ image }} layout="cover" sizes="75px" />
          </button>
        {/each}
      </div>
    {/if}
  </div>

  {#if nextProject}
    <div class="next-project">
      <a href="/projects/{nextProject.slug?.current}" class="next-project-link">
        <span class="next-project-label">Prochain projet →</span>
        <span class="next-project-title">{nextProject.titre}</span>
        <span class="next-project-meta">
          {#if nextProject.localisation}
            <span>{nextProject.localisation}</span>
          {/if}
          <span>{nextYearDisplay}</span>
        </span>
      </a>
    </div>
  {/if}
</section>

<style>
  /* ================================================================
     Section 1: Hero (100vh)
     ================================================================ */
  .project-hero {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: subgrid;
    height: 100vh;
    background: var(--color-white);
    position: relative;
  }

  .hero-sidebar {
    grid-column: 1 / span 3;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: var(--size-20);
    position: relative;
    z-index: 2;
  }

  .hero-sidebar-top {
    display: flex;
    flex-direction: column;
    gap: var(--size-16);
  }

  .back-link {
    font-size: var(--text-12);
    text-transform: uppercase;
    text-decoration: none;
    color: var(--color-black);
    width: fit-content;
  }

  .back-link:hover,
  .back-link:focus-visible {
    opacity: 0.6;
  }

  .project-title {
    font-size: var(--text-16);
    font-weight: var(--font-weight-500);
    text-transform: uppercase;
    line-height: var(--line-height-125);
  }

  .project-meta {
    display: flex;
    flex-direction: column;
    gap: var(--size-10);
  }

  .project-location,
  .project-year {
    font-size: var(--text-16);
    font-weight: var(--font-weight-500);
    text-transform: uppercase;
    line-height: var(--line-height-125);
  }

  .info-cta {
    font-size: var(--text-12);
    text-transform: uppercase;
    text-decoration: underline;
    color: var(--color-black);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    font-weight: var(--font-weight-500);
    font-family: inherit;
    font-feature-settings: inherit;
  }

  .info-cta:hover,
  .info-cta:focus-visible {
    opacity: 0.6;
  }

  .hero-carousel {
    grid-column: 4 / -1;
    position: relative;
    overflow: hidden;
  }

  .carousel-zone {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 50%;
    background: none;
    border: none;
    z-index: 1;
    padding: 0;
    margin: 0;
    -webkit-tap-highlight-color: transparent;
  }

  .carousel-zone:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  .carousel-zone-prev {
    left: 0;
    cursor: w-resize;
  }

  .carousel-zone-next {
    right: 0;
    cursor: e-resize;
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

  /* ================================================================
     Section 2: Info
     ================================================================ */
  .project-info {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: subgrid;
    background: var(--color-white);
    border-radius: 0 0 20px 20px;
    padding-bottom: var(--size-40);
    min-height: 100vh;
    align-content: end;
  }

  .info-content {
    grid-column: 1 / span 7;
    display: flex;
    flex-direction: column;
    gap: var(--size-16);
    padding-left: var(--size-20);
    padding-bottom: var(--size-20);
  }

  .info-grid {
    display: flex;
    gap: var(--size-64);
  }

  .info-col {
    display: flex;
    flex-direction: column;
    gap: var(--size-10);
  }

  .info-col-1 {
    min-width: 300px;
  }

  .info-row {
    display: flex;
    gap: var(--size-10);
  }

  .info-row dt {
    font-size: var(--text-16);
    font-weight: var(--font-weight-500);
    text-transform: capitalize;
    line-height: var(--line-height-125);
    min-width: 164px;
    flex-shrink: 0;
  }

  .info-row dd {
    font-size: var(--text-16);
    line-height: var(--line-height-125);
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--size-10);
  }

  .info-value-item {
    display: block;
  }

  /* Thumbnails */
  .project-thumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 13px;
  }

  .thumb {
    width: 75px;
    height: 60px;
    overflow: hidden;
    cursor: pointer;
    border: none;
    padding: 0;
    background: none;
    flex-shrink: 0;
    opacity: 0.7;
    transition: opacity var(--transition-fast);
  }

  .thumb.is-active {
    opacity: 1;
  }

  .thumb:hover,
  .thumb:focus-visible {
    opacity: 1;
  }

  .thumb:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  /* Next project CTA */
  .next-project {
    grid-column: 10 / -1;
    align-self: end;
    padding: var(--size-20);
  }

  .next-project-link {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--size-16);
    text-decoration: none;
    color: var(--color-black);
  }

  .next-project-link:hover,
  .next-project-link:focus-visible {
    opacity: 0.6;
  }

  .next-project-label {
    font-size: var(--text-12);
    text-transform: uppercase;
  }

  .next-project-title {
    font-size: var(--text-16);
    font-weight: var(--font-weight-500);
    text-transform: uppercase;
    text-align: right;
    line-height: var(--line-height-125);
  }

  .next-project-meta {
    display: flex;
    flex-direction: column;
    gap: var(--size-10);
    text-align: right;
    font-size: var(--text-16);
    font-weight: var(--font-weight-500);
    text-transform: uppercase;
    line-height: var(--line-height-125);
  }

  /* ================================================================
     Mobile
     ================================================================ */
  @media (max-width: 768px) {
    .project-hero {
      display: flex;
      flex-direction: column;
      height: 100vh;
      position: relative;
    }

    .hero-sidebar {
      position: absolute;
      inset: 0;
      z-index: 2;
      padding: var(--size-20);
    }

    .hero-sidebar-top {
      gap: var(--size-16);
    }

    .project-title {
      font-size: var(--text-14);
      line-height: 1.15;
    }

    .project-location,
    .project-year {
      font-size: var(--text-14);
      line-height: 1.15;
    }

    .project-meta {
      gap: 5px;
    }

    .info-cta {
      font-size: var(--text-12);
      text-align: center;
    }

    .hero-carousel {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--size-96) var(--size-20) var(--size-40);
    }

    .carousel-zone {
      display: none;
    }

    .project-info {
      display: flex;
      flex-direction: column;
      min-height: auto;
      padding-bottom: 0;
    }

    .info-content {
      padding: var(--size-20);
      order: 1;
    }

    .info-grid {
      flex-direction: column;
      gap: var(--size-40);
    }

    .info-col-1 {
      min-width: 0;
    }

    .info-row dt {
      min-width: 140px;
      font-size: var(--text-14);
    }

    .info-row dd {
      font-size: var(--text-14);
    }

    .project-thumbs {
      flex-wrap: nowrap;
      overflow-x: auto;
      gap: var(--size-10);
      padding-bottom: var(--size-8);
    }

    .next-project {
      order: 2;
      padding: var(--size-20);
    }

    .next-project-title {
      font-size: var(--text-14);
    }

    .next-project-meta {
      font-size: var(--text-14);
      gap: 5px;
    }
  }
</style>
