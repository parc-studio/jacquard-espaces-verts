/**
 * ProcessingPanel — Step 2: Choose processing mode, preview source, and trigger Gemini.
 *
 * Displays the selected image, mode selection (equalize / cadrage),
 * and a button to start processing. Shows progress/loading state.
 */

import { ArrowLeftIcon, PlayIcon } from '@sanity/icons'
import { Box, Button, Card, Flex, Heading, Radio, Spinner, Stack, Text } from '@sanity/ui'
import { useCallback, useState } from 'react'

import { isGeminiConfigured, processImage } from '../lib/gemini'
import { fetchImageAsBase64 } from '../lib/sanity-assets'
import { MODE_DESCRIPTIONS, MODE_LABELS } from '../lib/prompts'
import type { ProcessingMode, ProcessingResult, SanityImageAsset } from '../lib/types'

interface ProcessingPanelProps {
  asset: SanityImageAsset
  onResult: (result: ProcessingResult, mode: ProcessingMode) => void
  onBack: () => void
}

export function ProcessingPanel({ asset, onResult, onBack }: ProcessingPanelProps) {
  const [mode, setMode] = useState<ProcessingMode>('equalize')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const configured = isGeminiConfigured()

  const handleProcess = useCallback(async () => {
    setIsProcessing(true)
    setError(null)

    try {
      // Fetch source image as base64
      const { base64, mimeType } = await fetchImageAsBase64(asset.url)

      // Send to Gemini
      const result = await processImage(base64, mimeType, mode)

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
          <Card radius={2} shadow={1} style={{ overflow: 'hidden' }}>
            <img
              src={previewUrl}
              alt={asset.originalFilename ?? 'Image source'}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
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
                  Clé API Gemini non configurée. Ajoutez <code>SANITY_STUDIO_GEMINI_API_KEY</code>{' '}
                  dans votre fichier <code>.env</code>.
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
              icon={isProcessing ? Spinner : PlayIcon}
              text={isProcessing ? 'Traitement en cours…' : 'Lancer le traitement'}
              tone="positive"
              onClick={handleProcess}
              disabled={isProcessing || !configured}
              fontSize={1}
              padding={3}
            />

            {isProcessing && (
              <Flex gap={2} align="center" justify="center">
                <Spinner muted />
                <Text size={0} muted>
                  Envoi à Gemini et génération de l&apos;image…
                </Text>
              </Flex>
            )}
          </Stack>
        </Box>
      </Flex>
    </Stack>
  )
}
