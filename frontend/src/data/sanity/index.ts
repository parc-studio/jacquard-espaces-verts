/**
 * Sanity Data Fetching
 *
 * Single-layer data access for Sanity CMS.
 * Automatically handles preview mode with drafts perspective and stega encoding.
 *
 * SCAFFOLDING: Add new data fetching functions here:
 * 1. Create a query in queries.ts
 * 2. Add a function that calls fetchData with preview support
 */
import { sanityClient } from '@/utils/sanity/client'
import type { QueryParams } from '@sanity/client'
import type {
  ABOUT_PAGE_QUERY_RESULT,
  ALL_EXPERTISES_QUERY_RESULT,
  ALL_PAGES_QUERY_RESULT,
  ALL_PROJECTS_QUERY_RESULT,
  HOME_PAGE_QUERY_RESULT,
  PAGE_QUERY_RESULT,
  PROJECT_QUERY_RESULT,
  SETTINGS_QUERY_RESULT,
  Slug,
} from '../../../sanity.types'
import {
  ABOUT_PAGE_QUERY,
  ALL_EXPERTISES_QUERY,
  ALL_PAGES_QUERY,
  ALL_PROJECTS_QUERY,
  HOME_PAGE_QUERY,
  PAGE_QUERY,
  PROJECT_QUERY,
  SETTINGS_QUERY,
} from './queries'

// Re-export queries for external use
export * from './queries'

/** Options for data fetching functions */
export interface FetchOptions {
  preview?: boolean
}

// =============================================================================
// Core fetch — single layer between consumers and Sanity
// =============================================================================

/**
 * Fetch data from Sanity with optional preview mode.
 *
 * In preview mode, fetches draft content with stega encoding for Visual Editing.
 * In production, uses the standard client (cached externally).
 */
async function fetchData<T>(
  query: string,
  params: QueryParams = {},
  options: FetchOptions = {}
): Promise<T | null> {
  if (options.preview) {
    const { SANITY_READ_TOKEN } = await import('astro:env/server')
    if (!SANITY_READ_TOKEN) {
      throw new Error(
        'SANITY_READ_TOKEN is required for preview mode. Add it to your environment variables.'
      )
    }

    const { result } = await sanityClient.fetch<T>(query, params, {
      filterResponse: false,
      perspective: 'drafts',
      resultSourceMap: 'withKeyArraySelector',
      stega: true,
      token: SANITY_READ_TOKEN,
      useCdn: false,
    })

    return result
  }

  return sanityClient.fetch<T>(query, params)
}

// =============================================================================
// Settings
// =============================================================================

export async function getSettings(options: FetchOptions = {}) {
  return fetchData<SETTINGS_QUERY_RESULT>(SETTINGS_QUERY, {}, options)
}

// =============================================================================
// Expertises
// =============================================================================

export async function getExpertises(options: FetchOptions = {}) {
  return fetchData<ALL_EXPERTISES_QUERY_RESULT>(ALL_EXPERTISES_QUERY, {}, options)
}

// =============================================================================
// Home Page
// =============================================================================

export async function getHomePage(options: FetchOptions = {}) {
  return fetchData<HOME_PAGE_QUERY_RESULT>(HOME_PAGE_QUERY, {}, options)
}

// =============================================================================
// Pages
// =============================================================================

export async function getPage(slug: string, options: FetchOptions = {}) {
  return fetchData<PAGE_QUERY_RESULT>(PAGE_QUERY, { slug }, options)
}

export async function getAllPages(options: FetchOptions = {}) {
  return fetchData<ALL_PAGES_QUERY_RESULT>(ALL_PAGES_QUERY, {}, options)
}

// =============================================================================
// Projects
// =============================================================================

export async function getProject(slug: string, options: FetchOptions = {}) {
  return fetchData<PROJECT_QUERY_RESULT>(PROJECT_QUERY, { slug }, options)
}

export async function getAllProjects(options: FetchOptions = {}) {
  return fetchData<ALL_PROJECTS_QUERY_RESULT>(ALL_PROJECTS_QUERY, {}, options)
}

/** Minimal next-project data for the project page CTA. */
export interface NextProjectData {
  titre: string
  slug: Slug
  localisation: string
  anneeDebut: number
  anneeFin: number | null
}

/**
 * Fetch a project and its circular-list "next project" in one call.
 *
 * Used by both static builds (getStaticPaths) and preview mode.
 */
export async function getProjectWithNext(
  slug: string,
  options: FetchOptions = {}
): Promise<{
  project: PROJECT_QUERY_RESULT | null
  nextProject: NextProjectData | null
}> {
  const [project, allProjects] = await Promise.all([
    getProject(slug, options),
    getAllProjects(options),
  ])

  let nextProject: NextProjectData | null = null
  if (project && allProjects && allProjects.length > 1) {
    const currentIndex = allProjects.findIndex((p) => p.slug?.current === slug)
    if (currentIndex !== -1) {
      const next = allProjects[(currentIndex + 1) % allProjects.length]
      nextProject = {
        titre: next.titre,
        slug: next.slug,
        localisation: next.localisation,
        anneeDebut: next.anneeDebut,
        anneeFin: next.anneeFin,
      }
    }
  }

  return { project, nextProject }
}

// =============================================================================
// About Page
// =============================================================================

export async function getAboutPage(options: FetchOptions = {}) {
  return fetchData<ABOUT_PAGE_QUERY_RESULT>(ABOUT_PAGE_QUERY, {}, options)
}
