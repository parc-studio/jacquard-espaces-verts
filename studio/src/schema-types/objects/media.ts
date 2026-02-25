import { ImagesIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'
import { mediaAssetSource } from 'sanity-plugin-media'
import { requiredIfSiblingFalsy } from '../utils/validation'

export const mediaType = defineType({
  name: 'media',
  title: 'Média',
  type: 'object',
  icon: ImagesIcon,
  fields: [
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      description: 'Ajoutez une image ou choisissez-la depuis la médiathèque',
      options: {
        hotspot: true,
        sources: [mediaAssetSource],
      },
      validation: (rule) =>
        rule.custom(
          requiredIfSiblingFalsy(
            'videoUrl',
            "L'image est obligatoire si aucune URL vidéo n'est fournie"
          )
        ),
    }),
    defineField({
      name: 'videoUrl',
      title: 'URL vidéo',
      type: 'url',
      description:
        "URL vidéo externe (Vimeo, Mux, fichier .mp4). L'image sera utilisée comme affiche.",
    }),
  ],
  preview: {
    select: {
      media: 'image',
      hasVideo: 'videoUrl',
    },
    prepare({ media, hasVideo }) {
      return {
        title: hasVideo ? 'Vidéo' : 'Image',
        media,
      }
    },
  },
})
