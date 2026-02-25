import { ImagesIcon } from '@sanity/icons'
import { defineArrayMember, defineField, defineType } from 'sanity'

export const homeSectionDoubleMediaType = defineType({
  name: 'homeSectionDoubleMedia',
  title: 'Double média',
  type: 'object',
  icon: ImagesIcon,
  fields: [
    defineField({
      name: 'items',
      title: 'Éléments média',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({
              name: 'media',
              title: 'Média',
              type: 'media',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'text',
              title: 'Texte optionnel',
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
                title: text || 'Élément média',
                media,
              }
            },
          },
        }),
      ],
      validation: (Rule) => Rule.required().length(2),
      description: 'Exactement deux éléments média',
    }),
  ],
  preview: {
    select: {
      item0: 'items.0.media.image',
      count: 'items',
    },
    prepare({ item0, count }) {
      return {
        title: 'Bloc double média',
        subtitle: `${count?.length || 0} / 2 éléments`,
        media: item0,
      }
    },
  },
})
