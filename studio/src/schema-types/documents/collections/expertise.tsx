import { TagIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'

export const expertiseType = defineType({
  name: 'expertise',
  title: 'Expertise',
  type: 'document',
  icon: TagIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Titre',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 6,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'shortDescription',
      title: 'Description courte',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.max(200),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'description',
    },
    prepare({ title, subtitle }) {
      return {
        title,
        subtitle,
      }
    },
  },
})
