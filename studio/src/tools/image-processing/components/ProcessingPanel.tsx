/**
 * ProcessingPanel — Step 2: Choose processing mode, preview source, and trigger Vertex AI.
 *
 * Displays the selected image, mode selection (auto_correct),
 * and a button to start processing. Shows progress/loading state.
 */

import {
  ArrowLeftIcon,
  CloseIcon,
  PlayIcon,
  ResetIcon,
  SplitVerticalIcon,
  TrashIcon,
} from '@sanity/icons'
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Radio,
  Spinner,
  Stack,
  Switch,
  Text,
} from '@sanity/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useClient } from 'sanity'

import { cleanupSceneImage } from '../lib/imagen-cleanup'
import { fetchVideoForImageAsset, resolveOriginalAssetUrl } from '../lib/sanity-assets'
import { SECRET_KEYS, SECRETS_NAMESPACE, SettingsView, useGcpSecrets } from '../lib/secrets'
import type { ProcessingMode, ProcessingResult, SanityImageAsset, VideoInfo } from '../lib/types'
import { MODE_DESCRIPTIONS, MODE_LABELS } from '../lib/types'
import { generateVideoFromImage } from '../lib/veo'
import { processImage } from '../lib/vertex'
import { ComparisonSlider } from './ReviewPanel'

interface ProcessingPanelProps {
  asset: SanityImageAsset
  onResult: (result: ProcessingResult, mode: ProcessingMode, originalAssetId: string) => void
  onBack: () => void
  onRevert?: () => void
  onVideoRevert?: () => void
}

function getPreviewRatio(asset: SanityImageAsset): string {
  const dimensions = asset.metadata?.dimensions

  if (!dimensions?.width || !dimensions?.height) {
    return '3 / 2'
  }

  return `${dimensions.width} / ${dimensions.height}`
}

function getProcessingMessage(mode: ProcessingMode, progressText: string | null): string {
  if (progressText) {
    return progressText
  }

  if (mode === 'scene_cleanup') {
    return 'Suppression des elements indesirables en cours…'
  }

  if (mode === 'video_generate') {
    return 'Preparation de la video…'
  }

  return 'Analyse et correction en cours…'
}

