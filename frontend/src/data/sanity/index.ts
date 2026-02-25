/**
 * Sanity Data Fetching Functions
 *
 * Functions for fetching data from Sanity CMS.
 * Automatically handles preview mode with drafts perspective.
 *
 * SCAFFOLDING: Add new data fetching functions here:
 * 1. Create a query in queries.ts
 * 2. Add a function that calls loadQuery with preview support
 */
import { sanityClient } from '@/utils/sanity/client'
import type {
  ABOUT_PAGE_QUERY_RESULT,
  ALL_PAGES_QUERY_RESULT,
  ALL_PROJECTS_QUERY_RESULT,
  HOME_PAGE_QUERY_RESULT,
  PAGE_QUERY_RESULT,
  PROJECT_QUERY_RESULT,
  SETTINGS_QUERY_RESULT,
} from '../../../sanity.types'
import { loadQuery } from './load-query'
import {
  ABOUT_PAGE_QUERY,
  ALL_PAGES_QUERY,
  ALL_PROJECTS_QUERY,
  HOME_PAGE_QUERY,
  PAGE_QUERY,
  PROJECT_QUERY,
  SETTINGS_QUERY,
} from './queries'

// Re-export types and queries
export * from './queries'
export { loadQuery }

/** Options for data fetching functions */
export interface FetchOptions {
  preview?: boolean
}

// =============================================================================
// Simple data fetching helpers
// =============================================================================

/**
 * Fetch data with optional preview mode.
 * In preview mode, uses loadQuery for Visual Editing support.
 * In production, uses direct sanity client fetch.
 */
async function fetchData<T>(
  query: string,
  params: Record<string, unknown> = {},
  options: FetchOptions = {}
): Promise<T | null> {
  if (options.preview) {
    const result = await loadQuery<T>({ query, params, preview: true })
    return result.data
  }
  const data = await sanityClient.fetch<T>(query, params)
  return data
}

// =============================================================================
// Settings
// =============================================================================

export async function getSettings(options: FetchOptions = {}) {
  return fetchData<SETTINGS_QUERY_RESULT>(SETTINGS_QUERY, {}, options)
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

// =============================================================================
// About Page
// =============================================================================

export async function getAboutPage(options: FetchOptions = {}) {
  return fetchData<ABOUT_PAGE_QUERY_RESULT>(ABOUT_PAGE_QUERY, {}, options)
}
