import {
  ChevronDownIcon,
  ChevronUpIcon,
  DragHandleIcon,
  LaunchIcon,
  RefreshIcon,
  SearchIcon,
} from '@sanity/icons'
import {
  Box,
  Button,
  Card,
  Flex,
  Inline,
  Spinner,
  Stack,
  Text,
  TextInput,
  useToast,
} from '@sanity/ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useClient } from 'sanity'
import { useRouter } from 'sanity/router'

import {
  buildOrderRankPatches,
  dedupeAndSortDocuments,
  moveDocumentByOffset,
  moveDocumentToIndex,
  reassignOrderRanks,
} from './rank'
import type { OrderableDocument, OrderablePaneConfig } from './types'

interface OrderablePaneProps<TDoc extends OrderableDocument> {
  config: OrderablePaneConfig<TDoc>
}

interface DropTargetState {
  documentId: string
  position: 'before' | 'after'
}

const AUTO_SCROLL_EDGE_SIZE = 72
const AUTO_SCROLL_MAX_SPEED = 18

export function OrderablePane<TDoc extends OrderableDocument>({
  config,
}: OrderablePaneProps<TDoc>) {
  const client = useClient({ apiVersion: config.apiVersion })
  const { navigateUrl } = useRouter()
  const toast = useToast()

  const [documents, setDocuments] = useState<TDoc[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [draggedDocumentId, setDraggedDocumentId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTargetState | null>(null)
  const listScrollContainerRef = useRef<HTMLDivElement | null>(null)
  const autoScrollFrameRef = useRef<number | null>(null)
  const autoScrollSpeedRef = useRef(0)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)

    const query = `*[_type == $type] {
      _id,
      _type,
      orderRank,
      ${config.projection}
    }`

    try {
      const result = await client.fetch<TDoc[]>(query, { type: config.type })
      setDocuments(dedupeAndSortDocuments(result ?? []))
    } catch (error) {
      console.error(error)
      setErrorMessage('Impossible de charger la liste.')
    } finally {
      setLoading(false)
    }
  }, [client, config.projection, config.type])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredDocuments = useMemo(() => {
    if (!normalizedQuery) return documents

    return documents.filter((document) => {
      const text = config.getSearchText
        ? config.getSearchText(document)
        : config.getItemLabel(document)

      return text.toLowerCase().includes(normalizedQuery)
    })
  }, [config, documents, normalizedQuery])

  const isSearchActive = normalizedQuery.length > 0
  const documentIndexMap = useMemo(
    () => new Map(documents.map((document, index) => [document._id, index])),
    [documents]
  )

  const stopAutoScroll = useCallback(() => {
    autoScrollSpeedRef.current = 0

    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current)
      autoScrollFrameRef.current = null
    }
  }, [])

  const startAutoScroll = useCallback((speed: number) => {
    autoScrollSpeedRef.current = speed

    if (autoScrollFrameRef.current !== null) return

    const tick = () => {
      const container = listScrollContainerRef.current
      const nextSpeed = autoScrollSpeedRef.current

      if (!container || nextSpeed === 0) {
        autoScrollFrameRef.current = null
        return
      }

      container.scrollTop += nextSpeed
      autoScrollFrameRef.current = window.requestAnimationFrame(tick)
    }

    autoScrollFrameRef.current = window.requestAnimationFrame(tick)
  }, [])

  const updateAutoScrollFromPointer = useCallback(
    (pointerY: number) => {
      const container = listScrollContainerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const distanceToTop = pointerY - rect.top
      const distanceToBottom = rect.bottom - pointerY

      let speed = 0

      if (distanceToTop >= 0 && distanceToTop < AUTO_SCROLL_EDGE_SIZE) {
        const ratio = (AUTO_SCROLL_EDGE_SIZE - distanceToTop) / AUTO_SCROLL_EDGE_SIZE
        speed = -Math.max(1, Math.round(AUTO_SCROLL_MAX_SPEED * ratio))
      } else if (distanceToBottom >= 0 && distanceToBottom < AUTO_SCROLL_EDGE_SIZE) {
        const ratio = (AUTO_SCROLL_EDGE_SIZE - distanceToBottom) / AUTO_SCROLL_EDGE_SIZE
        speed = Math.max(1, Math.round(AUTO_SCROLL_MAX_SPEED * ratio))
      }

      if (speed === 0) {
        stopAutoScroll()
        return
      }

      startAutoScroll(speed)
    },
    [startAutoScroll, stopAutoScroll]
  )

  const openEditor = useCallback(
    (document: TDoc) => {
      const fallbackPath = `/structure/${config.type};${document._id.replace(/^drafts\./, '')}`
      const path = config.getEditPath ? config.getEditPath(document) : fallbackPath
      navigateUrl({ path })
    },
    [config, navigateUrl]
  )

  const applyOrderedDocuments = useCallback(
    async (nextDocuments: TDoc[]) => {
      if (updating) return
      if (nextDocuments === documents) return

      const rankedDocuments = reassignOrderRanks(nextDocuments)
      const patches = buildOrderRankPatches(rankedDocuments)

      if (!patches.length) return

      setUpdating(true)

      try {
        const transaction = client.transaction()

        for (const [targetId, patchOperations] of patches) {
          transaction.patch(targetId, patchOperations)
        }

        await transaction.commit({
          visibility: 'async',
          tag: `orderable-pane.${config.type}.reorder`,
        })

        setDocuments(rankedDocuments)
        toast.push({
          status: 'success',
          title: 'Ordre mis à jour',
          description: `${config.title} réordonnés avec succès.`,
        })
      } catch (error) {
        console.error(error)
        toast.push({
          status: 'error',
          title: 'Échec du réordonnancement',
          description: 'La mise à jour de l’ordre a échoué.',
        })
      } finally {
        setUpdating(false)
        setDraggedDocumentId(null)
        setDropTarget(null)
        stopAutoScroll()
      }
    },
    [client, config.title, config.type, documents, stopAutoScroll, toast, updating]
  )

  const moveDocument = useCallback(
    async (documentId: string, offset: number) => {
      if (updating || isSearchActive) return

      const movedDocuments = moveDocumentByOffset(documents, documentId, offset)

      await applyOrderedDocuments(movedDocuments)
    },
    [applyOrderedDocuments, documents, isSearchActive, updating]
  )

  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>, documentId: string) => {
      if (updating || isSearchActive) {
        event.preventDefault()
        return
      }

      setDraggedDocumentId(documentId)
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', documentId)
    },
    [isSearchActive, updating]
  )

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>, documentId: string) => {
      if (!draggedDocumentId || updating || isSearchActive) return

      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      updateAutoScrollFromPointer(event.clientY)

      const rect = event.currentTarget.getBoundingClientRect()
      const midpoint = rect.top + rect.height / 2
      const position: DropTargetState['position'] = event.clientY < midpoint ? 'before' : 'after'

      setDropTarget((current) => {
        if (current?.documentId === documentId && current.position === position) {
          return current
        }

        return { documentId, position }
      })
    },
    [draggedDocumentId, isSearchActive, updateAutoScrollFromPointer, updating]
  )

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>, targetDocumentId: string) => {
      event.preventDefault()

      const draggedIdFromDataTransfer = event.dataTransfer.getData('text/plain')
      const sourceDocumentId = draggedDocumentId ?? draggedIdFromDataTransfer

      if (!sourceDocumentId || sourceDocumentId === targetDocumentId) {
        setDraggedDocumentId(null)
        setDropTarget(null)
        stopAutoScroll()
        return
      }

      const sourceIndex = documentIndexMap.get(sourceDocumentId) ?? -1
      const targetIndex = documentIndexMap.get(targetDocumentId) ?? -1

      if (sourceIndex < 0 || targetIndex < 0) {
        setDraggedDocumentId(null)
        setDropTarget(null)
        stopAutoScroll()
        return
      }

      const dropPosition =
        dropTarget?.documentId === targetDocumentId ? dropTarget.position : 'after'

      let destinationIndex = dropPosition === 'before' ? targetIndex : targetIndex + 1

      if (sourceIndex < destinationIndex) {
        destinationIndex -= 1
      }

      destinationIndex = Math.max(0, Math.min(destinationIndex, documents.length - 1))

      const movedDocuments = moveDocumentToIndex(documents, sourceIndex, destinationIndex)
      await applyOrderedDocuments(movedDocuments)
    },
    [
      applyOrderedDocuments,
      documentIndexMap,
      documents,
      draggedDocumentId,
      dropTarget,
      stopAutoScroll,
    ]
  )

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const relatedTarget = event.relatedTarget as Node | null

    if (relatedTarget && event.currentTarget.contains(relatedTarget)) return

    setDropTarget((current) => {
      if (!current) return current
      return null
    })
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedDocumentId(null)
    setDropTarget(null)
    stopAutoScroll()
  }, [stopAutoScroll])

  const handleListDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!draggedDocumentId || updating || isSearchActive) return

      updateAutoScrollFromPointer(event.clientY)
    },
    [draggedDocumentId, isSearchActive, updateAutoScrollFromPointer, updating]
  )

  useEffect(() => {
    if (!draggedDocumentId || updating || isSearchActive) {
      stopAutoScroll()
    }
  }, [draggedDocumentId, isSearchActive, stopAutoScroll, updating])

  useEffect(() => {
    return () => {
      stopAutoScroll()
    }
  }, [stopAutoScroll])

  if (loading) {
    return (
      <Flex align="center" justify="center" style={{ width: '100%', height: '100%' }}>
        <Spinner muted />
      </Flex>
    )
  }

  return (
    <Stack space={3} padding={3}>
      <Inline space={2}>
        <TextInput
          icon={SearchIcon}
          placeholder="Rechercher…"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.currentTarget.value)}
          disabled={updating}
        />
        <Button
          icon={RefreshIcon}
          mode="ghost"
          tone="primary"
          text="Rafraîchir"
          onClick={fetchDocuments}
          disabled={updating}
        />
      </Inline>

      {isSearchActive && (
        <Card tone="transparent" padding={2} radius={0} border>
          <Text size={1} muted>
            Recherche active: le réordonnancement est temporairement désactivé.
          </Text>
        </Card>
      )}

      {errorMessage && (
        <Card tone="critical" padding={2} radius={0}>
          <Text size={1}>{errorMessage}</Text>
        </Card>
      )}

      {!errorMessage && filteredDocuments.length === 0 && (
        <Card tone="transparent" padding={3} radius={0} border>
          <Text size={1} muted>
            Aucun élément trouvé.
          </Text>
        </Card>
      )}

      <Box
        ref={listScrollContainerRef}
        onDragOver={handleListDragOver}
        style={{
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 220px)',
        }}
      >
        <Stack space={0}>
          {filteredDocuments.map((document) => {
            const index = documentIndexMap.get(document._id) ?? -1
            const canMoveUp = index > 0 && !updating && !isSearchActive
            const canMoveDown =
              index >= 0 && index < documents.length - 1 && !updating && !isSearchActive
            const imageUrl = config.getImageUrl ? config.getImageUrl(document) : null
            const dropTargetState = dropTarget?.documentId === document._id ? dropTarget : null
            const isDragging = draggedDocumentId === document._id

            return (
              <Box
                key={document._id}
                onDragOver={(event) => handleDragOver(event, document._id)}
                onDrop={(event) => void handleDrop(event, document._id)}
                onDragLeave={handleDragLeave}
                style={{ position: 'relative' }}
              >
                {dropTargetState?.position === 'before' && (
                  <Box
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      backgroundColor: 'var(--card-focus-ring-color)',
                      zIndex: 2,
                    }}
                  />
                )}

                <Card padding={2} radius={0} border tone={dropTargetState ? 'primary' : 'default'}>
                  <Flex align="center" gap={2}>
                    <Box
                      draggable={!updating && !isSearchActive}
                      onDragStart={(event) => handleDragStart(event, document._id)}
                      onDragEnd={handleDragEnd}
                      style={{
                        cursor: updating || isSearchActive ? 'not-allowed' : 'grab',
                        opacity: isDragging ? 0.5 : 1,
                        display: 'flex',
                      }}
                    >
                      <Text size={2} muted>
                        <DragHandleIcon />
                      </Text>
                    </Box>

                    <Box
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 0,
                        overflow: 'hidden',
                        backgroundColor: 'var(--card-muted-bg-color)',
                        flexShrink: 0,
                      }}
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={config.getItemLabel(document)}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      ) : null}
                    </Box>

                    <Box flex={1}>
                      <Text size={1} weight="medium">
                        {config.getItemLabel(document)}
                      </Text>
                    </Box>

                    <Inline space={1}>
                      <Button
                        icon={ChevronUpIcon}
                        mode="bleed"
                        aria-label="Monter"
                        onClick={() => void moveDocument(document._id, -1)}
                        disabled={!canMoveUp}
                      />
                      <Button
                        icon={ChevronDownIcon}
                        mode="bleed"
                        aria-label="Descendre"
                        onClick={() => void moveDocument(document._id, 1)}
                        disabled={!canMoveDown}
                      />
                      <Button
                        icon={LaunchIcon}
                        mode="bleed"
                        aria-label="Éditer"
                        onClick={() => openEditor(document)}
                        disabled={updating}
                      />
                    </Inline>
                  </Flex>
                </Card>

                {dropTargetState?.position === 'after' && (
                  <Box
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      backgroundColor: 'var(--card-focus-ring-color)',
                      zIndex: 2,
                    }}
                  />
                )}
              </Box>
            )
          })}
        </Stack>
      </Box>
    </Stack>
  )
}
