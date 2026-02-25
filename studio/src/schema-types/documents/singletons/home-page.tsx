import { HomeIcon } from '@sanity/icons'
import { defineArrayMember, defineField, defineType } from 'sanity'

export const homePageType = defineType({
  name: 'homePage',
  title: "Page d'accueil",
  type: 'document',
  icon: HomeIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Titre',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'sections',
      title: 'Constructeur de page',
      type: 'array',
      of: [
        defineArrayMember({ type: 'homeSectionProjectReference' }),
        defineArrayMember({ type: 'homeSectionProjectPair' }),
        defineArrayMember({ type: 'homeSectionExpertiseReference' }),
      ],
      validation: (Rule) => Rule.required().min(1),
      description: "Construisez la page d'accueil en empilant des blocs de section",
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
        subtitle: "Page d'accueil",
        media: <HomeIcon />,
      }
    },
  },
})
