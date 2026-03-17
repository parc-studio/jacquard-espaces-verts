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

import { CheckmarkCircleIcon, CogIcon, ImageIcon, PlayIcon } from '@sanity/icons'
import { Box, Button, Card, Container, Flex, Stack, Tab, TabList, TabPanel, Text } from '@sanity/ui'
import { useCallback, useEffect, useState } from 'react'
import { useClient, useCurrentUser } from 'sanity'
import { useRouter } from 'sanity/router'

import { fetchImageAsset, revertProcessedImage, revertVideo } from './lib/sanity-assets'

import { BulkProcessingPanel } from './components/BulkProcessingPanel'
import { ImageSelector } from './components/ImageSelector'
import { ProcessingPanel } from './components/ProcessingPanel'
import { ReviewPanel } from './components/ReviewPanel'
import { VideoLibraryPanel } from './components/VideoLibraryPanel'
import { VideoReviewPanel } from './components/VideoReviewPanel'
import { SECRET_KEYS, SECRETS_NAMESPACE, SettingsView } from './lib/secrets'
import type {
  ProcessingMode,
  ProcessingResult,
  ProjectWithImages,
  SanityImageAsset,
  WorkflowStep,
} from './lib/types'
import { MODE_LABELS } from './lib/types'

function getAppliedMode(asset: SanityImageAsset | null): ProcessingMode | null {
  if (!asset || (asset.label !== 'ai-processed' && asset.label !== 'cloudinary-processed')) {
    return null
  }

  return (asset.description?.match(/Mode:\s*(\S+)/)?.[1] as ProcessingMode | undefined) ?? null
}

