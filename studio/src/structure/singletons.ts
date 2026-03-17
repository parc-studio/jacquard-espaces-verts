import type { ComponentType } from 'react'
import type { ListItemBuilder, StructureBuilder } from 'sanity/structure'

interface SingletonItemProps {
  S: StructureBuilder
  id?: string
  type: string
  title: string
  icon?: ComponentType
}

export function singletonItem({ S, id, type, title, icon }: SingletonItemProps): ListItemBuilder {
  return S.listItem()
    .id(id ?? type)
    .title(title)
    .icon(icon)
    .child(S.document().schemaType(type).documentId(type).views([S.view.form()]))
}
