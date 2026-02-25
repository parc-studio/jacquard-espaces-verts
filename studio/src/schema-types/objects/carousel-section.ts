import { ImagesIcon } from '@sanity/icons'
import { defineArrayMember, defineField, defineType } from 'sanity'

export const carouselSectionType = defineType({
  name: 'carouselSection',
  title: 'Section carrousel',
  type: 'object',
  icon: ImagesIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Titre',
      type: 'string',
    }),
    defineField({
      name: 'items',
      title: 'Éléments',
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
              name: 'caption',
              title: 'Légende',
              type: 'string',
            }),
          ],
          preview: {
            select: {
              caption: 'caption',
              image: 'media.image',
            },
            prepare({ caption, image }) {
              return {
                title: caption || 'Élément de carrousel',
                media: image,
              }
            },
          },
        }),
      ],
      validation: (Rule) => Rule.min(1),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      items: 'items',
    },
    prepare({ title, items }) {
      return {
        title: title || 'Section carrousel',
        subtitle: `${items?.length || 0} éléments`,
      }
    },
  },
})
