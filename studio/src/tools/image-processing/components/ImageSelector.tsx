/**
 * ImageSelector — Step 1: Browse and select a Sanity image to process.
 *
 * Displays projects grouped with their images, or a flat list of all assets.
 * User clicks an image thumbnail to select it for processing.
 */

import { SearchIcon } from '@sanity/icons'
import { Box, Button, Card, Flex, Grid, Heading, Spinner, Stack, Text, TextInput } from '@sanity/ui'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useClient } from 'sanity'

import { fetchAllImageAssets, fetchProjectsWithImages } from '../lib/sanity-assets'
import type { ProjectWithImages, SanityImageAsset } from '../lib/types'

type BrowseMode = 'projects' | 'all'

interface ImageSelectorProps {
  onSelect: (asset: SanityImageAsset, projectId: string | null) => void
}

export function ImageSelector({ onSelect }: ImageSelectorProps) {
  const client = useClient({ apiVersion: '2025-01-12' })
  const [browseMode, setBrowseMode] = useState<BrowseMode>('projects')
  const [projects, setProjects] = useState<ProjectWithImages[]>([])
  const [allAssets, setAllAssets] = useState<SanityImageAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

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
  }, [client, browseMode])

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
              <Flex gap={2} align="baseline">
                <Text size={1} weight="semibold">
                  {project.titre}
                </Text>
                {project.localisation && (
                  <Text size={0} muted>
                    — {project.localisation}
                  </Text>
                )}
              </Flex>
              <Grid columns={[2, 3, 4, 5]} gap={2}>
                {project.images.map((asset) => (
                  <ImageThumbnail
                    key={asset._id}
                    asset={asset}
                    onClick={() => handleSelect(asset, project._id)}
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
              />
            ))}
          </Grid>
        </>
      )}
    </Stack>
  )
}

/** Thumbnail card for a single image asset */
function ImageThumbnail({ asset, onClick }: { asset: SanityImageAsset; onClick: () => void }) {
  // Use CDN params for a small thumbnail
  const thumbUrl = `${asset.url}?w=300&h=200&fit=crop&auto=format&q=75`
  const dims = asset.metadata?.dimensions

  return (
    <Card
      as="button"
      type="button"
      onClick={onClick}
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
      }}
    >
      <Box style={{ position: 'relative', paddingBottom: '66.67%', background: '#f0f0f0' }}>
        <img
          src={thumbUrl}
          alt={asset.originalFilename ?? 'Image'}
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
      </Box>
      <Box padding={2}>
        <Text size={0} muted textOverflow="ellipsis">
          {asset.originalFilename ?? 'Sans nom'}
        </Text>
        {dims && (
          <Text size={0} muted>
            {dims.width}×{dims.height}
          </Text>
        )}
      </Box>
    </Card>
  )
}
