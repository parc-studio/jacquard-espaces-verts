import { ImagesIcon } from '@sanity/icons'
import { defineArrayMember, defineField, defineType } from 'sanity'

export const homeSectionProjectPairType = defineType({
  name: 'homeSectionProjectPair',
  title: 'Deux références projets',
  type: 'object',
  icon: ImagesIcon,
  fields: [
    defineField({
      name: 'projects',
      title: 'Projets',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{ type: 'project' }],
        }),
      ],
      validation: (Rule) => Rule.required().min(2).max(2).unique(),
      description: 'Sélectionnez exactement deux projets',
    }),
  ],
  preview: {
    select: {
      first: 'projects.0.titre',
      second: 'projects.1.titre',
      media: 'projects.0.mediaGallery.0',
    },
    prepare({ first, second, media }) {
      return {
        title: 'Deux références projets',
        subtitle: [first, second].filter(Boolean).join(' + ') || 'Aucun projet sélectionné',
        media,
      }
    },
  },
})
