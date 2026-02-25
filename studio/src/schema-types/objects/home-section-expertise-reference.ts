import { TagIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'

export const homeSectionExpertiseReferenceType = defineType({
  name: 'homeSectionExpertiseReference',
  title: 'Référence expertise',
  type: 'object',
  icon: TagIcon,
  fields: [
    defineField({
      name: 'expertise',
      title: 'Expertise',
      type: 'reference',
      to: [{ type: 'expertise' }],
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {
      title: 'expertise.title',
      subtitle: 'expertise.description',
    },
    prepare({ title, subtitle }) {
      return {
        title: title || 'Référence expertise',
        subtitle,
      }
    },
  },
})
