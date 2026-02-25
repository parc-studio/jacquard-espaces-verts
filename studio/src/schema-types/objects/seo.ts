import { defineField, defineType } from 'sanity'

export const seoType = defineType({
  name: 'seo',
  title: 'SEO',
  type: 'object',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'SEO title for search engines and social media',
      validation: (Rule) =>
        Rule.max(60).warning('Titles longer than 60 characters may be truncated'),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      description: 'SEO description for search engines and social media',
      validation: (Rule) =>
        Rule.max(160).warning('Descriptions longer than 160 characters may be truncated'),
    }),
    defineField({
      name: 'image',
      title: 'Social Share Image',
      type: 'image',
      description: 'Image for social media sharing (recommended: 1200x630px)',
      options: {
        hotspot: true,
      },
    }),
  ],
})
