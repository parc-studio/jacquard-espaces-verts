import { CommentIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'

/**
 * Annotation document type for Agentation feedback
 *
 * Captures UI annotations from the Agentation toolbar during development.
 * Synced in real-time via client-side callbacks so the whole team can
 * triage feedback in Sanity Studio with a New → In Progress → Done workflow.
 */
export const annotationType = defineType({
  name: 'annotation',
  title: 'Annotation',
  type: 'document',
  icon: CommentIcon,
  fields: [
    defineField({
      name: 'content',
      title: 'Données Agentation',
      type: 'text',
      rows: 12,
      description: 'Payload Agentation complet à copier/coller dans votre workflow LLM local',
      readOnly: true,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'reviewerName',
      title: 'Relecteur',
      type: 'string',
      description: 'Nom de la personne qui a créé cette annotation',
      readOnly: true,
    }),
    defineField({
      name: 'status',
      title: 'Statut',
      type: 'string',
      options: {
        list: [
          { title: 'Nouveau', value: 'new' },
          { title: 'En cours', value: 'in-progress' },
          { title: 'Terminé', value: 'done' },
        ],
        layout: 'radio',
        direction: 'horizontal',
      },
      initialValue: 'new',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'annotationId',
      title: "ID de l'annotation",
      type: 'string',
      description: 'ID unique provenant de Agentation',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'pageUrl',
      title: 'URL de la page',
      type: 'url',
      validation: (Rule) =>
        Rule.uri({
          allowRelative: true,
          scheme: ['http', 'https'],
        }),
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'positionX',
      title: 'Position X',
      type: 'number',
      description: 'Pourcentage de la largeur du viewport (0–100)',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'positionY',
      title: 'Position Y',
      type: 'number',
      description: 'Pixels depuis le haut du document',
      readOnly: true,
      hidden: true,
    }),
  ],
  orderings: [
    {
      title: 'Plus récentes en premier',
      name: 'createdAtDesc',
      by: [{ field: '_createdAt', direction: 'desc' }],
    },
    {
      title: 'Statut',
      name: 'statusAsc',
      by: [
        { field: 'status', direction: 'asc' },
        { field: '_createdAt', direction: 'desc' },
      ],
    },
  ],
  preview: {
    select: {
      content: 'content',
      status: 'status',
      pageUrl: 'pageUrl',
      reviewerName: 'reviewerName',
    },
    prepare({ content, status, pageUrl, reviewerName }) {
      const statusLabel =
        status === 'new' ? '🟡 Nouveau' : status === 'in-progress' ? '🔵 En cours' : '✅ Terminé'

      let title = 'Annotation'
      if (typeof content === 'string' && content.trim()) {
        try {
          const parsed = JSON.parse(content)
          if (typeof parsed?.comment === 'string' && parsed.comment.trim()) {
            title = parsed.comment.trim()
          } else {
            title = content.split('\n')[0]?.trim() || 'Annotation'
          }
        } catch {
          title = content.split('\n')[0]?.trim() || 'Annotation'
        }
      }

      let path = ''
      if (pageUrl) {
        try {
          path = pageUrl.startsWith('/') ? pageUrl : new URL(pageUrl).pathname
        } catch {
          path = pageUrl
        }
      }
      const subtitleFr = [statusLabel, reviewerName ? `par ${reviewerName}` : '', path]
        .filter(Boolean)
        .join(' · ')

      return {
        title,
        subtitle: subtitleFr,
        media: <CommentIcon />,
      }
    },
  },
})
