import { defineArrayMember, defineField, defineType } from 'sanity'
import { CogIcon } from '@sanity/icons'

export const settingsType = defineType({
  name: 'settings',
  title: 'Settings',
  type: 'document',
  icon: CogIcon,
  fields: [
    defineField({
      name: 'shortDescription',
      title: 'Short Description',
      type: 'text',
      rows: 2,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'longDescription',
      title: 'Long Description',
      type: 'text',
      rows: 4,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'expertise',
      title: 'Expertise',
      type: 'array',
      of: [defineArrayMember({ type: 'string' })],
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: 'telephone',
      title: 'Telephone',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'email',
      title: 'Email',
      type: 'string',
      validation: (Rule) => Rule.required().email(),
    }),
    defineField({
      name: 'instagram',
      title: 'Instagram',
      type: 'url',
    }),
    defineField({
      name: 'linkedin',
      title: 'LinkedIn',
      type: 'url',
    }),
  ],
  preview: {
    select: {
      title: 'shortDescription',
    },
    prepare({ title }) {
      return {
        title,
        subtitle: 'Site Settings',
      }
    },
  },
})