export function ImageProcessingTool() {
  const [step, setStep] = useState<WorkflowStep>('select')
  const [selectedAsset, setSelectedAsset] = useState<SanityImageAsset | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<ProjectWithImages | null>(null)
  const [result, setResult] = useState<ProcessingResult | null>(null)
  const [mode, setMode] = useState<ProcessingMode | null>(null)
  const [originalAssetId, setOriginalAssetId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showSecrets, setShowSecrets] = useState(false)
  const [activeTab, setActiveTab] = useState<'processing' | 'videos'>('processing')

  const client = useClient({ apiVersion: '2025-01-12' })

  // Router state — keep for asset deep-linking
  const router = useRouter()

  // Auto-dismiss success banner after 8 seconds
  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(null), 8_000)
    return () => clearTimeout(timer)
  }, [successMessage])

  const currentUser = useCurrentUser()
  const isAdmin = currentUser?.roles.some((r) => r.name === 'administrator') ?? false
  const appliedMode = getAppliedMode(selectedAsset)

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
    setResult(null)
    setMode(null)
    setOriginalAssetId(null)
    setSuccessMessage(null)
    setStep('select')
    router.navigate({})
  }, [router])

  // Step 3: regenerate → back to Step 2 with same asset
  const handleRegenerate = useCallback(() => {
    setResult(null)
    setOriginalAssetId(null)
    setStep('process')
  }, [])

  // Revert processed asset back to original
  const handleRevert = useCallback(async () => {
    if (!selectedAsset) return
    try {
      const { originalAssetId: origId } = await revertProcessedImage(client, selectedAsset._id)
      const original = await fetchImageAsset(client, origId)
      if (original) {
        setSelectedAsset(original)
        setSuccessMessage('Image originale restaurée.')
      }
    } catch (err) {
      console.error('Erreur lors de la restauration de l’image originale :', err)
    }
  }, [client, selectedAsset])

  // Revert video: detach from gallery + delete file asset
  const handleVideoRevert = useCallback(async () => {
    if (!selectedAsset) return
    try {
      await revertVideo(client, selectedAsset._id)
      setSelectedAsset({ ...selectedAsset, hasVideo: false })
      setSuccessMessage('Vidéo supprimée.')
    } catch (err) {
      console.error('Erreur lors de la suppression de la vidéo :', err)
    }
  }, [client, selectedAsset])

  // Step 3: discard → back to Step 1
  const handleDiscard = useCallback(() => {
    setSelectedAsset(null)
    setSelectedProjectId(null)
    setResult(null)
    setMode(null)
    setOriginalAssetId(null)
    setStep('select')
    router.navigate({})
  }, [router])

  // Step 3: accepted → stay on asset (process step) with refreshed data
  const handleAccepted = useCallback(
    async (newAssetId: string) => {
      const isVideo = mode === 'video_generate'
      const primaryMsg = isVideo
        ? 'Vidéo enregistrée avec succès.'
        : 'Image enregistrée avec succès.'
      const secondaryMsg = isVideo
        ? selectedProjectId
          ? ' La vidéo a été attachée à la galerie du projet.'
          : ' Vous pouvez retrouver la vidéo dans les fichiers Sanity.'
        : selectedProjectId
          ? ' L\u2019image a été remplacée dans la galerie du projet.'
          : ' Vous pouvez maintenant l\u2019utiliser dans vos documents.'
      setSuccessMessage(`${primaryMsg}${secondaryMsg}`)

      if (isVideo) {
        // Keep review panel mounted — VideoReviewPanel tracks its own saved state
        return
      }

      // For images, fetch the new asset so the user sees the updated version
      const newAsset = await fetchImageAsset(client, newAssetId)
      if (newAsset) setSelectedAsset(newAsset)

      setResult(null)
      setMode(null)
      setOriginalAssetId(null)
      setStep('process')
    },
    [client, selectedAsset, selectedProjectId, mode]
  )

  // ------------------------------------------------------------------
  // Bulk workflow
  // ------------------------------------------------------------------

  const handleBulkSelect = useCallback(
    (project: ProjectWithImages) => {
      setSuccessMessage(null)
      setSelectedProject(project)
      setStep('bulk')
      router.navigate({})
    },
    [router]
  )

  const handleBulkDone = useCallback(
    (processed: number, failed: number) => {
      const parts: string[] = []
      if (processed > 0)
        parts.push(
          `${processed} image${processed > 1 ? 's' : ''} traitée${processed > 1 ? 's' : ''}`
        )
      if (failed > 0) parts.push(`${failed} erreur${failed > 1 ? 's' : ''}`)
      setSuccessMessage(parts.join(', ') + '.')
      setSelectedProject(null)
      setStep('select')
      router.navigate({})
    },
    [router]
  )

  const handleBulkCancel = useCallback(() => {
    setSelectedProject(null)
    setStep('select')
    router.navigate({})
  }, [router])

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <Box padding={4} style={{ height: '100%', overflow: 'auto' }}>
      <Container width={2}>
        <Stack space={4}>
          {/* Admin config button */}
          {isAdmin && (
            <Flex justify="flex-end">
              <Button
                icon={CogIcon}
                mode="bleed"
                tone="default"
                title="Configurer la clé privée GCP"
                onClick={() => setShowSecrets(true)}
                padding={2}
              />
            </Flex>
          )}

          {showSecrets && (
            <SettingsView
              namespace={SECRETS_NAMESPACE}
              keys={SECRET_KEYS}
              onClose={() => setShowSecrets(false)}
              title="Clé privée GCP"
            />
          )}

          {/* Tab bar */}
          <TabList space={1}>
            <Tab
              aria-controls="processing-panel"
              icon={ImageIcon}
              id="processing-tab"
              label="Traitement d'image"
              onClick={() => setActiveTab('processing')}
              selected={activeTab === 'processing'}
            />
            <Tab
              aria-controls="videos-panel"
              icon={PlayIcon}
              id="videos-tab"
              label="Vidéos"
              onClick={() => setActiveTab('videos')}
              selected={activeTab === 'videos'}
            />
          </TabList>

          {/* Videos tab */}
          <TabPanel aria-labelledby="videos-tab" id="videos-panel" hidden={activeTab !== 'videos'}>
            {activeTab === 'videos' && <VideoLibraryPanel />}
          </TabPanel>

          {/* Processing tab */}
          <TabPanel
            aria-labelledby="processing-tab"
            id="processing-panel"
            hidden={activeTab !== 'processing'}
          >
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

              {selectedAsset && step !== 'select' && step !== 'bulk' && (
                <Card padding={3} radius={2} tone="transparent">
                  <Text size={1}>
                    {selectedAsset.hasVideo
                      ? `Vidéo appliquée (${MODE_LABELS.video_generate})`
                      : appliedMode
                        ? `Traitement appliqué : ${MODE_LABELS[appliedMode]}`
                        : 'Image originale — aucun traitement appliqué'}
                  </Text>
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
                  onRevert={handleRevert}
                  onVideoRevert={handleVideoRevert}
                />
              )}

              {step === 'review' &&
                selectedAsset &&
                result &&
                mode &&
                (mode === 'video_generate' ? (
                  <VideoReviewPanel
                    asset={selectedAsset}
                    result={result}
                    projectId={selectedProjectId}
                    onRegenerate={handleRegenerate}
                    onDiscard={handleDiscard}
                    onAccepted={handleAccepted}
                  />
                ) : (
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
                ))}

              {step === 'bulk' && selectedProject && (
                <BulkProcessingPanel
                  project={selectedProject}
                  onDone={handleBulkDone}
                  onCancel={handleBulkCancel}
                />
              )}
            </Stack>
          </TabPanel>
        </Stack>
      </Container>
    </Box>
  )
}
