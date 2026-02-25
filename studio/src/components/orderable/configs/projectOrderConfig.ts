import type { OrderableDocument, OrderablePaneConfig } from '../types'

export interface ProjectOrderDocument extends OrderableDocument {
  name?: string
  slug?: { current?: string }
  coverImageUrl?: string
}

function getProjectLabel(document: ProjectOrderDocument): string {
  const name = document.name?.trim()
  if (name) return name
  return document._id
}

export const projectOrderConfig: OrderablePaneConfig<ProjectOrderDocument> = {
  type: 'project',
  title: 'Projects',
  apiVersion: '2025-01-12',
  projection: `
    name,
    slug,
    "coverImageUrl": coverImage.asset->url
  `,
  getItemLabel: getProjectLabel,
  getSearchText: (document) => {
    const name = getProjectLabel(document)
    const slug = document.slug?.current ?? ''
    return `${name} ${slug}`.trim()
  },
  getImageUrl: (document) => document.coverImageUrl,
  getEditPath: (document) => `/structure/all-projects;${document._id.replace(/^drafts\./, '')}`,
}
