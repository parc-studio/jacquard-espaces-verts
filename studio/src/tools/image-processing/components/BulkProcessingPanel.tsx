/**
 * BulkProcessingPanel — Two-pass bulk processing for project images.
 *
 * Pass 1: Analyse all images sequentially (AI analysis → CorrectionParams).
 * Normalise: IQR-based outlier replacement across all params.
 * Pass 2: Apply normalised corrections → upload → replace in gallery.
 *
 * A progress indicator and per-image status badges keep the user informed.
 * The user can stop the job after the current image finishes.
 */

import {
  ArrowLeftIcon,
  CheckmarkCircleIcon,
  CloseCircleIcon,
  PauseIcon,
  PlayIcon,
  ResetIcon,
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
import {
  analyzeImage,
  applyImageCorrections,
  DEFAULT_PARAMS,
  normalizeParamsForProject,
} from '../lib/vertex'

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
  analyzed: 'Analysé ✓',
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
  if (s === 'analyzed') return 'caution'
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
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'normalizing' | 'correcting' | 'done'>(
    'idle'
  )
  const stopRequestedRef = useRef(false)
  const itemsRef = useRef(items)
  itemsRef.current = items

  // Derived counts
  const doneCount = items.filter((i) => i.status === 'done').length
  const analyzedCount = items.filter(
    (i) =>
      i.status === 'analyzed' ||
      i.status === 'correcting' ||
      i.status === 'correction-done' ||
      i.status === 'uploading' ||
      i.status === 'replacing' ||
      i.status === 'done'
  ).length
  const errorCount = items.filter((i) => i.status === 'error').length
  const analysisFailedCount = items.filter((i) => i.analysisFailed).length
  const totalCount = items.length
  const isFinished = doneCount + errorCount === totalCount && !isRunning

  // Update a single item's state
  const updateItem = useCallback((index: number, patch: Partial<BulkJobItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }, [])

  // Store resolved source URLs to avoid resolving twice
  const resolvedUrlsRef = useRef<Map<number, { url: string; originalAssetId: string }>>(new Map())

  // ------------------------------------------------------------------
  // Two-pass bulk processing
  // ------------------------------------------------------------------
  const runBulk = useCallback(async () => {
    setIsRunning(true)
    stopRequestedRef.current = false

    // ---- Pass 1: Analyse all images ----
    setPhase('analyzing')
    for (let i = 0; i < totalCount; i++) {
      if (stopRequestedRef.current) break
      setCurrentIndex(i)
      const current = itemsRef.current[i]
      if (current.status === 'done' || current.status === 'analyzed') continue

      try {
        // Resolve original URL
        const { url: sourceUrl, originalAssetId } = await resolveOriginalAssetUrl(
          client,
          current.asset
        )
        resolvedUrlsRef.current.set(i, { url: sourceUrl, originalAssetId })

        updateItem(i, { status: 'analyzing' })

        let params = { ...DEFAULT_PARAMS }
        let failed = false
        try {
          params = await analyzeImage(sourceUrl, gcpConfig!)
        } catch {
          failed = true
        }

        updateItem(i, { status: 'analyzed', analysisParams: params, analysisFailed: failed })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue'
        updateItem(i, { status: 'error', error: `Analyse: ${message}` })
      }
    }

    if (stopRequestedRef.current) {
      setIsRunning(false)
      return
    }

    // ---- Normalise parameters across analysed images ----
    setPhase('normalizing')
    const latestItems = itemsRef.current
    const analysedIndices: number[] = []
    const analysedParams = latestItems
      .map((item, idx) => {
        if (item.analysisParams && item.status === 'analyzed') {
          analysedIndices.push(idx)
          return item.analysisParams
        }
        return null
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)

    if (analysedParams.length > 0) {
      const normalised = normalizeParamsForProject(analysedParams)
      for (let j = 0; j < analysedIndices.length; j++) {
        updateItem(analysedIndices[j], { analysisParams: normalised[j] })
      }
    }

    // ---- Pass 2: Apply corrections, upload, replace ----
    setPhase('correcting')
    for (let i = 0; i < totalCount; i++) {
      if (stopRequestedRef.current) break
      setCurrentIndex(i)
      const current = itemsRef.current[i]
      if (current.status !== 'analyzed' || !current.analysisParams) continue

      const resolved = resolvedUrlsRef.current.get(i)
      if (!resolved) continue

      try {
        updateItem(i, { status: 'correcting' })
        const result = await applyImageCorrections(resolved.url, current.analysisParams)
        updateItem(i, { status: 'correction-done' })

        // Upload
        updateItem(i, { status: 'uploading' })
        const filename = makeProcessedFilename(
          current.asset.originalFilename,
          'auto_correct',
          result.mimeType
        )
        const newAssetId = await uploadProcessedImage(
          client,
          result.base64Data,
          result.mimeType,
          filename,
          resolved.originalAssetId,
          'auto_correct'
        )

        // Replace in project gallery
        updateItem(i, { status: 'replacing' })
        await replaceImageInProject(client, project._id, current.asset._id, newAssetId)

        // Delete old processed asset if re-processing (with reference check)
        if (
          current.asset.label === 'ai-processed' &&
          current.asset._id !== resolved.originalAssetId
        ) {
          const refCount = await client.fetch<number>(`count(*[references($id)])`, {
            id: current.asset._id,
          })
          if (refCount === 0) {
            await client.delete(current.asset._id).catch(() => {})
          }
        }

        updateItem(i, {
          status: 'done',
          newAssetId,
          analysisFailed: current.analysisFailed,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue'
        updateItem(i, { status: 'error', error: message })
      }
    }

    setPhase(stopRequestedRef.current ? 'idle' : 'done')
    setIsRunning(false)
  }, [totalCount, client, project._id, updateItem, gcpConfig])

  const handleStop = useCallback(() => {
    stopRequestedRef.current = true
  }, [])

  const handleFinish = useCallback(() => {
    onDone(doneCount, errorCount)
  }, [onDone, doneCount, errorCount])

  // Retry all failed images (full two-pass on error items only)
  const handleRetryAllErrors = useCallback(async () => {
    // Reset error items to pending
    for (let i = 0; i < totalCount; i++) {
      if (itemsRef.current[i].status === 'error') {
        updateItem(i, {
          status: 'pending',
          error: undefined,
          analysisParams: undefined,
          analysisFailed: undefined,
        })
      }
    }
    // Re-run the full pipeline (it skips done/analyzed items)
    await runBulk()
  }, [totalCount, updateItem, runBulk])

  // ------------------------------------------------------------------
  // Progress calculations
  // ------------------------------------------------------------------
  const analysisPct =
    totalCount > 0 ? Math.round(((analyzedCount + errorCount) / totalCount) * 100) : 0
  const correctionPct =
    totalCount > 0 ? Math.round(((doneCount + errorCount) / totalCount) * 100) : 0
  const overallPct = phase === 'analyzing' || phase === 'normalizing' ? analysisPct : correctionPct

  const phaseLabel =
    phase === 'analyzing'
      ? `Analyse ${analyzedCount + errorCount}/${totalCount}`
      : phase === 'normalizing'
        ? 'Normalisation des paramètres…'
        : phase === 'correcting'
          ? `Correction ${doneCount + errorCount}/${totalCount}`
          : phase === 'done'
            ? 'Terminé'
            : 'Prêt'

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

      {/* Progress */}
      <Stack space={2}>
        <Flex gap={2} align="center" justify="space-between">
          <Text size={1} weight="semibold">
            {phaseLabel}
          </Text>
          <Text size={0} muted>
            {overallPct}%
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
              width: `${overallPct}%`,
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

      {/* Analysis failed warning */}
      {!isRunning && analysisFailedCount > 0 && phase === 'done' && (
        <Card padding={3} tone="caution" radius={2}>
          <Text size={1}>
            ⚠ {analysisFailedCount} image{analysisFailedCount > 1 ? 's' : ''} corrigée
            {analysisFailedCount > 1 ? 's' : ''} avec les valeurs par défaut (analyse IA échouée).
          </Text>
        </Card>
      )}

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

        {!isRunning && errorCount > 0 && (
          <Button
            icon={ResetIcon}
            text={`Réessayer ${errorCount} erreur${errorCount > 1 ? 's' : ''}`}
            tone="primary"
            onClick={handleRetryAllErrors}
            disabled={!configured}
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
  const thumbUrl = `${item.asset.url}?w=600&h=400&fit=crop&auto=format&q=85`
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
          }}
        />

        {(item.asset.label === 'cloudinary-processed' ||
          item.asset.label === 'ai-processed' ||
          item.asset.hasVideo) && (
          <Box
            style={{ position: 'absolute', top: 4, right: 4 }}
            title={item.asset.hasVideo ? 'Vidéo générée' : 'Déjà traité'}
          >
            <Badge tone={item.asset.hasVideo ? 'primary' : 'positive'} fontSize={0} mode="outline">
              {item.asset.hasVideo ? 'Vidéo' : 'Corrigée'}
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
              bottom: 4,
              left: 4,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'var(--card-badge-positive-bg-color, #3ab667)',
              color: '#fff',
            }}
          >
            <CheckmarkCircleIcon width={18} height={18} />
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
      <Box padding={3}>
        <Stack space={2}>
          <Badge tone={statusTone(item.status)} fontSize={0}>
            {STATUS_LABEL[item.status]}
          </Badge>
        </Stack>
      </Box>
    </Card>
  )
}
