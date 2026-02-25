import { ComposeIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'

export const homeSectionTextCtaType = defineType({
  name: 'homeSectionTextCta',
  title: 'Bloc texte avec CTA',
  type: 'object',
  icon: ComposeIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Titre',
      type: 'string',
    }),
    defineField({
      name: 'text',
      title: 'Texte',
      type: 'text',
      rows: 5,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'cta',
      title: 'CTA',
      type: 'cta',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      text: 'text',
    },
    prepare({ title, text }) {
      return {
        title: title || 'Bloc texte',
        subtitle: text || '',
      }
    },
  },
})
