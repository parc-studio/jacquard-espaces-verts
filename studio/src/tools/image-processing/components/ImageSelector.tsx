/**
 * ImageSelector — Step 1: Browse and select a Sanity image to process.
 *
 * Displays projects grouped with their images, or a flat list of all assets.
 * User clicks an image thumbnail to select it for processing.
 */

import { PlayIcon, ResetIcon, SearchIcon } from '@sanity/icons'
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Spinner,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@sanity/ui'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useClient } from 'sanity'

import {
  fetchAllImageAssets,
  fetchProjectsWithImages,
  humanizeFilename,
  revertProcessedImage,
} from '../lib/sanity-assets'
import type { ProjectWithImages, SanityImageAsset } from '../lib/types'

type BrowseMode = 'projects' | 'all'

interface ImageSelectorProps {
  onSelect: (asset: SanityImageAsset, projectId: string | null) => void
  onBulkSelect?: (project: ProjectWithImages) => void
}

export function ImageSelector({ onSelect, onBulkSelect }: ImageSelectorProps) {
  const client = useClient({ apiVersion: '2025-01-12' })
  const [browseMode, setBrowseMode] = useState<BrowseMode>('projects')
  const [projects, setProjects] = useState<ProjectWithImages[]>([])
  const [allAssets, setAllAssets] = useState<SanityImageAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  // Fetch data based on browse mode
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const load = async () => {
      try {
        if (browseMode === 'projects') {
          const data = await fetchProjectsWithImages(client)
          if (!cancelled) setProjects(data)
        } else {
          const data = await fetchAllImageAssets(client)
          if (!cancelled) setAllAssets(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur de chargement.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [client, browseMode, refreshKey])

  // Revert a processed image back to its original
  const handleRevert = useCallback(
    async (asset: SanityImageAsset) => {
      if (
        !window.confirm('Restaurer l\u2019image originale ? L\u2019image traitée sera supprimée.')
      ) {
        return
      }
      try {
        await revertProcessedImage(client, asset._id)
        setRefreshKey((k) => k + 1)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors de la restauration.')
      }
    },
    [client]
  )

  // Filter projects by search term
  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects
    const q = search.toLowerCase()
    return projects.filter(
      (p) => p.titre?.toLowerCase().includes(q) || p.localisation?.toLowerCase().includes(q)
    )
  }, [projects, search])

  // Filter all assets by filename
  const filteredAssets = useMemo(() => {
    if (!search.trim()) return allAssets
    const q = search.toLowerCase()
    return allAssets.filter((a) => a.originalFilename?.toLowerCase().includes(q))
  }, [allAssets, search])

  const handleSelect = useCallback(
    (asset: SanityImageAsset, projectId: string | null) => {
      onSelect(asset, projectId)
    },
    [onSelect]
  )

  return (
    <Stack space={4}>
      {/* Header with mode toggle */}
      <Flex gap={3} align="center" wrap="wrap">
        <Heading as="h2" size={1}>
          Sélectionner une image
        </Heading>
        <Flex gap={2} style={{ marginLeft: 'auto' }}>
          <Button
            text="Par projet"
            mode={browseMode === 'projects' ? 'default' : 'ghost'}
            tone={browseMode === 'projects' ? 'primary' : undefined}
            onClick={() => setBrowseMode('projects')}
            fontSize={1}
            padding={2}
          />
          <Button
            text="Toutes les images"
            mode={browseMode === 'all' ? 'default' : 'ghost'}
            tone={browseMode === 'all' ? 'primary' : undefined}
            onClick={() => setBrowseMode('all')}
            fontSize={1}
            padding={2}
          />
        </Flex>
      </Flex>

      {/* Search */}
      <TextInput
        icon={SearchIcon}
        placeholder={
          browseMode === 'projects' ? 'Rechercher un projet…' : 'Rechercher par nom de fichier…'
        }
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        fontSize={1}
      />

      {/* Loading */}
      {loading && (
        <Flex justify="center" padding={5}>
          <Spinner muted />
        </Flex>
      )}

      {/* Error */}
      {error && (
        <Card padding={3} tone="critical" radius={2}>
          <Text size={1}>{error}</Text>
        </Card>
      )}

      {/* Project grid */}
      {!loading && !error && browseMode === 'projects' && (
        <Stack space={5}>
          {filteredProjects.length === 0 && (
            <Card padding={4} tone="transparent">
              <Text size={1} muted>
                Aucun projet avec des images trouvé.
              </Text>
            </Card>
          )}
          {filteredProjects.map((project) => (
            <Stack key={project._id} space={3}>
              <Flex gap={2} align="center" wrap="wrap">
                <Text size={1} weight="semibold">
                  {project.titre}
                </Text>
                {project.localisation && (
                  <Text size={0} muted>
                    — {project.localisation}
                  </Text>
                )}
                <Badge tone="default" fontSize={0}>
                  {project.images.length} image{project.images.length > 1 ? 's' : ''}
                </Badge>
                {onBulkSelect && (
                  <Tooltip
                    content={
                      <Box padding={2}>
                        <Text size={1}>Traiter toutes les images (Lumière + Cadrage)</Text>
                      </Box>
                    }
                    placement="top"
                  >
                    <Button
                      icon={PlayIcon}
                      text="Traiter tout"
                      mode="ghost"
                      tone="primary"
                      fontSize={0}
                      padding={2}
                      onClick={() => onBulkSelect(project)}
                      style={{ marginLeft: 'auto' }}
                    />
                  </Tooltip>
                )}
              </Flex>
              <Grid columns={[2, 3, 4, 5]} gap={2}>
                {project.images.map((asset) => (
                  <ImageThumbnail
                    key={asset._id}
                    asset={asset}
                    onClick={() => handleSelect(asset, project._id)}
                    onRevert={() => handleRevert(asset)}
                  />
                ))}
              </Grid>
            </Stack>
          ))}
        </Stack>
      )}

      {/* All assets grid */}
      {!loading && !error && browseMode === 'all' && (
        <>
          {filteredAssets.length === 0 && (
            <Card padding={4} tone="transparent">
              <Text size={1} muted>
                Aucune image trouvée.
              </Text>
            </Card>
          )}
          <Grid columns={[2, 3, 4, 5]} gap={2}>
            {filteredAssets.map((asset) => (
              <ImageThumbnail
                key={asset._id}
                asset={asset}
                onClick={() => handleSelect(asset, null)}
                onRevert={() => handleRevert(asset)}
              />
            ))}
          </Grid>
        </>
      )}
    </Stack>
  )
}

/** Thumbnail card for a single image asset */
function ImageThumbnail({
  asset,
  onClick,
  onRevert,
}: {
  asset: SanityImageAsset
  onClick: () => void
  onRevert: () => void
}) {
  const thumbUrl = `${asset.url}?w=600&h=400&fit=crop&auto=format&q=85`
  const dims = asset.metadata?.dimensions
  const displayName = humanizeFilename(asset.originalFilename)
  const isProcessed = asset.label === 'cloudinary-processed' || asset.label === 'ai-processed'

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      padding={0}
      radius={2}
      shadow={1}
      style={{
        cursor: 'pointer',
        overflow: 'hidden',
        border: 'none',
        background: 'none',
        display: 'block',
        width: '100%',
        transition: 'box-shadow 150ms ease',
      }}
      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
        ;(e.currentTarget as HTMLElement).style.boxShadow =
          '0 0 0 2px var(--card-focus-ring-color, #2276fc)'
      }}
      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
        ;(e.currentTarget as HTMLElement).style.boxShadow = ''
      }}
    >
      <Box style={{ position: 'relative', paddingBottom: '66.67%', background: '#f0f0f0' }}>
        <img
          src={thumbUrl}
          alt={displayName}
          loading="lazy"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
        {(asset.label === 'cloudinary-processed' || asset.label === 'ai-processed') && (
          <Box style={{ position: 'absolute', top: 4, right: 4 }}>
            <Badge tone="positive" fontSize={0} mode="outline">
              Corrigée
            </Badge>
          </Box>
        )}
      </Box>
      <Box padding={3}>
        <Flex align="center" gap={2}>
          <Box
            style={{
              flex: 1,
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {dims && (
              <Text size={1} weight="semibold">
                {dims.width}×{dims.height}
              </Text>
            )}
            <Text
              size={0}
              muted
              style={{ marginTop: 6 }}
              textOverflow="ellipsis"
              title={asset.originalFilename ?? 'Sans nom'}
            >
              {displayName}
            </Text>
          </Box>
          {isProcessed && (
            <Tooltip
              content={
                <Box padding={2}>
                  <Text size={1}>Restaurer l'original</Text>
                </Box>
              }
              placement="top"
            >
              <Button
                icon={ResetIcon}
                mode="ghost"
                tone="caution"
                fontSize={0}
                padding={1}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation()
                  onRevert()
                }}
              />
            </Tooltip>
          )}
        </Flex>
      </Box>
    </Card>
  )
}
