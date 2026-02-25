import { defineField, defineType } from 'sanity'

export const seoType = defineType({
  name: 'seo',
  title: 'SEO',
  type: 'object',
  fields: [
    defineField({
      name: 'title',
      title: 'Titre',
      type: 'string',
      description: 'Titre SEO pour les moteurs de recherche et les réseaux sociaux',
      validation: (Rule) =>
        Rule.max(60).warning('Les titres de plus de 60 caractères peuvent être tronqués'),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      description: 'Description SEO pour les moteurs de recherche et les réseaux sociaux',
      validation: (Rule) =>
        Rule.max(160).warning('Les descriptions de plus de 160 caractères peuvent être tronquées'),
    }),
    defineField({
      name: 'image',
      title: 'Image de partage social',
      type: 'image',
      description: 'Image pour le partage sur les réseaux sociaux (recommandé : 1200x630px)',
      options: {
        hotspot: true,
      },
    }),
  ],
})
