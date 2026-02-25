import { ImageIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'

export const homeSectionMediaType = defineType({
  name: 'homeSectionMedia',
  title: 'Média',
  type: 'object',
  icon: ImageIcon,
  fields: [
    defineField({
      name: 'media',
      title: 'Média',
      type: 'media',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'text',
      title: 'Texte optionnel',
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
        title: text || 'Bloc média',
        subtitle: 'Média unique avec texte optionnel',
        media,
      }
    },
  },
})
