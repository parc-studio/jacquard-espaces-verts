/**
 * ImageProcessingTool — Main component for the "Traitement d'image" Studio tool.
 *
 * Manages the workflow:
 *   1. Select an image  (ImageSelector)
 *   2. Choose mode and process  (ProcessingPanel)
 *   3. Review result and accept/regenerate/discard  (ReviewPanel)
 *   — or —
 *   Bulk-process all images of a project  (BulkProcessingPanel)
 */

import { CheckmarkCircleIcon } from '@sanity/icons'
import { Box, Card, Container, Flex, Stack, Text } from '@sanity/ui'
import { useCallback, useState } from 'react'

import { BulkProcessingPanel } from './components/BulkProcessingPanel'
import { ImageSelector } from './components/ImageSelector'
import { ProcessingPanel } from './components/ProcessingPanel'
import { ReviewPanel } from './components/ReviewPanel'
import type {
  ProcessingMode,
  ProcessingResult,
  ProjectWithImages,
  SanityImageAsset,
  WorkflowStep,
} from './lib/types'

export function ImageProcessingTool() {
  const [step, setStep] = useState<WorkflowStep>('select')
  const [selectedAsset, setSelectedAsset] = useState<SanityImageAsset | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<ProjectWithImages | null>(null)
  const [result, setResult] = useState<ProcessingResult | null>(null)
  const [mode, setMode] = useState<ProcessingMode | null>(null)
  const [originalAssetId, setOriginalAssetId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // ------------------------------------------------------------------
  // Single-image workflow
  // ------------------------------------------------------------------

  // Step 1 → Step 2: image selected
  const handleImageSelect = useCallback((asset: SanityImageAsset, projectId: string | null) => {
    setSelectedAsset(asset)
    setSelectedProjectId(projectId)
    setResult(null)
    setMode(null)
    setSuccessMessage(null)
    setStep('process')
  }, [])

  // Step 2 → Step 3: processing complete
  const handleResult = useCallback(
    (
      processingResult: ProcessingResult,
      processingMode: ProcessingMode,
      procOriginalAssetId: string
    ) => {
      setResult(processingResult)
      setMode(processingMode)
      setOriginalAssetId(procOriginalAssetId)
      setStep('review')
    },
    []
  )

  // Step 2 ← back to Step 1
  const handleBackToSelect = useCallback(() => {
    setSelectedAsset(null)
    setSelectedProjectId(null)
    setResult(null)
    setMode(null)
    setOriginalAssetId(null)
    setSuccessMessage(null)
    setStep('select')
  }, [])

  // Step 3: regenerate → back to Step 2 with same asset
  const handleRegenerate = useCallback(() => {
    setResult(null)
    setOriginalAssetId(null)
    setStep('process')
  }, [])

  // Step 3: discard → back to Step 1
  const handleDiscard = useCallback(() => {
    setSelectedAsset(null)
    setSelectedProjectId(null)
    setResult(null)
    setMode(null)
    setOriginalAssetId(null)
    setStep('select')
  }, [])

  // Step 3: accepted → show success, back to Step 1
  const handleAccepted = useCallback(
    (newAssetId: string) => {
      const replacedMsg = selectedProjectId
        ? ' L\u2019image a été remplacée dans la galerie du projet.'
        : ' Vous pouvez maintenant l\u2019utiliser dans vos documents.'
      setSuccessMessage(`Image enregistrée avec succès (${newAssetId}).${replacedMsg}`)
      setSelectedAsset(null)
      setSelectedProjectId(null)
      setResult(null)
      setMode(null)
      setOriginalAssetId(null)
      setStep('select')
    },
    [selectedProjectId]
  )

  // ------------------------------------------------------------------
  // Bulk workflow
  // ------------------------------------------------------------------

  const handleBulkSelect = useCallback((project: ProjectWithImages) => {
    setSuccessMessage(null)
    setSelectedProject(project)
    setStep('bulk')
  }, [])

  const handleBulkDone = useCallback((processed: number, failed: number) => {
    const parts: string[] = []
    if (processed > 0)
      parts.push(`${processed} image${processed > 1 ? 's' : ''} traitée${processed > 1 ? 's' : ''}`)
    if (failed > 0) parts.push(`${failed} erreur${failed > 1 ? 's' : ''}`)
    setSuccessMessage(parts.join(', ') + '.')
    setSelectedProject(null)
    setStep('select')
  }, [])

  const handleBulkCancel = useCallback(() => {
    setSelectedProject(null)
    setStep('select')
  }, [])

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

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
          {step === 'select' && (
            <ImageSelector onSelect={handleImageSelect} onBulkSelect={handleBulkSelect} />
          )}

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
              projectId={selectedProjectId}
              originalAssetId={originalAssetId ?? selectedAsset._id}
              onRegenerate={handleRegenerate}
              onDiscard={handleDiscard}
              onAccepted={handleAccepted}
            />
          )}

          {step === 'bulk' && selectedProject && (
            <BulkProcessingPanel
              project={selectedProject}
              onDone={handleBulkDone}
              onCancel={handleBulkCancel}
            />
          )}
        </Stack>
      </Container>
    </Box>
  )
}
