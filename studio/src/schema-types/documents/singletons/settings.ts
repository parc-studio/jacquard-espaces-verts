import { CogIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'

export const settingsType = defineType({
  name: 'settings',
  title: 'Paramètres',
  type: 'document',
  icon: CogIcon,
  fields: [
    defineField({
      name: 'shortDescription',
      title: 'Description courte',
      type: 'text',
      rows: 2,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'telephone',
      title: 'Téléphone',
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
      name: 'address',
      title: 'Adresse',
      type: 'text',
      rows: 2,
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
        subtitle: 'Paramètres du site',
      }
    },
  },
})
