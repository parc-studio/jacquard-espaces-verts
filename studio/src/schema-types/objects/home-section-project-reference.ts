import { ProjectsIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'

export const homeSectionProjectReferenceType = defineType({
  name: 'homeSectionProjectReference',
  title: 'Project Reference',
  type: 'object',
  icon: ProjectsIcon,
  fields: [
    defineField({
      name: 'project',
      title: 'Project',
      type: 'reference',
      to: [{ type: 'project' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'displayMode',
      title: 'Display Mode',
      type: 'string',
      options: {
        list: [
          { title: 'Full Screen Image', value: 'fullScreenImage' },
          { title: 'Carousel Image', value: 'carouselImage' },
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
      media: 'project.heroMedia.image',
    },
    prepare({ title, mode, media }) {
      return {
        title: title || 'Project reference',
        subtitle: mode === 'carouselImage' ? 'Mode: Carousel Image' : 'Mode: Full Screen Image',
        media,
      }
    },
  },
})
