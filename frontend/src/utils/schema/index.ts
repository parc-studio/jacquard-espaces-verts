/**
 * Schema.org JSON-LD graph builder
 *
 * Builds structured data graphs for each page type using @jdevalk/seo-graph-core.
 * Jacquard Espaces Verts is a landscaping company — modeled as a LocalBusiness.
 */
import {
  assembleGraph,
  buildBreadcrumbList,
  buildPiece,
  buildSiteNavigationElement,
  buildWebPage,
  buildWebSite,
  makeIds,
  type GraphEntity,
} from '@jdevalk/seo-graph-core'

import { siteUrl } from '@/utils/sanity/client'

const SITE_URL = siteUrl
const SITE_NAME = 'Jacquard Espaces Verts'

export const ids = makeIds({ siteUrl: SITE_URL })

/** Organization ID for the company */
const orgId = ids.organization('jacquard')

/** Site-wide entities included on every page */
function siteWideEntities() {
  return [
    buildPiece({
      '@type': 'LocalBusiness',
      '@id': orgId,
      name: SITE_NAME,
      url: SITE_URL,
      sameAs: ['https://www.instagram.com/jacquard_espacesverts/'],
    }),
    buildWebSite(
      {
        url: `${SITE_URL}/`,
        name: SITE_NAME,
        publisher: { '@id': orgId },
        inLanguage: 'fr-FR',
      },
      ids
    ),
    buildSiteNavigationElement(
      {
        name: 'Navigation principale',
        isPartOf: { '@id': ids.website },
        items: [
          { name: 'Accueil', url: `${SITE_URL}/` },
          { name: 'À propos', url: `${SITE_URL}/about` },
        ],
      },
      ids
    ),
  ]
}

export interface SchemaGraphOptions {
  pageType: 'home' | 'about' | 'project' | 'projectsIndex' | 'page' | 'notFound'
  url: string
  title: string
  description?: string
}

/** Build a complete JSON-LD @graph for a given page */
export function buildSchemaGraph(opts: SchemaGraphOptions) {
  const pieces = [...siteWideEntities()]
  const { url, title } = opts

  switch (opts.pageType) {
    case 'home':
      pieces.push(
        buildWebPage(
          {
            url,
            name: title,
            isPartOf: { '@id': ids.website },
            about: { '@id': orgId },
            inLanguage: 'fr-FR',
          },
          ids,
          'CollectionPage'
        )
      )
      break

    case 'about':
      pieces.push(
        buildWebPage(
          {
            url,
            name: title,
            isPartOf: { '@id': ids.website },
            about: { '@id': orgId },
            breadcrumb: { '@id': ids.breadcrumb(url) },
            inLanguage: 'fr-FR',
          },
          ids,
          'ProfilePage'
        ),
        buildBreadcrumbList(
          {
            url,
            items: [
              { name: 'Accueil', url: `${SITE_URL}/` },
              { name: 'À propos', url },
            ],
          },
          ids
        )
      )
      break

    case 'project':
      pieces.push(
        buildWebPage(
          {
            url,
            name: title,
            isPartOf: { '@id': ids.website },
            breadcrumb: { '@id': ids.breadcrumb(url) },
            inLanguage: 'fr-FR',
          },
          ids
        ),
        buildBreadcrumbList(
          {
            url,
            items: [
              { name: 'Accueil', url: `${SITE_URL}/` },
              { name: 'Projets', url: `${SITE_URL}/projects` },
              { name: title, url },
            ],
          },
          ids
        )
      )
      break

    case 'projectsIndex':
      pieces.push(
        buildWebPage(
          {
            url,
            name: title,
            isPartOf: { '@id': ids.website },
            breadcrumb: { '@id': ids.breadcrumb(url) },
            inLanguage: 'fr-FR',
          },
          ids,
          'CollectionPage'
        ),
        buildBreadcrumbList(
          {
            url,
            items: [
              { name: 'Accueil', url: `${SITE_URL}/` },
              { name: 'Projets', url },
            ],
          },
          ids
        )
      )
      break

    default:
      pieces.push(
        buildWebPage(
          {
            url,
            name: title,
            isPartOf: { '@id': ids.website },
            inLanguage: 'fr-FR',
          },
          ids
        )
      )
  }

  return assembleGraph(pieces as GraphEntity[])
}
