import { sanityClient } from '@/utils/sanity/client'
import type { QueryParams } from '@sanity/client'
import { SANITY_READ_TOKEN } from 'astro:env/server'

export interface LoadQueryOptions {
  query: string
  params?: QueryParams
  preview?: boolean
}

export interface LoadQueryResult<T> {
  data: T
  sourceMap?: unknown
  perspective: 'published' | 'drafts'
}

/**
 * Universal fetch wrapper for Sanity queries.
 *
 * When preview is true, fetches draft content with stega encoding for Visual Editing.
 * When preview is false, uses the standard client (cached externally).
 */
export async function loadQuery<T>({
  query,
  params = {},
  preview = false,
}: LoadQueryOptions): Promise<LoadQueryResult<T>> {
  if (preview) {
    if (!SANITY_READ_TOKEN) {
      throw new Error(
        'SANITY_READ_TOKEN is required for preview mode. Add it to your environment variables.'
      )
    }

    const { result, resultSourceMap } = await sanityClient.fetch<T>(query, params, {
      filterResponse: false,
      perspective: 'drafts',
      resultSourceMap: 'withKeyArraySelector',
      stega: true,
      token: SANITY_READ_TOKEN,
      useCdn: false,
    })

    return {
      data: result,
      sourceMap: resultSourceMap,
      perspective: 'drafts',
    }
  }

  // Non-preview: standard fetch (caching handled externally)
  const result = await sanityClient.fetch<T>(query, params)

  return {
    data: result,
    perspective: 'published',
  }
}
