import { ProjectsIcon } from '@sanity/icons'
import { orderRankField } from '@sanity/orderable-document-list'
import { defineArrayMember, defineField, defineType } from 'sanity'
import { mediaAssetSource } from 'sanity-plugin-media'

import { ReferenceCheckbox } from '../../../components/ReferenceCheckbox'

/**
 * Project document type
 *
 * A portfolio/case study item with cover image, gallery, and tags.
 * TODO: Rename "Project" to match your content (e.g., "Work", "Case Study", "Talent")
 */
export const projectType = defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  icon: ProjectsIcon,
  fields: [
    orderRankField({ type: 'project' }),
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'name',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'coverImage',
      title: 'Cover Image',
      type: 'image',
      description: 'Main image displayed in listings and as hero',
      options: {
        hotspot: true,
        sources: [mediaAssetSource],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{ type: 'tag' }],
        }),
      ],
      description: 'Categorize this project with tags',
      components: { input: ReferenceCheckbox },
    }),
    defineField({
      name: 'gallery',
      title: 'Image Gallery',
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
              title: 'Caption',
              type: 'string',
              description: 'Optional caption displayed below image',
            }),
          ],
        }),
      ],
      options: {
        layout: 'grid',
      },
    }),
    defineField({
      name: 'sections',
      title: 'Sections',
      type: 'array',
      of: [defineArrayMember({ type: 'carouselSection' })],
      description: 'Additional content sections',
    }),
    defineField({
      name: 'ctas',
      title: 'Call to Actions',
      type: 'array',
      of: [defineArrayMember({ type: 'cta' })],
    }),
    defineField({
      name: 'seo',
      title: 'SEO',
      type: 'seo',
    }),
  ],
  preview: {
    select: {
      name: 'name',
      media: 'coverImage',
      tag0: 'tags.0.name',
      tag1: 'tags.1.name',
    },
    prepare({ name, media, tag0, tag1 }) {
      const tags = [tag0, tag1].filter(Boolean)
      return {
        title: name,
        subtitle: tags.length > 0 ? tags.join(', ') : undefined,
        media,
      }
    },
  },
})
