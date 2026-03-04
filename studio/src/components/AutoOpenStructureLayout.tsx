import { useEffect } from 'react'
import { useRouter } from 'sanity/router'

const DEFAULT_STRUCTURE_PATH = '/structure/homePage;homePage'

interface StudioLayoutProps {
  renderDefault: (props: StudioLayoutProps) => React.JSX.Element
}

export function AutoOpenStructureLayout(props: StudioLayoutProps) {
  const { navigateUrl } = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const path = window.location.pathname
    if (path === '/structure' || path === '/structure/') {
      navigateUrl({ path: DEFAULT_STRUCTURE_PATH })
    }
  }, [navigateUrl])

  return props.renderDefault(props)
}
