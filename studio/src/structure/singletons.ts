import type { StructureBuilder, ListItemBuilder } from 'sanity/structure'
import type { ComponentType } from 'react'

interface SingletonItemProps {
  S: StructureBuilder
  type: string
  title: string
  icon?: ComponentType
}

export function singletonItem({ S, type, title, icon }: SingletonItemProps): ListItemBuilder {
  return S.listItem()
    .title(title)
    .icon(icon)
    .child(S.document().schemaType(type).documentId(type).views([S.view.form()]))
}
