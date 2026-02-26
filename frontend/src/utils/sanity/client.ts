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
export const projectId = 'dxjqqptu'

// Dataset name (usually 'production')
export const dataset = 'production'

export const siteUrl = 'https://jacquard-espaces-verts.parc.studio'

// API version (use current date format)
export const apiVersion = '2026-01-01'

export const studioUrl = 'https://admin.jacquard-espaces-verts.parc.studio'

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
