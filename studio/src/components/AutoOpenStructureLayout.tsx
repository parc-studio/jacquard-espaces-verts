import { useEffect } from 'react'
import { useRouter } from 'sanity/router'

const DEFAULT_STRUCTURE_PATH = '/structure/homePage'

interface StudioLayoutProps {
  renderDefault: (props: StudioLayoutProps) => React.JSX.Element
}

export function AutoOpenStructureLayout(props: StudioLayoutProps) {
  const { navigateUrl } = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const path = window.location.pathname
    // Redirect to home page document when landing on empty structure view
    if (path === '/structure' || path === '/structure/') {
      navigateUrl({ path: DEFAULT_STRUCTURE_PATH })
    }
  }, [navigateUrl])

  return props.renderDefault(props)
}
