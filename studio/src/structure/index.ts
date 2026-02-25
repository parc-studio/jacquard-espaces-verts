import {
  // BarChartIcon,
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

// import { ProjectOrderPane } from '../components/ProjectOrderPane'
import { singletonItem } from './singletons'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Contenu')
    .items([
      // ============================================
      // SINGLETONS
      // ============================================
      S.divider({ title: 'Contenu principal', id: 'main-content-divider', type: 'divider' }),
      singletonItem({
        S,
        type: 'homePage',
        title: "Page d'accueil",
        icon: HomeIcon,
      }),
      singletonItem({
        S,
        type: 'aboutPage',
        title: 'Page À propos',
        icon: UserIcon,
      }),
      singletonItem({
        S,
        type: 'settings',
        title: 'Paramètres',
        icon: CogIcon,
      }),

      // ============================================
      // COLLECTIONS
      // ============================================
      S.divider({ title: 'Collections', id: 'collections-divider', type: 'divider' }),

      S.listItem()
        .title('Projets')
        .icon(ProjectsIcon)
        .child(S.documentTypeList('project').title('Projets')),

      // S.listItem()
      //   .title('Ordonner les projets')
      //   .icon(BarChartIcon)
      //   .id('orderable-projects')
      //   .child(
      //     Object.assign(S.documentTypeList('project').serialize(), {
      //       title: 'Ordonner les projets',
      //       __preserveInstance: true,
      //       key: 'orderable-projects',
      //       type: 'component',
      //       component: ProjectOrderPane,
      //       options: {},
      //       menuItems: [],
      //     })
      //   ),

      S.listItem()
        .title('Pages')
        .icon(DocumentsIcon)
        .child(S.documentTypeList('page').title('Pages')),

      // ============================================
      // REFERENCE DATA
      // ============================================
      S.divider({ title: 'Références', id: 'references-divider', type: 'divider' }),

      S.listItem()
        .title('Étiquettes')
        .icon(TagIcon)
        .child(S.documentTypeList('tag').title('Étiquettes')),

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
              .title('Retours')
              .icon(CommentIcon)
              .child(
                S.documentTypeList('annotation')
                  .title('Retours')
                  .defaultOrdering([{ field: '_createdAt', direction: 'desc' }])
              ),
          ]
        : []),
    ])
