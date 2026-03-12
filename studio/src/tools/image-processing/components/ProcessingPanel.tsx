/**
 * ProcessingPanel — Step 2: Choose processing mode, preview source, and trigger Vertex AI.
 *
 * Displays the selected image, mode selection (auto_correct),
 * and a button to start processing. Shows progress/loading state.
 */

import { ArrowLeftIcon, PlayIcon } from '@sanity/icons'
import { Badge, Box, Button, Card, Flex, Heading, Radio, Stack, Text } from '@sanity/ui'
import { useCallback, useEffect, useState } from 'react'
import { useClient } from 'sanity'

import { resolveOriginalAssetUrl } from '../lib/sanity-assets'
import { SECRET_KEYS, SECRETS_NAMESPACE, SettingsView, useGcpSecrets } from '../lib/secrets'
import type { ProcessingMode, ProcessingResult, SanityImageAsset } from '../lib/types'
import { MODE_DESCRIPTIONS, MODE_LABELS } from '../lib/types'
import { processImage } from '../lib/vertex'
import { ComparisonSlider } from './ReviewPanel'

interface ProcessingPanelProps {
  asset: SanityImageAsset
  onResult: (result: ProcessingResult, mode: ProcessingMode, originalAssetId: string) => void
  onBack: () => void
}

export function ProcessingPanel({ asset, onResult, onBack }: ProcessingPanelProps) {
  const [mode, setMode] = useState<ProcessingMode>('auto_correct')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSecrets, setShowSecrets] = useState(false)
  const client = useClient({ apiVersion: '2025-01-12' })

  const { loading: secretsLoading, config: gcpConfig } = useGcpSecrets()
  const configured = gcpConfig !== null

  const handleProcess = useCallback(async () => {
    setIsProcessing(true)
    setError(null)

    try {
      // Resolve original image URL (avoids double-processing)
      const { url: sourceUrl, originalAssetId } = await resolveOriginalAssetUrl(client, asset)
      const result = await processImage(sourceUrl, mode, gcpConfig!)

      onResult(result, mode, originalAssetId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur inattendue est survenue.')
    } finally {
      setIsProcessing(false)
    }
  }, [asset, mode, onResult, gcpConfig])

  // Preview URL (larger than thumbnail)
  const previewUrl = `${asset.url}?w=2400&auto=format&q=90`

  // For already-processed images, resolve the original URL for comparison
  const isProcessed = asset.label === 'cloudinary-processed' || asset.label === 'ai-processed'
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)

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
      {/* Header with back button */}
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
      </Flex>

      <Stack space={4}>
        {/* Source image preview — comparison slider for already-processed images */}
        <Box>
          {isProcessed && originalUrl ? (
            <Stack space={2}>
              <Flex gap={3} align="center">
                <Text size={1} weight="semibold">
                  Avant / Après (traitement précédent)
                </Text>
                <Text size={0} muted>
                  Glissez le curseur pour comparer
                </Text>
              </Flex>
              <ComparisonSlider beforeUrl={originalUrl} afterUrl={previewUrl} />
            </Stack>
          ) : (
            <Card radius={2} shadow={1} style={{ overflow: 'hidden', position: 'relative' }}>
              <img
                src={previewUrl}
                alt={asset.originalFilename ?? 'Image source'}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
              {isProcessed && (
                <Box style={{ position: 'absolute', top: 12, right: 12 }}>
                  <Badge tone="positive" fontSize={1} mode="outline">
                    Corrigée
                  </Badge>
                </Box>
              )}
            </Card>
          )}
          <Box paddingTop={2}>
            <Text size={0} muted>
              {asset.originalFilename ?? 'Image'}
              {asset.metadata?.dimensions &&
                ` — ${asset.metadata.dimensions.width}×${asset.metadata.dimensions.height}`}
            </Text>
          </Box>
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
                    <Text size={1} weight="semibold">
                      {MODE_LABELS[m]}
                    </Text>
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

          {/* Process button */}
          <Button
            icon={isProcessing ? null : PlayIcon}
            text={isProcessing ? 'Traitement en cours…' : 'Lancer le traitement'}
            tone="positive"
            onClick={handleProcess}
            disabled={isProcessing || !configured}
            fontSize={1}
            padding={3}
          />

          {isProcessing && (
            <Flex gap={2} align="center" justify="center">
              <Text size={0} muted>
                Analyse + correction en cours…
              </Text>
            </Flex>
          )}
        </Stack>
      </Stack>
    </Stack>
  )
}
