import { ImagesIcon } from '@sanity/icons'
import { defineArrayMember, defineField, defineType } from 'sanity'

export const homeSectionDoubleMediaType = defineType({
  name: 'homeSectionDoubleMedia',
  title: 'Double Media',
  type: 'object',
  icon: ImagesIcon,
  fields: [
    defineField({
      name: 'items',
      title: 'Media Items',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({
              name: 'media',
              title: 'Media',
              type: 'media',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'text',
              title: 'Optional Text',
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
                title: text || 'Media item',
                media,
              }
            },
          },
        }),
      ],
      validation: (Rule) => Rule.required().length(2),
      description: 'Exactly two media items',
    }),
  ],
  preview: {
    select: {
      item0: 'items.0.media.image',
      count: 'items',
    },
    prepare({ item0, count }) {
      return {
        title: 'Double media block',
        subtitle: `${count?.length || 0} / 2 items`,
        media: item0,
      }
    },
  },
})
