import type { OrderableDocument, OrderablePaneConfig } from '../types'

export interface ProjectOrderDocument extends OrderableDocument {
  titre?: string
  slug?: { current?: string }
  heroImageUrl?: string
}

function getProjectLabel(document: ProjectOrderDocument): string {
  const titre = document.titre?.trim()
  if (titre) return titre
  return document._id
}

export const projectOrderConfig: OrderablePaneConfig<ProjectOrderDocument> = {
  type: 'project',
  title: 'Projects',
  apiVersion: '2025-01-12',
  projection: `
    titre,
    slug,
    "heroImageUrl": heroMedia.image.asset->url
  `,
  getItemLabel: getProjectLabel,
  getSearchText: (document) => {
    const name = getProjectLabel(document)
    const slug = document.slug?.current ?? ''
    return `${name} ${slug}`.trim()
  },
  getImageUrl: (document) => document.heroImageUrl,
  getEditPath: (document) => `/structure/all-projects;${document._id.replace(/^drafts\./, '')}`,
}
