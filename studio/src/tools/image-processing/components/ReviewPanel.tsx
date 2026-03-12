/**
 * ReviewPanel — Step 3: Compare before/after, accept, regenerate, or discard.
 *
 * Shows the original and processed images side by side.
 * The user can accept (upload to Sanity and replace in project), regenerate, or discard.
 */

import { ArrowLeftIcon, CheckmarkIcon, CloseIcon, ResetIcon } from '@sanity/icons'
import { Button, Card, Flex, Heading, Spinner, Stack, Text } from '@sanity/ui'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useClient } from 'sanity'

import {
  makeProcessedFilename,
  replaceImageInProject,
  uploadProcessedImage,
} from '../lib/sanity-assets'
import type { ProcessingMode, ProcessingResult, SanityImageAsset } from '../lib/types'
import { MODE_LABELS } from '../lib/types'

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

  // Build data URI for the processed image
  const processedDataUri = useMemo(
    () => `data:${result.mimeType};base64,${result.base64Data}`,
    [result]
  )

  // Original preview
  const originalUrl = `${asset.url}?w=800&auto=format&q=85`

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

      // Replace the image reference in the project gallery (if we know the project)
      if (projectId) {
        await replaceImageInProject(client, projectId, asset._id, newAssetId)
      }

      onAccepted(newAssetId)
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Erreur lors de l\u2019envoi vers Sanity.'
      )
    } finally {
      setIsUploading(false)
    }
  }, [client, asset, result, mode, projectId, onAccepted])

  return (
    <Stack space={4}>
      {/* Header */}
      <Flex gap={3} align="center">
        <Button
          icon={ArrowLeftIcon}
          mode="bleed"
          onClick={onDiscard}
          disabled={isUploading}
          padding={2}
        />
        <Heading as="h2" size={1}>
          Résultat — {MODE_LABELS[mode]}
        </Heading>
      </Flex>

      {/* Feedback from AI analysis */}
      {result.feedback && (
        <Card padding={3} tone="positive" radius={2}>
          <Text size={1}>{result.feedback}</Text>
        </Card>
      )}

      {/* Before / After comparison slider */}
      <Stack space={2}>
        <Flex gap={3} align="center">
          <Text size={1} weight="semibold">
            Avant / Après
          </Text>
          <Text size={0} muted>
            Glissez le curseur pour comparer
          </Text>
        </Flex>
        <ComparisonSlider beforeUrl={originalUrl} afterUrl={processedDataUri} />
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
          onClick={onDiscard}
          disabled={isUploading}
          fontSize={1}
          padding={3}
        />
      </Flex>
    </Stack>
  )
}

// ---------------------------------------------------------------------------
// Comparison slider
// ---------------------------------------------------------------------------

function ComparisonSlider({ beforeUrl, afterUrl }: { beforeUrl: string; afterUrl: string }) {
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
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
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

  return (
    <Card radius={2} shadow={1} style={{ overflow: 'hidden' }}>
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          position: 'relative',
          cursor: 'col-resize',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        {/* After (full width, behind) */}
        <img
          src={afterUrl}
          alt="Après"
          draggable={false}
          style={{ width: '100%', height: 'auto', display: 'block' }}
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
            style={{ width: '100%', height: 'auto', display: 'block' }}
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
