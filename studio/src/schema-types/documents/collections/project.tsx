import { ProjectsIcon } from '@sanity/icons'
import { orderRankField } from '@sanity/orderable-document-list'
import { defineArrayMember, defineField, defineType } from 'sanity'
import { mediaAssetSource } from 'sanity-plugin-media'

/**
 * Project document type
 *
 * Project content model used by the public project page wireframe.
 */
export const projectType = defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  icon: ProjectsIcon,
  fields: [
    orderRankField({ type: 'project' }),
    defineField({
      name: 'titre',
      title: 'Titre',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'titre',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'localisation',
      title: 'Localisation',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'anneeDebut',
      title: 'Année début',
      type: 'number',
      validation: (Rule) => Rule.required().integer(),
    }),
    defineField({
      name: 'anneeFin',
      title: 'Année fin',
      type: 'number',
      validation: (Rule) => Rule.integer().min(1900),
    }),
    defineField({
      name: 'techniques',
      title: 'Techniques',
      type: 'array',
      of: [defineArrayMember({ type: 'string' })],
    }),
    defineField({
      name: 'budget',
      title: 'Budget',
      type: 'number',
    }),
    defineField({
      name: 'aireM2',
      title: 'Aire (m²)',
      type: 'number',
    }),
    defineField({
      name: 'maitreOuvrage',
      title: "Maître d'ouvrage",
      type: 'string',
    }),
    defineField({
      name: 'maitreOeuvre',
      title: "Maître d'œuvre",
      type: 'string',
    }),
    defineField({
      name: 'architecte',
      title: 'Architecte',
      type: 'string',
    }),
    defineField({
      name: 'heroMedia',
      title: 'Hero Media',
      type: 'media',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'mediaCarousel',
      title: 'Media Carousel',
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
            }),
          ],
        }),
      ],
      options: {
        layout: 'grid',
      },
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: 'seo',
      title: 'SEO',
      type: 'seo',
    }),
  ],
  preview: {
    select: {
      titre: 'titre',
      localisation: 'localisation',
      media: 'heroMedia.image',
    },
    prepare({ titre, localisation, media }) {
      return {
        title: titre,
        subtitle: localisation,
        media,
      }
    },
  },
})
