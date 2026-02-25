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
        locations: [{ title: doc?.title || 'Accueil', href: '/preview' }],
      }),
    }),

    // Collection: Pages use their slug
    page: defineLocations({
      select: { title: 'title', slug: 'slug.current' },
      resolve: (doc) => ({
        locations: [
          {
            title: doc?.title || 'Sans titre',
            href: `/preview/${doc?.slug}`,
          },
        ],
      }),
    }),

    // Singleton: About Page is always at /about
    aboutPage: defineLocations({
      select: { title: 'title' },
      resolve: (doc) => ({
        locations: [{ title: doc?.title || 'À propos', href: '/preview/about' }],
      }),
    }),

    // Collection: Projects live under /projects/
    project: defineLocations({
      select: { title: 'titre', slug: 'slug.current' },
      resolve: (doc) => ({
        locations: [
          {
            title: doc?.title || 'Sans titre',
            href: `/preview/projects/${doc?.slug}`,
          },
          { title: 'Tous les projets', href: '/preview/projects' },
        ],
      }),
    }),

    // Singleton: Settings is used on every page
    settings: defineLocations({
      message: 'Ce document est utilisé sur toutes les pages',
    }),
  },
}
