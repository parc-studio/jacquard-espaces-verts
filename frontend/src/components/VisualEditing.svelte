<script lang="ts">
  import { enableVisualEditing } from '@sanity/visual-editing'
  import { navigate as astroNavigate } from 'astro:transitions/client'
  import { onMount } from 'svelte'

  interface Props {
    pagePath?: string
    zIndex?: number
  }

  let { pagePath, zIndex = 9999 }: Props = $props()

  /** Ensure a path is prefixed with /preview exactly once, without trailing slashes */
  function toPreviewUrl(path: string, search = '') {
    const clean = path.replace(/^\/preview\/?/, '').replace(/^\/+|\/+$/g, '')
    const previewPath = clean ? `/preview/${clean}` : '/preview'
    return `${previewPath}${search}`
  }

  onMount(() => {
    let reportUrl: ((url: string) => void) | null = null
    let reloadTimer: ReturnType<typeof setTimeout> | null = null

    const onLinkClick = (e: MouseEvent) => {
      const anchor = (e.target as Element)?.closest?.('a')
      const href = anchor?.getAttribute('href')
      if (href?.startsWith('/') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        reportUrl?.(toPreviewUrl(href))
      }
    }
    document.addEventListener('click', onLinkClick, true)

    const disable = enableVisualEditing({
      zIndex,
      refresh: async (payload) => {
        if (payload.source === 'mutation' || payload.source === 'manual') {
          if (reloadTimer) clearTimeout(reloadTimer)
          reloadTimer = setTimeout(
            () =>
              astroNavigate(toPreviewUrl(location.pathname, location.search), {
                history: 'replace',
              }),
            payload.source === 'mutation' ? 400 : 0
          )
        }
      },
      history: {
        subscribe: (navigate) => {
          reportUrl = (url) => navigate({ type: 'push', url })
          const initialPath = pagePath || location.pathname
          reportUrl(toPreviewUrl(initialPath, location.search))

          const onPopState = () => reportUrl?.(toPreviewUrl(location.pathname, location.search))
          window.addEventListener('popstate', onPopState)

          return () => {
            reportUrl = null
            window.removeEventListener('popstate', onPopState)
          }
        },
        update: (update) => {
          if (update.type === 'pop') return window.history.back()
          const url = toPreviewUrl(update.url)
          astroNavigate(url, update.type === 'replace' ? { history: 'replace' } : undefined)
        },
      },
    })

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer)
      document.removeEventListener('click', onLinkClick, true)
      disable()
    }
  })
</script>
