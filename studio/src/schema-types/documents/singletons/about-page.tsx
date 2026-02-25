import { UserIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'
import { mediaAssetSource } from 'sanity-plugin-media'

export const aboutPageType = defineType({
  name: 'aboutPage',
  title: 'Page À propos',
  type: 'document',
  icon: UserIcon,
  fields: [
    defineField({
      name: 'coverImage',
      title: 'Image de couverture',
      type: 'image',
      options: {
        hotspot: true,
        sources: [mediaAssetSource],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'content',
      title: 'Contenu',
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
        title: 'Page À propos',
        subtitle: 'Page À propos',
        media,
      }
    },
  },
})
