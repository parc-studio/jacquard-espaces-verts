import { defineArrayMember, defineField, defineType } from 'sanity'
import { HomeIcon } from '@sanity/icons'

export const homePageType = defineType({
  name: 'homePage',
  title: 'Home Page',
  type: 'document',
  icon: HomeIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'sections',
      title: 'Page Builder',
      type: 'array',
      of: [
        defineArrayMember({ type: 'homeSectionMedia' }),
        defineArrayMember({ type: 'homeSectionDoubleMedia' }),
        defineArrayMember({ type: 'homeSectionTextCta' }),
        defineArrayMember({ type: 'homeSectionMediaCarousel' }),
      ],
      validation: (Rule) => Rule.required().min(1),
      description: 'Build the home page by stacking section blocks',
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
        subtitle: 'Home Page',
        media: <HomeIcon />,
      }
    },
  },
})
