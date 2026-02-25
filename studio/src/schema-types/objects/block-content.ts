import { defineArrayMember, defineType } from 'sanity'

export const blockContentType = defineType({
  name: 'blockContent',
  title: 'Contenu riche',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [
        { title: 'Normal', value: 'normal' },
        { title: 'H1', value: 'h1' },
        { title: 'H2', value: 'h2' },
        { title: 'H3', value: 'h3' },
        { title: 'H4', value: 'h4' },
        { title: 'Citation', value: 'blockquote' },
      ],
      lists: [
        { title: 'Puces', value: 'bullet' },
        { title: 'Numérotée', value: 'number' },
      ],
      marks: {
        decorators: [
          { title: 'Gras', value: 'strong' },
          { title: 'Italique', value: 'em' },
          { title: 'Code', value: 'code' },
        ],
        annotations: [
          {
            name: 'link',
            type: 'link',
            title: 'Lien',
          },
        ],
      },
    }),
    defineArrayMember({
      type: 'image',
      options: { hotspot: true },
    }),
  ],
})
