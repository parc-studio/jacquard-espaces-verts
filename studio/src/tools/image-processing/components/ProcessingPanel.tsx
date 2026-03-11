/**
 * ProcessingPanel — Step 2: Choose processing mode, preview source, and trigger Vertex AI.
 *
 * Displays the selected image, mode selection (equalize / cadrage),
 * and a button to start processing. Shows progress/loading state.
 */

import { ArrowLeftIcon, PlayIcon } from '@sanity/icons'
import { Badge, Box, Button, Card, Flex, Heading, Radio, Stack, Text } from '@sanity/ui'
import { useCallback, useState } from 'react'
import { useClient } from 'sanity'

import { resolveOriginalAssetUrl } from '../lib/sanity-assets'
import type { ProcessingMode, ProcessingResult, SanityImageAsset } from '../lib/types'
import { MODE_DESCRIPTIONS, MODE_LABELS } from '../lib/types'
import { isVertexConfigured, processImage } from '../lib/vertex'

interface ProcessingPanelProps {
  asset: SanityImageAsset
  onResult: (result: ProcessingResult, mode: ProcessingMode) => void
  onBack: () => void
}

export function ProcessingPanel({ asset, onResult, onBack }: ProcessingPanelProps) {
  const [mode, setMode] = useState<ProcessingMode>('auto_correct')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const client = useClient({ apiVersion: '2025-01-12' })

  const configured = isVertexConfigured()

  const handleProcess = useCallback(async () => {
    setIsProcessing(true)
    setError(null)

    try {
      // Resolve original image URL (avoids double-processing)
      const { url: sourceUrl } = await resolveOriginalAssetUrl(client, asset)
      const result = await processImage(sourceUrl, mode)

      onResult(result, mode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur inattendue est survenue.')
    } finally {
      setIsProcessing(false)
    }
  }, [asset, mode, onResult])

  // Preview URL (larger than thumbnail)
  const previewUrl = `${asset.url}?w=800&auto=format&q=85`

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

      <Flex gap={4} wrap="wrap">
        {/* Source image preview */}
        <Box style={{ flex: '1 1 400px', maxWidth: 600 }}>
          <Card radius={2} shadow={1} style={{ overflow: 'hidden', position: 'relative' }}>
            <img
              src={previewUrl}
              alt={asset.originalFilename ?? 'Image source'}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
            {(asset.label === 'cloudinary-processed' || asset.label === 'ai-processed') && (
              <Box style={{ position: 'absolute', top: 12, right: 12 }}>
                <Badge tone="positive" fontSize={1} mode="outline">
                  Corrigée
                </Badge>
              </Box>
            )}
          </Card>
          <Box paddingTop={2}>
            <Text size={0} muted>
              {asset.originalFilename ?? 'Image'}
              {asset.metadata?.dimensions &&
                ` — ${asset.metadata.dimensions.width}×${asset.metadata.dimensions.height}`}
            </Text>
          </Box>
        </Box>

        {/* Controls */}
        <Box style={{ flex: '1 1 280px', maxWidth: 400 }}>
          <Stack space={4}>
            {/* API key warning */}
            {!configured && (
              <Card padding={3} tone="caution" radius={2}>
                <Text size={1}>
                  Identifiants GCP manquants ou Studio non-local. Ajoutez{' '}
                  <code>SANITY_STUDIO_GCP_*</code> dans <code>.env</code> et lancez le Studio en
                  local.
                </Text>
              </Card>
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
                <Text size={1}>{error}</Text>
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
        </Box>
      </Flex>
    </Stack>
  )
}
