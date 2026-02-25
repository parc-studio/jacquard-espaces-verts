import { ImagesIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'
import { mediaAssetSource } from 'sanity-plugin-media'
import { requiredIfSiblingFalsy } from '../utils/validation'

export const mediaType = defineType({
  name: 'media',
  title: 'Media',
  type: 'object',
  icon: ImagesIcon,
  fields: [
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      description: 'Add an image or choose from the media library',
      options: {
        hotspot: true,
        sources: [mediaAssetSource],
      },
      validation: (rule) =>
        rule.custom(
          requiredIfSiblingFalsy('videoUrl', 'Image is required if no video URL is provided')
        ),
    }),
    defineField({
      name: 'videoUrl',
      title: 'Video URL',
      type: 'url',
      description:
        'External video URL (Vimeo, Mux, .mp4 file). The image will be used as a poster.',
    }),
  ],
  preview: {
    select: {
      media: 'image',
      hasVideo: 'videoUrl',
    },
    prepare({ media, hasVideo }) {
      return {
        title: hasVideo ? 'Video' : 'Image',
        media,
      }
    },
  },
})
