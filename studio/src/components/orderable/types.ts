export interface OrderableDocument {
  _id: string
  _type: string
  orderRank?: string | null
  hasPublished?: boolean
  [key: string]: unknown
}

export interface OrderablePaneConfig<TDoc extends OrderableDocument = OrderableDocument> {
  type: string
  title: string
  apiVersion: string
  projection: string
  getItemLabel: (doc: TDoc) => string
  getSearchText?: (doc: TDoc) => string
  getImageUrl?: (doc: TDoc) => string | null | undefined
  getEditPath?: (doc: TDoc) => string
}
