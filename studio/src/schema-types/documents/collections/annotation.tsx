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
      title: 'Agentation Data',
      type: 'text',
      rows: 12,
      description: 'Full Agentation payload for copy/paste into your local LLM workflow',
      readOnly: true,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'reviewerName',
      title: 'Reviewer',
      type: 'string',
      description: 'Name of the person who created this annotation',
      readOnly: true,
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          { title: 'New', value: 'new' },
          { title: 'In Progress', value: 'in-progress' },
          { title: 'Done', value: 'done' },
        ],
        layout: 'radio',
        direction: 'horizontal',
      },
      initialValue: 'new',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'annotationId',
      title: 'Annotation ID',
      type: 'string',
      description: 'Unique ID from Agentation',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'pageUrl',
      title: 'Page URL',
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
      description: 'Percentage of viewport width (0–100)',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'positionY',
      title: 'Position Y',
      type: 'number',
      description: 'Pixels from document top',
      readOnly: true,
      hidden: true,
    }),
  ],
  orderings: [
    {
      title: 'Newest First',
      name: 'createdAtDesc',
      by: [{ field: '_createdAt', direction: 'desc' }],
    },
    {
      title: 'Status',
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
        status === 'new' ? '🟡 New' : status === 'in-progress' ? '🔵 In Progress' : '✅ Done'

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
      const subtitle = [statusLabel, reviewerName ? `by ${reviewerName}` : '', path]
        .filter(Boolean)
        .join(' · ')

      return {
        title,
        subtitle,
        media: <CommentIcon />,
      }
    },
  },
})
