import { ComposeIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'

export const homeSectionTextCtaType = defineType({
  name: 'homeSectionTextCta',
  title: 'Text Block with CTA',
  type: 'object',
  icon: ComposeIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
    }),
    defineField({
      name: 'text',
      title: 'Text',
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
        title: title || 'Text block',
        subtitle: text || '',
      }
    },
  },
})
