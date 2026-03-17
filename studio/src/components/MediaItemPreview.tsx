/**
 * Custom preview component for `media` items inside an array grid.
 *
 * Shows the image thumbnail with a ▶ play-badge overlay when a video URL
 * is present, so editors can immediately tell which gallery items have video.
 */

import { PlayIcon } from '@sanity/icons'
import { Box, Flex } from '@sanity/ui'
import { type PreviewProps } from 'sanity'

export function MediaItemPreview(props: PreviewProps & { videoUrl?: string }) {
  const { videoUrl, ...restProps } = props

  return (
    <Box style={{ position: 'relative' }}>
      {/* Default preview (image thumbnail) */}
      {props.renderDefault(restProps)}

      {/* Video badge overlay */}
      {videoUrl && (
        <Flex
          align="center"
          justify="center"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            pointerEvents: 'none',
          }}
        >
          <Flex
            align="center"
            justify="center"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.9)',
              color: '#1a1a1a',
              fontSize: 18,
            }}
          >
            <PlayIcon />
          </Flex>
        </Flex>
      )}
    </Box>
  )
}
