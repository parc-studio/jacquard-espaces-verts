import { LinkIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'

export const ctaType = defineType({
  name: 'cta',
  title: "Appel à l'action",
  type: 'object',
  icon: LinkIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Titre',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'link',
      title: 'Lien',
      type: 'link',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      linkType: 'link.type',
    },
    prepare({ title, linkType }) {
      const subtitles: Record<string, string> = {
        internal: 'Lien interne',
        external: 'Lien externe',
        email: 'Lien e-mail',
        phone: 'Lien téléphone',
      }
      return {
        title,
        subtitle: subtitles[linkType] ?? 'Aucun lien',
      }
    },
  },
})
