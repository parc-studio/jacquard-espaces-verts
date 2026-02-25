import { defineArrayMember, defineField, defineType } from 'sanity'
import { ProjectsIcon } from '@sanity/icons'

export const projectsIndexType = defineType({
  name: 'projectsIndex',
  title: 'Projects Index',
  type: 'document',
  icon: ProjectsIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'filters',
      title: 'Filters',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{ type: 'tag' }],
        }),
      ],
      description: 'Select tags to use as filters on the projects page',
    }),
    defineField({
      name: 'seo',
      title: 'SEO',
      type: 'seo',
    }),
  ],
  preview: {
    select: {
      title: 'title',
    },
    prepare({ title }) {
      return {
        title,
        subtitle: 'Projects Index',
        media: <ProjectsIcon />,
      }
    },
  },
})
