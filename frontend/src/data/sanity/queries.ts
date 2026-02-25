import { defineQuery } from 'groq'
import {
  blockContentFragment,
  projectDetailFragment,
  projectFragment,
  seoFragment,
  tagFragment,
} from './fragments'

export const SETTINGS_QUERY = defineQuery(`*[_type == "settings"][0]`)

export const HOME_PAGE_QUERY = defineQuery(`*[_type == "homePage"][0] {
  _id,
  _type,
  title,
  description,
  content[] { ${blockContentFragment} },
  featuredProjects[]->{ ${projectFragment} },
  ${seoFragment}
}`)

export const PAGE_QUERY = defineQuery(`*[_type == "page" && slug.current == $slug][0] {
  _id,
  _type,
  title,
  slug,
  content[] { ${blockContentFragment} },
  ${seoFragment}
}`)

export const ALL_PAGES_QUERY = defineQuery(`*[_type == "page" && defined(slug.current)] {
  _id,
  title,
  slug
}`)

export const PROJECT_QUERY = defineQuery(`*[_type == "project" && slug.current == $slug][0] {
  ${projectDetailFragment}
}`)

export const ALL_PROJECTS_QUERY =
  defineQuery(`*[_type == "project" && defined(slug.current)] | order(orderRank asc, name asc) {
  ${projectFragment}
}`)

export const ABOUT_PAGE_QUERY = defineQuery(`*[_type == "aboutPage"][0] {
  _id,
  _type,
  title,
  content[] { ${blockContentFragment} },
  ${seoFragment}
}`)

export const PROJECTS_INDEX_QUERY = defineQuery(`*[_type == "projectsIndex"][0] {
  _id,
  _type,
  title,
  filters[]->{ ${tagFragment} },
  ${seoFragment}
}`)
