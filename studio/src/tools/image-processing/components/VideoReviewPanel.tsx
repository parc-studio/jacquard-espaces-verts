/**
 * VideoReviewPanel — Review a generated video, accept / download / regenerate / discard.
 *
 * Displays a `<video>` player with autoplay + loop, the source image thumbnail,
 * and action buttons to accept (upload to Sanity), download locally, regenerate,
 * or discard and return to selection.
 */

import { ArrowLeftIcon, CheckmarkIcon, CloseIcon, DownloadIcon, ResetIcon } from '@sanity/icons'
import { Button, Card, Flex, Heading, Spinner, Stack, Text } from '@sanity/ui'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useClient } from 'sanity'

import { attachVideoToProject, makeVideoFilename, uploadVideoToSanity } from '../lib/sanity-assets'
import type { ProcessingResult, SanityImageAsset } from '../lib/types'

interface VideoReviewPanelProps {
  asset: SanityImageAsset
  result: ProcessingResult
  projectId: string | null
  onRegenerate: () => void
  onDiscard: () => void
  onAccepted: (newAssetId: string, savedVideoUrl?: string) => void
}

export function VideoReviewPanel({
  asset,
  result,
  projectId,
  onRegenerate,
  onDiscard,
  onAccepted,
}: VideoReviewPanelProps) {
  const client = useClient({ apiVersion: '2025-01-12' })
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [savedVideoUrl, setSavedVideoUrl] = useState<string | null>(null)
  const [attachedToProject, setAttachedToProject] = useState<boolean | null>(null)

  const videoSrc = useMemo(() => {
    const byteChars = atob(result.base64Data)
    const byteArray = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i)
    }
    return URL.createObjectURL(new Blob([byteArray], { type: result.mimeType }))
  }, [result])

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => URL.revokeObjectURL(videoSrc)
  }, [videoSrc])

  // Warn before tab close / refresh when video is unsaved
  useEffect(() => {
    if (savedVideoUrl) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [savedVideoUrl])

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  const handleAccept = useCallback(async () => {
    setIsUploading(true)
    setUploadError(null)

    try {
      const filename = makeVideoFilename(asset.originalFilename, result.mimeType)
      const { assetId: fileAssetId, url: videoUrl } = await uploadVideoToSanity(
        client,
        result.base64Data,
        filename,
        result.mimeType,
        asset._id
      )

      // Attach video to the project gallery item if a project is selected
      if (projectId && asset._id) {
        try {
          await attachVideoToProject(client, projectId, asset._id, videoUrl)
          setAttachedToProject(true)
        } catch {
          setAttachedToProject(false)
        }
      }

      setSavedVideoUrl(videoUrl)
      onAccepted(fileAssetId, videoUrl)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erreur lors de l\u2019enregistrement.')
    } finally {
      setIsUploading(false)
    }
  }, [client, result, asset.originalFilename, asset._id, projectId, onAccepted])

  const handleDownload = useCallback(() => {
    const filename = makeVideoFilename(asset.originalFilename, result.mimeType)
    const link = document.createElement('a')
    link.href = videoSrc
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [videoSrc, asset.originalFilename, result.mimeType])

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <Stack space={4}>
      {/* Header */}
      <Flex gap={3} align="center">
        <Button
          icon={ArrowLeftIcon}
          text={savedVideoUrl ? 'Retour à la sélection' : undefined}
          mode="bleed"
          onClick={() => {
            if (savedVideoUrl || window.confirm('Annuler et perdre la vidéo générée ?')) {
              onDiscard()
            }
          }}
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
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          controls
          style={{ width: '100%', display: 'block' }}
        />
      </Card>

      {/* Source image thumbnail + video preview */}
      <Flex gap={4} align="flex-start">
        <Card radius={2} shadow={1} style={{ overflow: 'hidden', flexShrink: 0, width: 120 }}>
          <video
            src={videoSrc}
            muted
            playsInline
            preload="metadata"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </Card>
        <Stack space={2}>
          <Text size={0} muted>
            Vidéo générée à partir de l'image sélectionnée
          </Text>
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

      {/* Saved confirmation */}
      {savedVideoUrl && (
        <Card padding={3} tone="positive" radius={2}>
          <Stack space={2}>
            <Flex gap={2} align="center">
              <Text size={2}>
                <CheckmarkIcon />
              </Text>
              <Text size={1} weight="semibold">
                Vidéo enregistrée avec succès.
              </Text>
            </Flex>
            {attachedToProject === true && (
              <Text size={0} muted>
                La vid\u00e9o a \u00e9t\u00e9 attach\u00e9e \u00e0 la galerie du projet.
              </Text>
            )}
            {attachedToProject === false && (
              <Text size={0} muted>
                \u26a0 La vid\u00e9o n\u2019a pas pu \u00eatre attach\u00e9e au projet. Utilisez le
                studio pour l\u2019ajouter manuellement.
              </Text>
            )}
          </Stack>
        </Card>
      )}

      {/* Action buttons */}
      <Flex gap={3} wrap="wrap">
        <Button
          icon={isUploading ? Spinner : CheckmarkIcon}
          text={
            savedVideoUrl
              ? 'Enregistré ✓'
              : isUploading
                ? 'Enregistrement…'
                : 'Accepter et enregistrer'
          }
          tone="positive"
          onClick={handleAccept}
          disabled={isUploading || !!savedVideoUrl}
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
        {!savedVideoUrl && (
          <Button
            icon={CloseIcon}
            text="Annuler"
            mode="ghost"
            tone="critical"
            onClick={() => {
              if (window.confirm('Annuler et perdre la vidéo générée ?')) onDiscard()
            }}
            disabled={isUploading}
            fontSize={1}
            padding={3}
          />
        )}
      </Flex>
    </Stack>
  )
}
