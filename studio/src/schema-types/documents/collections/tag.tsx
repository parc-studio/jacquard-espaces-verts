import { TagIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'

/**
 * Tag document type for categorizing projects
 *
 * TODO: Customize fields as needed (add color, description, etc.)
 */
export const tagType = defineType({
  name: 'tag',
  title: 'Étiquette',
  type: 'document',
  icon: TagIcon,
  fields: [
    defineField({
      name: 'name',
      title: 'Nom',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'name',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {
      title: 'name',
    },
  },
})
