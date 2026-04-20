/**
 * ReviewPanel — Step 3: Compare before/after, accept, regenerate, or discard.
 *
 * Shows the original and processed images side by side.
 * The user can accept (upload to Sanity and replace in project), regenerate, or discard.
 */

import {
  ArrowLeftIcon,
  CheckmarkIcon,
  CloseIcon,
  ResetIcon,
  SplitVerticalIcon,
} from '@sanity/icons'
import { Badge, Box, Button, Card, Flex, Heading, Spinner, Stack, Switch, Text } from '@sanity/ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isDev, useClient } from 'sanity'

import {
  makeProcessedFilename,
  replaceImageInProject,
  uploadProcessedImage,
} from '../lib/sanity-assets'
import type {
  CorrectionParams,
  ProcessingMode,
  ProcessingResult,
  SanityImageAsset,
} from '../lib/types'
import { MODE_LABELS } from '../lib/types'
import { applyCorrections, DEFAULT_PARAMS, FIXED_AESTHETIC, loadImage } from '../lib/vertex'

interface ReviewPanelProps {
  asset: SanityImageAsset
  result: ProcessingResult
  mode: ProcessingMode
  /** If set, the accepted image will replace the original in this project's gallery. */
  projectId: string | null
  /** The true original asset ID (before any prior processing). */
  originalAssetId: string
  onRegenerate: () => void
  onDiscard: () => void
  onAccepted: (newAssetId: string) => void
}

function getPreviewRatio(asset: SanityImageAsset): string {
  const dimensions = asset.metadata?.dimensions

  if (!dimensions?.width || !dimensions?.height) {
    return '3 / 2'
  }

  return `${dimensions.width} / ${dimensions.height}`
}

