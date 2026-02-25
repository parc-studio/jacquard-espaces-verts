import { ImageIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'

export const homeSectionMediaType = defineType({
  name: 'homeSectionMedia',
  title: 'Media',
  type: 'object',
  icon: ImageIcon,
  fields: [
    defineField({
      name: 'media',
      title: 'Media',
      type: 'media',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'text',
      title: 'Optional Text',
      type: 'string',
    }),
  ],
  preview: {
    select: {
      media: 'media.image',
      text: 'text',
    },
    prepare({ media, text }) {
      return {
        title: text || 'Media block',
        subtitle: 'Single media with optional text',
        media,
      }
    },
  },
})
