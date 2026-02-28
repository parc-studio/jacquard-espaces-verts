/**
 * ImageProcessingTool — Main component for the "Traitement IA" Studio tool.
 *
 * Manages the three-step workflow:
 *   1. Select an image (ImageSelector)
 *   2. Choose mode and process (ProcessingPanel)
 *   3. Review result and accept/regenerate/discard (ReviewPanel)
 */

import { CheckmarkCircleIcon } from '@sanity/icons'
import { Box, Card, Container, Flex, Stack, Text } from '@sanity/ui'
import { useCallback, useState } from 'react'

import { ImageSelector } from './components/ImageSelector'
import { ProcessingPanel } from './components/ProcessingPanel'
import { ReviewPanel } from './components/ReviewPanel'
import type { ProcessingMode, ProcessingResult, SanityImageAsset, WorkflowStep } from './lib/types'

export function ImageProcessingTool() {
  const [step, setStep] = useState<WorkflowStep>('select')
  const [selectedAsset, setSelectedAsset] = useState<SanityImageAsset | null>(null)
  const [result, setResult] = useState<ProcessingResult | null>(null)
  const [mode, setMode] = useState<ProcessingMode | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Step 1 → Step 2: image selected
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleImageSelect = useCallback((asset: SanityImageAsset, _projectId: string | null) => {
    setSelectedAsset(asset)
    setResult(null)
    setMode(null)
    setSuccessMessage(null)
    setStep('process')
  }, [])

  // Step 2 → Step 3: processing complete
  const handleResult = useCallback(
    (processingResult: ProcessingResult, processingMode: ProcessingMode) => {
      setResult(processingResult)
      setMode(processingMode)
      setStep('review')
    },
    []
  )

  // Step 2 ← back to Step 1
  const handleBackToSelect = useCallback(() => {
    setSelectedAsset(null)
    setResult(null)
    setMode(null)
    setSuccessMessage(null)
    setStep('select')
  }, [])

  // Step 3: regenerate → back to Step 2 with same asset
  const handleRegenerate = useCallback(() => {
    setResult(null)
    setStep('process')
  }, [])

  // Step 3: discard → back to Step 1
  const handleDiscard = useCallback(() => {
    setSelectedAsset(null)
    setResult(null)
    setMode(null)
    setStep('select')
  }, [])

  // Step 3: accepted → show success, back to Step 1
  const handleAccepted = useCallback((newAssetId: string) => {
    setSuccessMessage(
      `Image enregistrée avec succès dans Sanity (${newAssetId}). Vous pouvez maintenant l'utiliser dans vos documents.`
    )
    setSelectedAsset(null)
    setResult(null)
    setMode(null)
    setStep('select')
  }, [])

  return (
    <Box padding={4} style={{ height: '100%', overflow: 'auto' }}>
      <Container width={2}>
        <Stack space={4}>
          {/* Success banner */}
          {successMessage && (
            <Card padding={3} tone="positive" radius={2}>
              <Flex gap={2} align="center">
                <Text size={2}>
                  <CheckmarkCircleIcon />
                </Text>
                <Text size={1}>{successMessage}</Text>
              </Flex>
            </Card>
          )}

          {/* Step routing */}
          {step === 'select' && <ImageSelector onSelect={handleImageSelect} />}

          {step === 'process' && selectedAsset && (
            <ProcessingPanel
              asset={selectedAsset}
              onResult={handleResult}
              onBack={handleBackToSelect}
            />
          )}

          {step === 'review' && selectedAsset && result && mode && (
            <ReviewPanel
              asset={selectedAsset}
              result={result}
              mode={mode}
              onRegenerate={handleRegenerate}
              onDiscard={handleDiscard}
              onAccepted={handleAccepted}
            />
          )}
        </Stack>
      </Container>
    </Box>
  )
}
