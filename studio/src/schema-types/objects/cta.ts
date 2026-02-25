import { LinkIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'

export const ctaType = defineType({
  name: 'cta',
  title: 'Call to Action',
  type: 'object',
  icon: LinkIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'link',
      title: 'Link',
      type: 'link',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      linkType: 'link.type',
    },
    prepare({ title, linkType }) {
      const subtitles: Record<string, string> = {
        internal: 'Internal link',
        external: 'External link',
        email: 'Email link',
        phone: 'Phone link',
      }
      return {
        title,
        subtitle: subtitles[linkType] ?? 'No link',
      }
    },
  },
})
