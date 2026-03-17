/**
 * VideoLibraryPanel — Lists all AI-generated videos with source image thumbnails.
 *
 * Queries `sanity.fileAsset` documents tagged with `label == "ai-video"` and
 * shows a grid of video cards with source image references.
 */

import { PlayIcon, ResetIcon } from '@sanity/icons'
import { Badge, Box, Button, Card, Flex, Grid, Heading, Spinner, Stack, Text } from '@sanity/ui'
import { useCallback, useEffect, useState } from 'react'
import { useClient } from 'sanity'

import { fetchVideoAssets } from '../lib/sanity-assets'
import type { VideoAsset } from '../lib/types'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function VideoLibraryPanel() {
  const client = useClient({ apiVersion: '2025-01-12' })
  const [videos, setVideos] = useState<VideoAsset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await fetchVideoAssets(client)
      setVideos(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des vidéos.')
    } finally {
      setIsLoading(false)
    }
  }, [client])

  useEffect(() => {
    load()
  }, [load])

  if (isLoading) {
    return (
      <Card padding={5} radius={2}>
        <Flex justify="center" align="center" gap={3}>
          <Spinner muted />
          <Text size={1} muted>
            Chargement des vidéos…
          </Text>
        </Flex>
      </Card>
    )
  }

  if (error) {
    return (
      <Card padding={4} radius={2} tone="critical">
        <Stack space={3}>
          <Text size={1}>{error}</Text>
          <Button icon={ResetIcon} text="Réessayer" onClick={load} mode="ghost" fontSize={1} />
        </Stack>
      </Card>
    )
  }

  if (videos.length === 0) {
    return (
      <Card padding={5} radius={2} tone="transparent">
        <Stack space={3} style={{ textAlign: 'center' }}>
          <Text size={2}>
            <PlayIcon />
          </Text>
          <Text size={1} muted>
            Aucune vidéo générée pour le moment.
          </Text>
          <Text size={0} muted>
            Générez une vidéo depuis un traitement d'image pour la voir apparaître ici.
          </Text>
        </Stack>
      </Card>
    )
  }

  return (
    <Stack space={4}>
      <Flex gap={2} align="center" justify="space-between">
        <Heading as="h2" size={1}>
          Vidéos générées ({videos.length})
        </Heading>
        <Button icon={ResetIcon} mode="bleed" onClick={load} padding={2} title="Rafraîchir" />
      </Flex>

      <Grid columns={[1, 1, 2]} gap={4}>
        {videos.map((video) => (
          <Card key={video._id} radius={2} shadow={1} overflow="hidden">
            <Stack space={0}>
              {/* Video preview */}
              <Box style={{ background: '#000', position: 'relative' }}>
                <video
                  src={video.url}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLVideoElement
                    el.pause()
                    el.currentTime = 0
                  }}
                />
                <Badge
                  tone="primary"
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    pointerEvents: 'none',
                  }}
                  fontSize={0}
                >
                  <Flex gap={1} align="center">
                    <PlayIcon />
                    Vidéo
                  </Flex>
                </Badge>
              </Box>

              {/* Info */}
              <Box padding={3}>
                <Stack space={3}>
                  {/* Source image row */}
                  {video.sourceImageUrl && (
                    <Flex gap={3} align="center">
                      <Box
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 4,
                          overflow: 'hidden',
                          flexShrink: 0,
                          background: '#f0f0f0',
                        }}
                      >
                        <img
                          src={`${video.sourceImageUrl}?w=96&h=96&fit=crop`}
                          alt="Image source"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </Box>
                      <Stack space={1}>
                        <Text size={0} weight="semibold">
                          Image source
                        </Text>
                        <Text size={0} muted>
                          {video.sourceImageFilename ?? 'Image inconnue'}
                        </Text>
                      </Stack>
                    </Flex>
                  )}

                  {!video.sourceImageUrl && video.sourceImageId && (
                    <Text size={0} muted>
                      Source : {video.sourceImageId}
                    </Text>
                  )}

                  {/* Filename + date */}
                  <Stack space={1}>
                    <Text size={0} muted>
                      {video.originalFilename ?? 'Vidéo sans nom'}
                    </Text>
                    <Text size={0} muted>
                      {formatDate(video.createdAt)}
                    </Text>
                  </Stack>
                </Stack>
              </Box>
            </Stack>
          </Card>
        ))}
      </Grid>
    </Stack>
  )
}