export function ProcessingPanel({
  asset,
  onResult,
  onBack,
  onRevert,
  onVideoRevert,
}: ProcessingPanelProps) {
  const [mode, setMode] = useState<ProcessingMode>('auto_correct')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progressText, setProgressText] = useState<string | null>(null)
  const [showSecrets, setShowSecrets] = useState(false)
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const client = useClient({ apiVersion: '2025-01-12' })

  const { loading: secretsLoading, config: gcpConfig } = useGcpSecrets()
  const configured = gcpConfig !== null

  // Abort any in-flight processing if the component unmounts
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  // Detect associated video for this asset
  useEffect(() => {
    let cancelled = false
    fetchVideoForImageAsset(client, asset._id).then((info) => {
      if (!cancelled) setVideoInfo(info)
    })
    return () => {
      cancelled = true
    }
  }, [client, asset._id, asset.hasVideo])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const handleProcess = useCallback(async () => {
    setIsProcessing(true)
    setError(null)
    setProgressText(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      let result: ProcessingResult
      if (mode === 'video_generate') {
        // For video, use the current asset (which may be the processed/corrected version)
        result = await generateVideoFromImage(asset.url, gcpConfig!, {
          signal: controller.signal,
          onProgress: setProgressText,
        })
        onResult(result, mode, asset._id)
      } else if (mode === 'scene_cleanup') {
        // For scene cleanup, use the current asset directly
        setProgressText('Suppression des humains/véhicules/animaux…')
        result = await cleanupSceneImage(asset.url, gcpConfig!)
        onResult(result, mode, asset._id)
      } else {
        // For image correction, resolve back to the original to avoid double-processing
        const { url: sourceUrl, originalAssetId } = await resolveOriginalAssetUrl(client, asset)
        result = await processImage(sourceUrl, mode, gcpConfig!)
        onResult(result, mode, originalAssetId)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Une erreur inattendue est survenue.'
      setError(message)
    } finally {
      setIsProcessing(false)
      setProgressText(null)
      abortRef.current = null
    }
  }, [client, asset, mode, onResult, gcpConfig])

  // Preview URL (larger than thumbnail)
  const previewUrl = `${asset.url}?w=2400&auto=format&q=90`

  // For already-processed images, resolve the original URL for comparison
  const isProcessed = asset.label === 'cloudinary-processed' || asset.label === 'ai-processed'
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [showComparison, setShowComparison] = useState(false)
  const previewRatio = getPreviewRatio(asset)
  const processingMessage = getProcessingMessage(mode, progressText)

  // Extract the mode that was applied to this asset (from description "Mode: xxx")
  const appliedMode = isProcessed
    ? ((asset.description?.match(/Mode:\s*(\S+)/)?.[1] as ProcessingMode | undefined) ?? null)
    : null

  useEffect(() => {
    if (!isProcessed) return
    let cancelled = false
    resolveOriginalAssetUrl(client, asset).then(({ url }) => {
      if (!cancelled && url !== asset.url) {
        setOriginalUrl(`${url}?w=2400&auto=format&q=90`)
      }
    })
    return () => {
      cancelled = true
    }
  }, [client, asset, isProcessed])

  return (
    <Stack space={4}>
      {/* Header with back button + revert */}
      <Flex gap={3} align="center">
        <Button
          icon={ArrowLeftIcon}
          mode="bleed"
          onClick={onBack}
          disabled={isProcessing}
          padding={2}
        />
        <Heading as="h2" size={1}>
          Traitement de l&apos;image
        </Heading>
        {isProcessed && onRevert && (
          <Button
            icon={ResetIcon}
            text="Restaurer l'original"
            mode="ghost"
            tone="caution"
            fontSize={1}
            padding={2}
            disabled={isProcessing}
            onClick={() => {
              if (
                window.confirm(
                  'Restaurer l\u2019image originale ? L\u2019image traitée sera supprimée.'
                )
              )
                onRevert()
            }}
            style={{ marginLeft: 'auto' }}
          />
        )}
      </Flex>

      <Stack space={4}>
        {/* Source preview — video player if video exists, otherwise image */}
        <Box>
          {videoInfo ? (
            <Stack space={3}>
              <Card radius={2} shadow={1} style={{ overflow: 'hidden', background: '#000' }}>
                <video
                  src={videoInfo.url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                  style={{ width: '100%', display: 'block' }}
                />
              </Card>
              <Flex gap={2} align="center" wrap="wrap">
                <Badge tone="primary" fontSize={1}>
                  Vidéo appliquée — {MODE_LABELS.video_generate}
                </Badge>
                {onVideoRevert && (
                  <Button
                    icon={TrashIcon}
                    text="Supprimer la vidéo"
                    mode="ghost"
                    tone="critical"
                    fontSize={1}
                    padding={2}
                    disabled={isProcessing}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Supprimer la vidéo ? L\u2019image (traitée ou originale) sera conservée.'
                        )
                      ) {
                        onVideoRevert()
                        setVideoInfo(null)
                      }
                    }}
                    style={{ marginLeft: 'auto' }}
                  />
                )}
              </Flex>
            </Stack>
          ) : (
            <>
              <Flex gap={2} wrap="wrap" align="center" paddingBottom={2}>
                <Badge
                  tone={isProcessed ? 'positive' : 'default'}
                  mode={isProcessed ? 'default' : 'outline'}
                >
                  {isProcessed ? 'Image déjà traitée' : 'Image originale'}
                </Badge>
                {appliedMode && (
                  <Badge tone="primary">Mode appliqué: {MODE_LABELS[appliedMode]}</Badge>
                )}
              </Flex>
              {isProcessed && originalUrl ? (
                <Stack space={2}>
                  <Flex gap={3} align="center">
                    <Text size={1} weight="semibold">
                      Image actuelle
                    </Text>
                    <Flex
                      as="label"
                      gap={2}
                      align="center"
                      style={{ marginLeft: 'auto', cursor: 'pointer' }}
                    >
                      <SplitVerticalIcon />
                      <Text size={0}>Avant / Après</Text>
                      <Switch
                        checked={showComparison}
                        onChange={() => setShowComparison((v) => !v)}
                      />
                    </Flex>
                  </Flex>
                  <Box style={{ position: 'relative' }}>
                    {showComparison ? (
                      <ComparisonSlider
                        beforeUrl={originalUrl}
                        afterUrl={previewUrl}
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
                          src={previewUrl}
                          alt={asset.originalFilename ?? 'Image source'}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            display: 'block',
                          }}
                        />
                        <Box style={{ position: 'absolute', top: 12, right: 12 }}>
                          <Badge tone="positive" fontSize={1} mode="outline">
                            Corrigée
                          </Badge>
                        </Box>
                      </Card>
                    )}

                    {isProcessing && (
                      <Flex
                        align="center"
                        justify="center"
                        direction="column"
                        gap={3}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(16, 24, 40, 0.38)',
                          color: 'white',
                          padding: 24,
                          textAlign: 'center',
                        }}
                      >
                        <Spinner />
                        <Text size={1} weight="semibold" style={{ color: 'inherit' }}>
                          Traitement en cours
                        </Text>
                        <Text size={0} style={{ color: 'inherit', maxWidth: 360 }}>
                          {processingMessage}
                        </Text>
                      </Flex>
                    )}
                  </Box>
                </Stack>
              ) : (
                <Box style={{ position: 'relative' }}>
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
                      src={previewUrl}
                      alt={asset.originalFilename ?? 'Image source'}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                    {isProcessed && (
                      <Box style={{ position: 'absolute', top: 12, right: 12 }}>
                        <Badge tone="positive" fontSize={1} mode="outline">
                          Corrigee
                        </Badge>
                      </Box>
                    )}
                  </Card>

                  {isProcessing && (
                    <Flex
                      align="center"
                      justify="center"
                      direction="column"
                      gap={3}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(16, 24, 40, 0.38)',
                        color: 'white',
                        padding: 24,
                        textAlign: 'center',
                      }}
                    >
                      <Spinner />
                      <Text size={1} weight="semibold" style={{ color: 'inherit' }}>
                        Traitement en cours
                      </Text>
                      <Text size={0} style={{ color: 'inherit', maxWidth: 360 }}>
                        {processingMessage}
                      </Text>
                    </Flex>
                  )}
                </Box>
              )}
              <Box paddingTop={2}>
                <Text size={0} muted>
                  {asset.originalFilename ?? 'Image'}
                  {asset.metadata?.dimensions &&
                    ` — ${asset.metadata.dimensions.width}×${asset.metadata.dimensions.height}`}
                </Text>
              </Box>
            </>
          )}
        </Box>

        {/* Controls */}
        <Stack space={4}>
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

          {/* Mode selection */}
          <Stack space={3}>
            <Text size={1} weight="semibold">
              Mode de traitement
            </Text>
            {(Object.keys(MODE_LABELS) as ProcessingMode[]).map((m) => (
              <Card
                key={m}
                as="label"
                padding={3}
                radius={2}
                shadow={mode === m ? 1 : 0}
                tone={mode === m ? 'primary' : 'default'}
                style={{ cursor: 'pointer' }}
              >
                <Flex gap={3} align="flex-start">
                  <Radio
                    checked={mode === m}
                    name="processing-mode"
                    onChange={() => setMode(m)}
                    value={m}
                  />
                  <Stack space={2}>
                    <Flex gap={2} align="center">
                      <Text size={1} weight="semibold">
                        {MODE_LABELS[m]}
                      </Text>
                      {appliedMode === m && (
                        <Badge tone="positive" fontSize={0}>
                          Appliqué
                        </Badge>
                      )}
                    </Flex>
                    <Text size={0} muted>
                      {MODE_DESCRIPTIONS[m]}
                    </Text>
                  </Stack>
                </Flex>
              </Card>
            ))}
          </Stack>

          {/* Error */}
          {error && (
            <Card padding={3} tone="critical" radius={2}>
              <Stack space={3}>
                <Text size={1}>{error}</Text>
                <Button
                  icon={PlayIcon}
                  text="Réessayer"
                  tone="primary"
                  mode="ghost"
                  onClick={handleProcess}
                  disabled={isProcessing || !configured}
                  fontSize={1}
                  padding={2}
                />
              </Stack>
            </Card>
          )}

          {/* Video mode warning */}
          {mode === 'video_generate' && !isProcessing && (
            <Card padding={3} tone="caution" radius={2}>
              <Text size={1}>
                La génération vidéo peut prendre 1 à 3 minutes. Vous pourrez annuler à tout moment.
              </Text>
            </Card>
          )}

          {/* Process / Cancel buttons */}
          {isProcessing && mode === 'video_generate' ? (
            <Stack space={3}>
              <Flex gap={2} align="center" justify="center">
                <Text size={1}>{processingMessage}</Text>
              </Flex>
              <Button
                icon={CloseIcon}
                text="Annuler la génération"
                tone="critical"
                mode="ghost"
                onClick={handleCancel}
                fontSize={1}
                padding={3}
              />
            </Stack>
          ) : (
            <Button
              icon={PlayIcon}
              text={isProcessing ? 'Traitement en cours…' : 'Lancer le traitement'}
              tone="positive"
              onClick={handleProcess}
              disabled={isProcessing || !configured}
              fontSize={1}
              padding={3}
            />
          )}

          {isProcessing && mode !== 'video_generate' && (
            <Flex gap={2} align="center" justify="center">
              <Text size={0} muted>
                {processingMessage}
              </Text>
            </Flex>
          )}
        </Stack>
      </Stack>
    </Stack>
  )
}