export function ReviewPanel({
  asset,
  result,
  mode,
  projectId,
  originalAssetId,
  onRegenerate,
  onDiscard,
  onAccepted,
}: ReviewPanelProps) {
  const client = useClient({ apiVersion: '2025-01-12' })
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showComparison, setShowComparison] = useState(false)
  const previewRatio = getPreviewRatio(asset)

  // Build data URI for the processed image (from AI pipeline)
  const processedDataUri = useMemo(
    () => `data:${result.mimeType};base64,${result.base64Data}`,
    [result]
  )

  // Resolve the true original base URL (no query params) and preview URL.
  // When re-processing an already-corrected image, originalAssetId points to the
  // raw source so we always start from the untouched pixels.
  const [originalBaseUrl, setOriginalBaseUrl] = useState(asset.url)
  const [originalUrl, setOriginalUrl] = useState(`${asset.url}?w=2400&auto=format&q=90`)

  useEffect(() => {
    if (originalAssetId === asset._id) return
    let cancelled = false
    client
      .fetch<{ url?: string }>(`*[_id == $id][0]{ url }`, { id: originalAssetId })
      .then((doc) => {
        if (!cancelled && doc?.url) {
          setOriginalBaseUrl(doc.url)
          setOriginalUrl(`${doc.url}?w=2400&auto=format&q=90`)
        }
      })
    return () => {
      cancelled = true
    }
  }, [client, asset._id, originalAssetId])

  // ------------------------------------------------------------------
  // Parameter tuning state
  // ------------------------------------------------------------------
  const [showTuner, setShowTuner] = useState(false)
  const [tuneParams, setTuneParams] = useState<CorrectionParams>({
    ...FIXED_AESTHETIC,
    exposure: DEFAULT_PARAMS.exposure,
    straightenAngle: DEFAULT_PARAMS.straightenAngle,
    verticalPerspective: DEFAULT_PARAMS.verticalPerspective,
    shadows: DEFAULT_PARAMS.shadows,
    highlights: DEFAULT_PARAMS.highlights,
    whites: DEFAULT_PARAMS.whites,
    blacks: DEFAULT_PARAMS.blacks,
    tint: DEFAULT_PARAMS.tint,
    vibrance: DEFAULT_PARAMS.vibrance,
    clarity: DEFAULT_PARAMS.clarity,
  })
  const [tunedDataUri, setTunedDataUri] = useState<string | null>(null)
  const [tuning, setTuning] = useState(false)
  const sourceImageRef = useRef<HTMLImageElement | null>(null)

  // Load original raw image once for Canvas re-renders (tuner).
  // Always use the resolved original, not the corrected asset.
  useEffect(() => {
    if (!showTuner) return
    let cancelled = false
    const separator = originalBaseUrl.includes('?') ? '&' : '?'
    const pngUrl = `${originalBaseUrl}${separator}fm=png&w=2400`
    loadImage(pngUrl).then((img) => {
      if (!cancelled) sourceImageRef.current = img
    })
    return () => {
      cancelled = true
    }
  }, [originalBaseUrl, showTuner])

  // Re-render with tuned params (debounced)
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!showTuner || !sourceImageRef.current) return
    if (renderTimerRef.current) clearTimeout(renderTimerRef.current)

    renderTimerRef.current = setTimeout(async () => {
      setTuning(true)
      const img = sourceImageRef.current!
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      applyCorrections(imageData, tuneParams)
      ctx.putImageData(imageData, 0, 0)
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
          'image/jpeg',
          0.92
        )
      })
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
      setTunedDataUri(dataUrl)
      setTuning(false)
    }, 150)

    return () => {
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current)
    }
  }, [showTuner, tuneParams])

  const updateParam = useCallback((key: keyof CorrectionParams, value: number) => {
    setTuneParams((prev) => ({ ...prev, [key]: value }))
  }, [])

  const resetParams = useCallback(() => {
    setTuneParams({
      ...FIXED_AESTHETIC,
      exposure: DEFAULT_PARAMS.exposure,
      straightenAngle: DEFAULT_PARAMS.straightenAngle,
      verticalPerspective: DEFAULT_PARAMS.verticalPerspective,
      shadows: DEFAULT_PARAMS.shadows,
      highlights: DEFAULT_PARAMS.highlights,
      whites: DEFAULT_PARAMS.whites,
      blacks: DEFAULT_PARAMS.blacks,
      tint: DEFAULT_PARAMS.tint,
      vibrance: DEFAULT_PARAMS.vibrance,
      clarity: DEFAULT_PARAMS.clarity,
    })
  }, [])

  const copyParamsToClipboard = useCallback(() => {
    const code = `const FIXED_AESTHETIC = ${JSON.stringify(
      {
        contrast: tuneParams.contrast,
        highlights: tuneParams.highlights,
        shadows: tuneParams.shadows,
        temperature: tuneParams.temperature,
        saturation: tuneParams.saturation,
        levelsClipLow: tuneParams.levelsClipLow,
        levelsClipHigh: tuneParams.levelsClipHigh,
      },
      null,
      2
    )}`
    navigator.clipboard.writeText(code)
  }, [tuneParams])

  // ------------------------------------------------------------------
  // Upload handler
  // ------------------------------------------------------------------

  const handleAccept = useCallback(async () => {
    setIsUploading(true)
    setUploadError(null)

    try {
      const filename = makeProcessedFilename(asset.originalFilename, mode, result.mimeType)
      const newAssetId = await uploadProcessedImage(
        client,
        result.base64Data,
        result.mimeType,
        filename,
        originalAssetId,
        mode
      )

      if (projectId) {
        await replaceImageInProject(client, projectId, asset._id, newAssetId)
      }

      // Clean up the old processed asset if it's now orphaned
      if (asset.label === 'ai-processed' && asset._id !== originalAssetId) {
        const refCount = await client.fetch<number>(`count(*[references($id)])`, {
          id: asset._id,
        })
        if (refCount === 0) {
          await client.delete(asset._id).catch(() => {})
        }
      }

      onAccepted(newAssetId)
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Erreur lors de l\u2019envoi vers Sanity.'
      )
    } finally {
      setIsUploading(false)
    }
  }, [client, asset, result, mode, projectId, originalAssetId, onAccepted])

  return (
    <Stack space={4}>
      {/* Header */}
      <Flex gap={3} align="center">
        <Button
          icon={ArrowLeftIcon}
          mode="bleed"
          onClick={() => {
            if (window.confirm('Annuler et perdre le résultat du traitement ?')) onDiscard()
          }}
          disabled={isUploading}
          padding={2}
        />
        <Heading as="h2" size={1}>
          Résultat — {MODE_LABELS[mode]}
        </Heading>
      </Flex>

      {/* Feedback from AI analysis */}
      {result.feedback && (
        <Card padding={3} tone={result.analysisFailed ? 'caution' : 'positive'} radius={2}>
          <Text size={1}>{result.feedback}</Text>
        </Card>
      )}

      {/* Processed image / comparison slider */}
      <Stack space={2}>
        <Flex gap={3} align="center">
          <Text size={1} weight="semibold">
            Résultat
          </Text>
          <Flex as="label" gap={2} align="center" style={{ marginLeft: 'auto', cursor: 'pointer' }}>
            <SplitVerticalIcon />
            <Text size={0}>Avant / Après</Text>
            <Switch checked={showComparison} onChange={() => setShowComparison((v) => !v)} />
          </Flex>
        </Flex>
        <Flex gap={2} wrap="wrap" align="center">
          <Badge tone="primary" fontSize={1}>
            Mode du resultat: {MODE_LABELS[mode]}
          </Badge>
          <Badge
            tone={asset._id === originalAssetId ? 'default' : 'positive'}
            mode="outline"
            fontSize={1}
          >
            Source: {asset.originalFilename ?? 'Image sans nom'}
          </Badge>
        </Flex>
        {showComparison ? (
          <ComparisonSlider
            beforeUrl={originalUrl}
            afterUrl={processedDataUri}
            aspectRatio={previewRatio}
          />
        ) : (
          <Card
            radius={2}
            shadow={1}
            style={{
              overflow: 'hidden',
              position: 'relative',
              aspectRatio: previewRatio,
              background: 'var(--card-code-bg-color, #f4f4f4)',
            }}
          >
            <img
              src={processedDataUri}
              alt="Image traitée"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </Card>
        )}
        <Text size={0} muted>
          {asset.originalFilename ?? 'Image'}
          {asset.metadata?.dimensions &&
            ` — ${asset.metadata.dimensions.width}×${asset.metadata.dimensions.height}`}
        </Text>
      </Stack>

      {/* Upload error */}
      {uploadError && (
        <Card padding={3} tone="critical" radius={2}>
          <Text size={1}>{uploadError}</Text>
        </Card>
      )}

      {/* Action buttons */}
      <Flex gap={3} wrap="wrap">
        <Button
          icon={isUploading ? Spinner : CheckmarkIcon}
          text={isUploading ? 'Envoi en cours…' : 'Accepter et enregistrer'}
          tone="positive"
          onClick={handleAccept}
          disabled={isUploading}
          fontSize={1}
          padding={3}
        />
        <Button
          icon={ResetIcon}
          text="Régénérer"
          mode="ghost"
          tone="primary"
          onClick={onRegenerate}
          disabled={isUploading}
          fontSize={1}
          padding={3}
        />
        <Button
          icon={CloseIcon}
          text="Annuler"
          mode="ghost"
          tone="critical"
          onClick={() => {
            if (window.confirm('Annuler et perdre le résultat du traitement ?')) onDiscard()
          }}
          disabled={isUploading}
          fontSize={1}
          padding={3}
        />
      </Flex>

      {/* Labo couleur toggle — dev only */}
      {isDev && (
        <Button
          text={showTuner ? 'Masquer le labo couleur' : '🎨 Labo couleur — ajuster les réglages'}
          mode="ghost"
          tone="primary"
          onClick={() => setShowTuner((v) => !v)}
          disabled={isUploading}
          fontSize={1}
          padding={3}
          style={{ width: '100%' }}
        />
      )}

      {/* Parameter tuning lab — dev only */}
      {isDev && showTuner && (
        <Card padding={4} tone="transparent" radius={2} shadow={1}>
          <Stack space={4}>
            <Flex gap={3} align="center" justify="space-between">
              <Text size={1} weight="semibold">
                Labo couleur — Réglages esthétiques
              </Text>
              <Flex gap={2}>
                <Button
                  text="Réinitialiser"
                  mode="ghost"
                  tone="caution"
                  onClick={resetParams}
                  fontSize={0}
                  padding={2}
                />
                <Button
                  text="Copier code"
                  mode="ghost"
                  tone="primary"
                  onClick={copyParamsToClipboard}
                  fontSize={0}
                  padding={2}
                />
              </Flex>
            </Flex>

            <Text size={0} muted>
              Ajustez les curseurs et observez le rendu en temps réel. Une fois satisfait, copiez
              les paramètres avec « Copier code » pour les intégrer dans vertex.ts.
            </Text>

            <Box style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ParamSlider
                label="Exposition"
                value={tuneParams.exposure}
                min={-0.5}
                max={0.5}
                step={0.01}
                onChange={(v) => updateParam('exposure', v)}
              />
              <ParamSlider
                label="Contraste"
                value={tuneParams.contrast}
                min={-1}
                max={1}
                step={0.01}
                onChange={(v) => updateParam('contrast', v)}
              />
              <ParamSlider
                label="Hautes lumières"
                value={tuneParams.highlights}
                min={-1}
                max={1}
                step={0.01}
                onChange={(v) => updateParam('highlights', v)}
              />
              <ParamSlider
                label="Ombres"
                value={tuneParams.shadows}
                min={-1}
                max={1}
                step={0.01}
                onChange={(v) => updateParam('shadows', v)}
              />
              <ParamSlider
                label="Température"
                value={tuneParams.temperature}
                min={-1}
                max={1}
                step={0.01}
                onChange={(v) => updateParam('temperature', v)}
              />
              <ParamSlider
                label="Saturation"
                value={tuneParams.saturation}
                min={-1}
                max={1}
                step={0.01}
                onChange={(v) => updateParam('saturation', v)}
              />
              <ParamSlider
                label="Niveaux — noir"
                value={tuneParams.levelsClipLow}
                min={0}
                max={0.05}
                step={0.001}
                onChange={(v) => updateParam('levelsClipLow', v)}
              />
              <ParamSlider
                label="Niveaux — blanc"
                value={tuneParams.levelsClipHigh}
                min={0}
                max={0.05}
                step={0.001}
                onChange={(v) => updateParam('levelsClipHigh', v)}
              />
            </Box>

            {/* Tuned preview with comparison slider */}
            {tunedDataUri && (
              <Stack space={2}>
                <Flex gap={2} align="center">
                  <Text size={1} weight="semibold">
                    Aperçu labo
                  </Text>
                  {tuning && (
                    <Text size={0} muted>
                      Rendu…
                    </Text>
                  )}
                </Flex>
                <ComparisonSlider beforeUrl={originalUrl} afterUrl={tunedDataUri} />
              </Stack>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  )
}

// ---------------------------------------------------------------------------
// Comparison slider
// ---------------------------------------------------------------------------

export function ComparisonSlider({
  beforeUrl,
  afterUrl,
  aspectRatio = '3 / 2',
}: {
  beforeUrl: string
  afterUrl: string
  aspectRatio?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(50)
  const dragging = useRef(false)

  const updatePosition = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    setPosition(pct)
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
      updatePosition(e.clientX)
    },
    [updatePosition]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return
      updatePosition(e.clientX)
    },
    [updatePosition]
  )

  const onPointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setPosition((p) => Math.max(0, p - 2))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setPosition((p) => Math.min(100, p + 2))
    }
  }, [])

  return (
    <Card radius={2} shadow={1} style={{ overflow: 'hidden' }}>
      <div
        ref={containerRef}
        role="slider"
        aria-label="Comparaison avant/après"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        style={{
          position: 'relative',
          cursor: 'col-resize',
          userSelect: 'none',
          touchAction: 'none',
          aspectRatio,
          background: 'var(--card-code-bg-color, #f4f4f4)',
        }}
      >
        {/* After (full width, behind) */}
        <img
          src={afterUrl}
          alt="Après"
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />

        {/* Before (clipped to left of divider) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: `inset(0 ${100 - position}% 0 0)`,
          }}
        >
          <img
            src={beforeUrl}
            alt="Avant"
            draggable={false}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>

        {/* Divider line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${position}%`,
            width: 2,
            background: 'white',
            boxShadow: '0 0 4px rgba(0,0,0,0.5)',
            transform: 'translateX(-1px)',
            pointerEvents: 'none',
          }}
        />

        {/* Handle */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: `${position}%`,
            transform: 'translate(-50%, -50%)',
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'white',
            boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            fontSize: 14,
            color: '#333',
          }}
        >
          ‹›
        </div>

        {/* Labels */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: 'rgba(0,0,0,0.55)',
            color: 'white',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 12,
            pointerEvents: 'none',
          }}
        >
          Avant
        </div>
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(0,0,0,0.55)',
            color: 'white',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 12,
            pointerEvents: 'none',
          }}
        >
          Après
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Parameter slider
// ---------------------------------------------------------------------------

function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <Box>
      <Flex justify="space-between" align="center" style={{ marginBottom: 4 }}>
        <Text size={0}>{label}</Text>
        <Text size={0} muted>
          {value.toFixed(step < 0.01 ? 3 : 2)}
        </Text>
      </Flex>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--card-focus-ring-color)' }}
      />
    </Box>
  )
}
