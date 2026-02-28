/**
 * ReviewPanel — Step 3: Compare before/after, accept, regenerate, or discard.
 *
 * Shows the original and processed images side by side.
 * The user can accept (upload to Sanity), regenerate, or discard.
 */

import { ArrowLeftIcon, CheckmarkIcon, CloseIcon, ResetIcon } from '@sanity/icons'
import { Box, Button, Card, Flex, Heading, Spinner, Stack, Text } from '@sanity/ui'
import { useCallback, useMemo, useState } from 'react'
import { useClient } from 'sanity'

import { MODE_LABELS } from '../lib/prompts'
import { makeProcessedFilename, uploadProcessedImage } from '../lib/sanity-assets'
import type { ProcessingMode, ProcessingResult, SanityImageAsset } from '../lib/types'

interface ReviewPanelProps {
  asset: SanityImageAsset
  result: ProcessingResult
  mode: ProcessingMode
  onRegenerate: () => void
  onDiscard: () => void
  onAccepted: (newAssetId: string) => void
}

export function ReviewPanel({
  asset,
  result,
  mode,
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
      const filename = makeProcessedFilename(asset.originalFilename, mode)
      const newAssetId = await uploadProcessedImage(
        client,
        result.base64Data,
        result.mimeType,
        filename
      )
      onAccepted(newAssetId)
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Erreur lors de l\u2019envoi vers Sanity.'
      )
    } finally {
      setIsUploading(false)
    }
  }, [client, asset, result, mode, onAccepted])

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

      {/* Feedback from Gemini */}
      {result.feedback && (
        <Card padding={3} tone="positive" radius={2}>
          <Text size={1}>{result.feedback}</Text>
        </Card>
      )}

      {/* Before / After comparison */}
      <Flex gap={4} wrap="wrap">
        <Box style={{ flex: '1 1 400px' }}>
          <Stack space={2}>
            <Text size={1} weight="semibold">
              Avant
            </Text>
            <Card radius={2} shadow={1} style={{ overflow: 'hidden' }}>
              <img
                src={originalUrl}
                alt="Original"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </Card>
          </Stack>
        </Box>
        <Box style={{ flex: '1 1 400px' }}>
          <Stack space={2}>
            <Text size={1} weight="semibold">
              Après
            </Text>
            <Card radius={2} shadow={1} style={{ overflow: 'hidden' }}>
              <img
                src={processedDataUri}
                alt="Traité"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </Card>
          </Stack>
        </Box>
      </Flex>

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
