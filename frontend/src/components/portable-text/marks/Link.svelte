<script lang="ts">
  import type { MarkComponentProps } from '@portabletext/svelte'
  import type { Snippet } from 'svelte'

  interface LinkValue {
    _key: string
    _type: 'link'
    type: string
    text?: string
    url?: string
    email?: string
    phone?: string
    value?: string
    blank?: boolean
    parameters?: string
    anchor?: string
    internalLink?: {
      _type: string
      _id: string
      slug: string | null
      title: string | null
    } | null
  }

  interface Props {
    portableText: MarkComponentProps<LinkValue>
    children: Snippet
  }

  let { portableText, children }: Props = $props()

  let value = $derived(portableText.value)

  /**
   * Resolve the href based on the link type from sanity-plugin-link-field
   */
  let href = $derived.by(() => {
    if (value.type === 'internal' && value.internalLink) {
      const ref = value.internalLink
      let path = '/'

      if (ref._type === 'page' && ref.slug) {
        path = `/${ref.slug}`
      } else if (ref._type === 'project' && ref.slug) {
        path = `/projects/${ref.slug}`
      } else if (ref._type === 'aboutPage') {
        path = '/about'
      } else if (ref._type === 'projectsIndex') {
        path = '/projects'
      } else if (ref._type === 'homePage') {
        path = '/'
      }

      const params = value.parameters ? `?${value.parameters}` : ''
      const anchor = value.anchor ? `#${value.anchor}` : ''

      return `${path}${params}${anchor}`
    }

    if (value.type === 'external' && value.url) {
      return value.url
    }

    if (value.type === 'email' && value.email) {
      return `mailto:${value.email}`
    }

    if (value.type === 'phone' && value.phone) {
      return `tel:${value.phone}`
    }

    // Fallback: try url or value
    return value.url || value.value || '#'
  })

  let isExternal = $derived(value.type === 'external' || value.blank)
</script>

<a
  {href}
  target={isExternal ? '_blank' : undefined}
  rel={isExternal ? 'noopener noreferrer' : undefined}
>
  {@render children()}
</a>
