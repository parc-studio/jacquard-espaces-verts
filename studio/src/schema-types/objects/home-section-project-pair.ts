import { ImagesIcon } from '@sanity/icons'
import { defineArrayMember, defineField, defineType } from 'sanity'

export const homeSectionProjectPairType = defineType({
  name: 'homeSectionProjectPair',
  title: 'Two Projects References',
  type: 'object',
  icon: ImagesIcon,
  fields: [
    defineField({
      name: 'projects',
      title: 'Projects',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{ type: 'project' }],
        }),
      ],
      validation: (Rule) => Rule.required().min(2).max(2).unique(),
      description: 'Select exactly two projects',
    }),
  ],
  preview: {
    select: {
      first: 'projects.0.titre',
      second: 'projects.1.titre',
      media: 'projects.0.heroMedia.image',
    },
    prepare({ first, second, media }) {
      return {
        title: 'Two project references',
        subtitle: [first, second].filter(Boolean).join(' + ') || 'No projects selected',
        media,
      }
    },
  },
})
