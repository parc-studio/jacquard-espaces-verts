import { ImagesIcon } from '@sanity/icons'
import { defineArrayMember, defineField, defineType } from 'sanity'
import { mediaAssetSource } from 'sanity-plugin-media'

export const homeSectionMediaCarouselType = defineType({
  name: 'homeSectionMediaCarousel',
  title: 'Media Carousel',
  type: 'object',
  icon: ImagesIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
    }),
    defineField({
      name: 'subtitle',
      title: 'Subtitle',
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
              title: 'Optional Text',
              type: 'string',
            }),
          ],
        }),
      ],
      validation: (Rule) => Rule.required().min(2).max(4),
      description: 'Between 2 and 4 images',
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
        title: title || 'Media carousel',
        subtitle: subtitle || `${count?.length || 0} images`,
        media,
      }
    },
  },
})
