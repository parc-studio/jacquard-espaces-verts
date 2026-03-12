/**
 * VideoReviewPanel — Review a generated video, accept / download / regenerate / discard.
 *
 * Displays a `<video>` player with autoplay + loop, the source image thumbnail,
 * and action buttons to accept (upload to Sanity), download locally, regenerate,
 * or discard and return to selection.
 */

import { ArrowLeftIcon, CheckmarkIcon, CloseIcon, DownloadIcon, ResetIcon } from '@sanity/icons'
import { Button, Card, Flex, Heading, Spinner, Stack, Text } from '@sanity/ui'
import { useCallback, useMemo, useState } from 'react'
import { useClient } from 'sanity'

import { makeVideoFilename, uploadVideoToSanity } from '../lib/sanity-assets'
import type { ProcessingResult, SanityImageAsset } from '../lib/types'

interface VideoReviewPanelProps {
  asset: SanityImageAsset
  result: ProcessingResult
  onRegenerate: () => void
  onDiscard: () => void
  onAccepted: (newAssetId: string) => void
}

export function VideoReviewPanel({
  asset,
  result,
  onRegenerate,
  onDiscard,
  onAccepted,
}: VideoReviewPanelProps) {
  const client = useClient({ apiVersion: '2025-01-12' })
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const videoDataUri = useMemo(
    () => `data:${result.mimeType};base64,${result.base64Data}`,
    [result]
  )

  const thumbnailUrl = `${asset.url}?w=400&h=300&fit=crop&auto=format&q=80`

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  const handleAccept = useCallback(async () => {
    setIsUploading(true)
    setUploadError(null)

    try {
      const filename = makeVideoFilename(asset.originalFilename)
      const fileAssetId = await uploadVideoToSanity(client, result.base64Data, filename)
      onAccepted(fileAssetId)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erreur lors de l\u2019enregistrement.')
    } finally {
      setIsUploading(false)
    }
  }, [client, result, asset.originalFilename, onAccepted])

  const handleDownload = useCallback(() => {
    const filename = makeVideoFilename(asset.originalFilename)
    const link = document.createElement('a')
    link.href = videoDataUri
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [videoDataUri, asset.originalFilename])

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

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
          Résultat vidéo
        </Heading>
      </Flex>

      {/* Video player */}
      <Card radius={2} shadow={1} style={{ overflow: 'hidden', background: '#000' }}>
        <video
          src={videoDataUri}
          autoPlay
          loop
          muted
          playsInline
          controls
          style={{ width: '100%', display: 'block' }}
        />
      </Card>

      {/* Source image thumbnail + feedback */}
      <Flex gap={4} align="flex-start">
        <Card radius={2} shadow={1} style={{ overflow: 'hidden', flexShrink: 0, width: 120 }}>
          <img
            src={thumbnailUrl}
            alt={asset.originalFilename ?? 'Image source'}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </Card>
        <Stack space={2}>
          <Text size={1} weight="semibold">
            Image source
          </Text>
          <Text size={0} muted>
            {asset.originalFilename ?? 'Image'}
            {asset.metadata?.dimensions &&
              ` — ${asset.metadata.dimensions.width}×${asset.metadata.dimensions.height}`}
          </Text>
          {result.feedback && (
            <Text size={0} muted>
              {result.feedback}
            </Text>
          )}
        </Stack>
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
          text={isUploading ? 'Enregistrement…' : 'Accepter et enregistrer'}
          tone="positive"
          onClick={handleAccept}
          disabled={isUploading}
          fontSize={1}
          padding={3}
        />
        <Button
          icon={DownloadIcon}
          text="Télécharger"
          mode="ghost"
          onClick={handleDownload}
          disabled={isUploading}
          fontSize={1}
          padding={3}
        />
        <Button
          icon={ResetIcon}
          text="Régénérer"
          mode="ghost"
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
