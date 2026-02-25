import { ImagesIcon } from '@sanity/icons'
import { defineArrayMember, defineField, defineType } from 'sanity'
import { mediaAssetSource } from 'sanity-plugin-media'

export const homeSectionMediaCarouselType = defineType({
  name: 'homeSectionMediaCarousel',
  title: 'Carrousel média',
  type: 'object',
  icon: ImagesIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Titre',
      type: 'string',
    }),
    defineField({
      name: 'subtitle',
      title: 'Sous-titre',
      type: 'string',
    }),
    defineField({
      name: 'images',
      title: 'Images',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'image',
          options: {
            hotspot: true,
            sources: [mediaAssetSource],
          },
          fields: [
            defineField({
              name: 'caption',
              title: 'Texte optionnel',
              type: 'string',
            }),
          ],
        }),
      ],
      validation: (Rule) => Rule.required().min(2).max(4),
      description: 'Entre 2 et 4 images',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'subtitle',
      media: 'images.0',
      count: 'images',
    },
    prepare({ title, subtitle, media, count }) {
      return {
        title: title || 'Carrousel média',
        subtitle: subtitle || `${count?.length || 0} images`,
        media,
      }
    },
  },
})
