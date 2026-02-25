/**
 * Sanity Client Configuration
 *
 * Centralized Sanity client setup for the frontend.
 * These values are imported by astro.config.ts and other files.
 *
 * TODO: Update these values for your project.
 */

import { createClient } from '@sanity/client'

// Sanity project ID (from sanity.io/manage)
export const projectId = 'xycs2vyu'

// Dataset name (usually 'production')
export const dataset = 'production'

// TODO: Replace with your production site URL
export const siteUrl = 'https://astro-svelte-sanity.parc.studio'

// API version (use current date format)
export const apiVersion = '2026-01-01'

// TODO: Replace with your Sanity Studio URL for Visual Editing
export const studioUrl = 'https://admin.astro-svelte-sanity.parc.studio'

/**
 * Sanity client instance
 *
 * Used for fetching published content.
 * For preview/draft content, use loadQuery() with { preview: true }
 */
export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  stega: {
    studioUrl,
  },
})
