import { ProjectsIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'

export const homeSectionProjectReferenceType = defineType({
  name: 'homeSectionProjectReference',
  title: 'Référence projet',
  type: 'object',
  icon: ProjectsIcon,
  fields: [
    defineField({
      name: 'project',
      title: 'Projet',
      type: 'reference',
      to: [{ type: 'project' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'displayMode',
      title: "Mode d'affichage",
      type: 'string',
      options: {
        list: [
          { title: 'Image plein écran', value: 'fullScreenImage' },
          { title: 'Image carrousel', value: 'carouselImage' },
        ],
        layout: 'radio',
        direction: 'horizontal',
      },
      initialValue: 'fullScreenImage',
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {
      title: 'project.titre',
      mode: 'displayMode',
      media: 'project.mediaGallery.0',
    },
    prepare({ title, mode, media }) {
      return {
        title: title || 'Référence projet',
        subtitle: mode === 'carouselImage' ? 'Mode: Image carrousel' : 'Mode: Image plein écran',
        media,
      }
    },
  },
})
