/**
 * BulkProcessingPanel — Process all images of a project sequentially.
 *
 * For each image the pipeline runs:  analyse → correction → upload → replace in gallery.
 * A progress indicator and per-image status badges keep the user informed.
 * The user can stop the job after the current image finishes.
 */

import {
  ArrowLeftIcon,
  CheckmarkCircleIcon,
  CloseCircleIcon,
  PauseIcon,
  PlayIcon,
} from '@sanity/icons'
import { Badge, Box, Button, Card, Flex, Grid, Heading, Spinner, Stack, Text } from '@sanity/ui'
import { useCallback, useRef, useState } from 'react'
import { useClient } from 'sanity'

import {
  humanizeFilename,
  makeProcessedFilename,
  replaceImageInProject,
  resolveOriginalAssetUrl,
  uploadProcessedImage,
} from '../lib/sanity-assets'
import { SECRET_KEYS, SECRETS_NAMESPACE, SettingsView, useGcpSecrets } from '../lib/secrets'
import type { BulkItemStatus, BulkJobItem, ProjectWithImages } from '../lib/types'
import { processImageChain } from '../lib/vertex'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BulkProcessingPanelProps {
  project: ProjectWithImages
  onDone: (processed: number, failed: number) => void
  onCancel: () => void
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<BulkItemStatus, string> = {
  pending: 'En attente',
  analyzing: 'Analyse…',
  'analysis-done': 'Analyse ✓',
  correcting: 'Correction…',
  'correction-done': 'Correction ✓',
  uploading: 'Envoi…',
  replacing: 'Remplacement…',
  done: 'Terminé',
  error: 'Erreur',
}

function statusTone(
  s: BulkItemStatus
): 'default' | 'positive' | 'critical' | 'caution' | 'primary' {
  if (s === 'done') return 'positive'
  if (s === 'error') return 'critical'
  if (s === 'pending') return 'default'
  return 'primary'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BulkProcessingPanel({ project, onDone, onCancel }: BulkProcessingPanelProps) {
  const client = useClient({ apiVersion: '2025-01-12' })
  const { loading: secretsLoading, config: gcpConfig } = useGcpSecrets()
  const configured = gcpConfig !== null
  const [showSecrets, setShowSecrets] = useState(false)

  // Build initial job items from project images
  const [items, setItems] = useState<BulkJobItem[]>(() =>
    project.images.map((asset) => ({ asset, status: 'pending' as const }))
  )
  const [isRunning, setIsRunning] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const stopRequestedRef = useRef(false)

  // Derived counts
  const doneCount = items.filter((i) => i.status === 'done').length
  const errorCount = items.filter((i) => i.status === 'error').length
  const totalCount = items.length
  const isFinished = doneCount + errorCount === totalCount && !isRunning

  // Update a single item's state
  const updateItem = useCallback((index: number, patch: Partial<BulkJobItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }, [])

  // ------------------------------------------------------------------
  // Core: process one image through the full pipeline
  // ------------------------------------------------------------------
  const processOneImage = useCallback(
    async (index: number, item: BulkJobItem) => {
      if (!item || item.status === 'done') return

      try {
        // 0. Resolve original asset URL (avoids double-processing)
        const { url: sourceUrl, originalAssetId } = await resolveOriginalAssetUrl(
          client,
          item.asset
        )

        // 1. Send source image URL directly to Vertex AI
        updateItem(index, { status: 'analyzing' })

        // 2. AI auto_correct pipeline
        const result = await processImageChain(sourceUrl, gcpConfig!, (step) => {
          if (step === 'analysis-done') updateItem(index, { status: 'correcting' })
        })

        updateItem(index, { status: 'uploading' })

        // 3. Upload
        const filename = makeProcessedFilename(
          item.asset.originalFilename,
          'auto_correct',
          result.mimeType
        )
        const newAssetId = await uploadProcessedImage(
          client,
          result.base64Data,
          result.mimeType,
          filename,
          originalAssetId,
          'auto_correct'
        )

        // 4. Replace in project gallery
        updateItem(index, { status: 'replacing' })
        await replaceImageInProject(client, project._id, item.asset._id, newAssetId)

        // 5. Delete the old processed asset if we're re-processing
        if (item.asset.label === 'ai-processed' && item.asset._id !== originalAssetId) {
          await client.delete(item.asset._id).catch(() => {
            // Non-critical — old processed asset cleanup failed
          })
        }

        updateItem(index, { status: 'done', newAssetId })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue'
        updateItem(index, { status: 'error', error: message })
      }
    },
    [client, project._id, updateItem, gcpConfig]
  )

  // ------------------------------------------------------------------
  // Run loop — processes images sequentially
  // ------------------------------------------------------------------
  const runBulk = useCallback(async () => {
    setIsRunning(true)
    stopRequestedRef.current = false

    for (let i = 0; i < totalCount; i++) {
      if (stopRequestedRef.current) break

      // Skip already-done images (e.g. when resuming)
      setCurrentIndex(i)
      const current = items[i]
      if (current.status === 'done') continue

      await processOneImage(i, current)
    }

    setIsRunning(false)
  }, [items, totalCount, processOneImage])

  const handleStop = useCallback(() => {
    stopRequestedRef.current = true
  }, [])

  const handleFinish = useCallback(() => {
    onDone(doneCount, errorCount)
  }, [onDone, doneCount, errorCount])

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  const progressPct = totalCount > 0 ? Math.round(((doneCount + errorCount) / totalCount) * 100) : 0

  return (
    <Stack space={4}>
      {/* Header */}
      <Flex gap={3} align="center" wrap="wrap">
        <Button
          icon={ArrowLeftIcon}
          mode="bleed"
          onClick={onCancel}
          disabled={isRunning}
          padding={2}
        />
        <Heading as="h2" size={1}>
          Traitement groupé — {project.titre}
        </Heading>
      </Flex>

      {/* API key warning */}
      {!secretsLoading && !configured && (
        <Card padding={3} tone="caution" radius={2}>
          <Stack space={3}>
            <Text size={1}>
              Clé privée GCP manquante. Configurez-la pour activer le traitement.
            </Text>
            <Button
              text="Configurer la clé privée GCP"
              tone="primary"
              onClick={() => setShowSecrets(true)}
              fontSize={1}
              padding={2}
            />
          </Stack>
        </Card>
      )}

      {showSecrets && (
        <SettingsView
          namespace={SECRETS_NAMESPACE}
          keys={SECRET_KEYS}
          onClose={() => setShowSecrets(false)}
          title="Clé privée GCP"
        />
      )}

      {/* Progress bar */}
      <Stack space={2}>
        <Flex gap={2} align="center" justify="space-between">
          <Text size={1} weight="semibold">
            {doneCount + errorCount} / {totalCount} images traitées
          </Text>
          <Text size={0} muted>
            {progressPct}%
          </Text>
        </Flex>
        <Box
          style={{
            height: 6,
            borderRadius: 3,
            background: 'var(--card-shadow-outline-color, #e0e0e0)',
            overflow: 'hidden',
          }}
        >
          <Box
            style={{
              height: '100%',
              width: `${progressPct}%`,
              borderRadius: 3,
              background:
                errorCount > 0
                  ? 'var(--card-badge-caution-bg-color, #e5a000)'
                  : 'var(--card-badge-positive-bg-color, #3ab667)',
              transition: 'width 300ms ease',
            }}
          />
        </Box>
      </Stack>

      {/* Image grid with status badges */}
      <Grid columns={[2, 3, 4, 5]} gap={2}>
        {items.map((item, idx) => (
          <BulkThumbnail
            key={item.asset._id}
            item={item}
            isCurrent={isRunning && idx === currentIndex}
          />
        ))}
      </Grid>

      {/* Error summary (only show when there are errors and job is not running) */}
      {!isRunning && errorCount > 0 && (
        <Card padding={3} tone="critical" radius={2}>
          <Stack space={2}>
            <Text size={1} weight="semibold">
              {errorCount} image{errorCount > 1 ? 's' : ''} en erreur
            </Text>
            {items
              .filter((i) => i.status === 'error')
              .map((i) => (
                <Text key={i.asset._id} size={0} muted>
                  {humanizeFilename(i.asset.originalFilename)}: {i.error}
                </Text>
              ))}
          </Stack>
        </Card>
      )}

      {/* Actions */}
      <Flex gap={3} wrap="wrap">
        {!isRunning && !isFinished && (
          <Button
            icon={PlayIcon}
            text="Lancer le traitement"
            tone="positive"
            onClick={runBulk}
            disabled={!configured}
            fontSize={1}
            padding={3}
          />
        )}

        {isRunning && (
          <Button
            icon={PauseIcon}
            text="Arrêter après l'image en cours"
            tone="caution"
            onClick={handleStop}
            fontSize={1}
            padding={3}
          />
        )}

        {isFinished && (
          <Button
            icon={CheckmarkCircleIcon}
            text={`Terminé — ${doneCount} traitée${doneCount > 1 ? 's' : ''}${errorCount > 0 ? `, ${errorCount} erreur${errorCount > 1 ? 's' : ''}` : ''}`}
            tone="positive"
            onClick={handleFinish}
            fontSize={1}
            padding={3}
          />
        )}

        {!isRunning && (
          <Button text="Retour" mode="ghost" onClick={onCancel} fontSize={1} padding={3} />
        )}
      </Flex>
    </Stack>
  )
}

// ---------------------------------------------------------------------------
// Bulk thumbnail sub-component
// ---------------------------------------------------------------------------

function BulkThumbnail({ item, isCurrent }: { item: BulkJobItem; isCurrent: boolean }) {
  const thumbUrl = `${item.asset.url}?w=300&h=200&fit=crop&auto=format&q=75`
  const displayName = humanizeFilename(item.asset.originalFilename)

  return (
    <Card
      padding={0}
      radius={2}
      shadow={1}
      tone={item.status === 'error' ? 'critical' : item.status === 'done' ? 'positive' : 'default'}
      style={{
        overflow: 'hidden',
        position: 'relative',
        outline: isCurrent ? '2px solid var(--card-focus-ring-color, #2276fc)' : undefined,
        outlineOffset: -2,
      }}
    >
      {/* Image */}
      <Box style={{ position: 'relative', paddingBottom: '66.67%', background: '#f0f0f0' }}>
        <img
          src={thumbUrl}
          alt={displayName}
          loading="lazy"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            opacity: item.status === 'done' ? 0.6 : 1,
            transition: 'opacity 200ms ease',
          }}
        />

        {(item.asset.label === 'cloudinary-processed' || item.asset.label === 'ai-processed') && (
          <Box style={{ position: 'absolute', top: 4, right: 4 }} title="Déjà traité">
            <Badge tone="positive" fontSize={0} mode="outline">
              Corrigée
            </Badge>
          </Box>
        )}

        {/* Overlay icon for done / error */}
        {item.status === 'done' && (
          <Flex
            align="center"
            justify="center"
            style={{
              position: 'absolute',
              inset: 0,
              color: 'var(--card-badge-positive-fg-color, #fff)',
            }}
          >
            <CheckmarkCircleIcon width={32} height={32} />
          </Flex>
        )}
        {item.status === 'error' && (
          <Flex
            align="center"
            justify="center"
            style={{
              position: 'absolute',
              inset: 0,
              color: 'var(--card-badge-critical-fg-color, #fff)',
            }}
          >
            <CloseCircleIcon width={32} height={32} />
          </Flex>
        )}

        {/* Processing spinner */}
        {isCurrent && item.status !== 'done' && item.status !== 'error' && (
          <Flex
            align="center"
            justify="center"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.35)',
            }}
          >
            <Spinner />
          </Flex>
        )}
      </Box>

      {/* Info */}
      <Box
        padding={3}
        style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        <Text size={1} textOverflow="ellipsis" title={item.asset.originalFilename ?? 'Sans nom'}>
          {displayName}
        </Text>
        <Box paddingTop={1}>
          <Badge tone={statusTone(item.status)} fontSize={0}>
            {STATUS_LABEL[item.status]}
          </Badge>
        </Box>
      </Box>
    </Card>
  )
}
