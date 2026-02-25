import { defineField, defineType } from 'sanity'
import { UserIcon } from '@sanity/icons'
import { mediaAssetSource } from 'sanity-plugin-media'

export const aboutPageType = defineType({
  name: 'aboutPage',
  title: 'About Page',
  type: 'document',
  icon: UserIcon,
  fields: [
    defineField({
      name: 'coverImage',
      title: 'Cover Image',
      type: 'image',
      options: {
        hotspot: true,
        sources: [mediaAssetSource],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'content',
      title: 'Content',
      type: 'blockContent',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'seo',
      title: 'SEO',
      type: 'seo',
    }),
  ],
  preview: {
    select: {
      media: 'coverImage',
    },
    prepare({ media }) {
      return {
        title: 'About Page',
        subtitle: 'About Page',
        media,
      }
    },
  },
})
