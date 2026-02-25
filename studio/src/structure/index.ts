import {
  BarChartIcon,
  CogIcon,
  CommentIcon,
  DocumentsIcon,
  HomeIcon,
  ProjectsIcon,
  TagIcon,
  UserIcon,
} from '@sanity/icons'
import { isDev } from 'sanity'
import type { StructureResolver } from 'sanity/structure'

import { ProjectOrderPane } from '../components/ProjectOrderPane'
import { singletonItem } from './singletons'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      // ============================================
      // SINGLETONS
      // ============================================
      S.divider({ title: 'Main Content', id: 'main-content-divider', type: 'divider' }),
      singletonItem({
        S,
        type: 'homePage',
        title: 'Home Page',
        icon: HomeIcon,
      }),
      singletonItem({
        S,
        type: 'aboutPage',
        title: 'About Page',
        icon: UserIcon,
      }),
      singletonItem({
        S,
        type: 'projectsIndex',
        title: 'Projects Index',
        icon: ProjectsIcon,
      }),
      singletonItem({
        S,
        type: 'settings',
        title: 'Settings',
        icon: CogIcon,
      }),

      // ============================================
      // COLLECTIONS
      // ============================================
      S.divider({ title: 'Collections', id: 'collections-divider', type: 'divider' }),

      S.listItem()
        .title('Projects')
        .icon(ProjectsIcon)
        .child(S.documentTypeList('project').title('Projects')),

      S.listItem()
        .title('Order Projects')
        .icon(BarChartIcon)
        .id('orderable-projects')
        .child(
          Object.assign(S.documentTypeList('project').serialize(), {
            title: 'Order Projects',
            __preserveInstance: true,
            key: 'orderable-projects',
            type: 'component',
            component: ProjectOrderPane,
            options: {},
            menuItems: [],
          })
        ),

      S.listItem()
        .title('Pages')
        .icon(DocumentsIcon)
        .child(S.documentTypeList('page').title('Pages')),

      // ============================================
      // REFERENCE DATA
      // ============================================
      S.divider({ title: 'References', id: 'references-divider', type: 'divider' }),

      S.listItem().title('Tags').icon(TagIcon).child(S.documentTypeList('tag').title('Tags')),

      S.listItem()
        .title('Expertises')
        .icon(TagIcon)
        .child(S.documentTypeList('expertise').title('Expertises')),

      S.divider(),

      // Feedback
      ...(isDev
        ? [
            S.divider(),
            S.listItem()
              .title('Feedback')
              .icon(CommentIcon)
              .child(
                S.documentTypeList('annotation')
                  .title('Feedback')
                  .defaultOrdering([{ field: '_createdAt', direction: 'desc' }])
              ),
          ]
        : []),
    ])
