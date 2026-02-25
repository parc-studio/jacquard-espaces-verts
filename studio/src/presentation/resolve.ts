import {
  defineDocuments,
  defineLocations,
  type PresentationPluginOptions,
} from 'sanity/presentation'

// TODO: Update mainDocuments routes and locations to match your actual frontend routes.
// If you add new document types with public pages, add them here too.

export const resolve: PresentationPluginOptions['resolve'] = {
  mainDocuments: defineDocuments([
    {
      route: '/preview',
      type: 'homePage',
    },
    {
      route: '/preview/about',
      type: 'aboutPage',
    },
    {
      route: '/preview/projects',
      type: 'projectsIndex',
    },
    {
      route: '/preview/projects/:slug',
      filter: `_type == "project" && slug.current == $slug`,
    },
    {
      route: '/preview/:slug',
      filter: `_type == "page" && slug.current == $slug`,
    },
  ]),

  locations: {
    // Singleton: Home Page is always at /
    homePage: defineLocations({
      select: { title: 'title' },
      resolve: (doc) => ({
        locations: [{ title: doc?.title || 'Home', href: '/preview' }],
      }),
    }),

    // Collection: Pages use their slug
    page: defineLocations({
      select: { title: 'title', slug: 'slug.current' },
      resolve: (doc) => ({
        locations: [
          {
            title: doc?.title || 'Untitled',
            href: `/preview/${doc?.slug}`,
          },
        ],
      }),
    }),

    // Singleton: About Page is always at /about
    aboutPage: defineLocations({
      select: { title: 'title' },
      resolve: (doc) => ({
        locations: [{ title: doc?.title || 'About', href: '/preview/about' }],
      }),
    }),

    // Singleton: Projects Index is always at /projects
    projectsIndex: defineLocations({
      select: { title: 'title' },
      resolve: (doc) => ({
        locations: [{ title: doc?.title || 'Projects', href: '/preview/projects' }],
      }),
    }),

    // Collection: Projects live under /projects/
    project: defineLocations({
      select: { title: 'name', slug: 'slug.current' },
      resolve: (doc) => ({
        locations: [
          {
            title: doc?.title || 'Untitled',
            href: `/preview/projects/${doc?.slug}`,
          },
          { title: 'All Projects', href: '/preview/projects' },
        ],
      }),
    }),

    // Singleton: Settings is used on every page
    settings: defineLocations({
      message: 'This document is used on all pages',
    }),
  },
}
