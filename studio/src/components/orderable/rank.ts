import type { PatchOperations } from 'sanity'

import type { OrderableDocument } from './types'

const ORDER_RANK_FIELD = 'orderRank'
const DRAFT_PREFIX = 'drafts.'
const RANK_PREFIX = 'r'
const RANK_PAD_LENGTH = 8

function getBaseId(id: string): string {
  return id.startsWith(DRAFT_PREFIX) ? id.slice(DRAFT_PREFIX.length) : id
}

function compareOrderRank(a: OrderableDocument, b: OrderableDocument): number {
  const aRank = a[ORDER_RANK_FIELD] ?? ''
  const bRank = b[ORDER_RANK_FIELD] ?? ''

  if (aRank < bRank) return -1
  if (aRank > bRank) return 1

  if (a._id < b._id) return -1
  if (a._id > b._id) return 1
  return 0
}

export function dedupeAndSortDocuments<TDoc extends OrderableDocument>(documents: TDoc[]): TDoc[] {
  const byBaseId = new Map<string, TDoc>()

  for (const document of documents) {
    const baseId = getBaseId(document._id)
    const existing = byBaseId.get(baseId)

    if (!existing) {
      byBaseId.set(baseId, { ...document })
      continue
    }

    const existingIsDraft = existing._id.startsWith(DRAFT_PREFIX)
    const incomingIsDraft = document._id.startsWith(DRAFT_PREFIX)

    if (incomingIsDraft && !existingIsDraft) {
      byBaseId.set(baseId, {
        ...document,
        hasPublished: true,
      })
      continue
    }

    if (existingIsDraft && !incomingIsDraft) {
      byBaseId.set(baseId, {
        ...existing,
        hasPublished: true,
      })
    }
  }

  return Array.from(byBaseId.values()).sort(compareOrderRank)
}

function buildSequentialRank(index: number): string {
  return `${RANK_PREFIX}${String(index).padStart(RANK_PAD_LENGTH, '0')}`
}

export function moveDocumentByOffset<TDoc extends OrderableDocument>(
  documents: TDoc[],
  documentId: string,
  offset: number
): TDoc[] {
  const currentIndex = documents.findIndex((document) => document._id === documentId)
  if (currentIndex < 0) return documents

  const nextIndex = currentIndex + offset
  if (nextIndex < 0 || nextIndex >= documents.length) return documents

  const nextDocuments = [...documents]
  const [movedItem] = nextDocuments.splice(currentIndex, 1)
  nextDocuments.splice(nextIndex, 0, movedItem)

  return nextDocuments
}

export function moveDocumentToIndex<TDoc extends OrderableDocument>(
  documents: TDoc[],
  fromIndex: number,
  toIndex: number
): TDoc[] {
  if (fromIndex < 0 || toIndex < 0) return documents
  if (fromIndex >= documents.length || toIndex >= documents.length) return documents
  if (fromIndex === toIndex) return documents

  const nextDocuments = [...documents]
  const [movedItem] = nextDocuments.splice(fromIndex, 1)
  nextDocuments.splice(toIndex, 0, movedItem)

  return nextDocuments
}

export function reassignOrderRanks<TDoc extends OrderableDocument>(documents: TDoc[]): TDoc[] {
  return documents.map((document, index) => ({
    ...document,
    [ORDER_RANK_FIELD]: buildSequentialRank(index),
  }))
}

export function buildOrderRankPatches<TDoc extends OrderableDocument>(
  documents: TDoc[]
): Array<[string, PatchOperations]> {
  const patches: Array<[string, PatchOperations]> = []

  for (const document of documents) {
    const rankValue = document[ORDER_RANK_FIELD]

    if (!rankValue) continue

    patches.push([
      document._id,
      {
        set: {
          [ORDER_RANK_FIELD]: rankValue,
        },
      },
    ])

    // When a draft has a published counterpart, keep both documents in sync so
    // order remains consistent in draft and published perspectives.
    if (document._id.startsWith(DRAFT_PREFIX) && document.hasPublished) {
      patches.push([
        getBaseId(document._id),
        {
          set: {
            [ORDER_RANK_FIELD]: rankValue,
          },
        },
      ])
    }
  }

  return patches
}
