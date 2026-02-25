/**
 * Preview Route Configuration
 *
 * Simple regex pattern matching for preview routes.
 * Routes ordered most specific → least specific (first match wins).
 */

// =============================================================================
// Types
// =============================================================================

/** Template identifiers - add new templates here */
export type TemplateId = 'home' | 'about' | 'projectsIndex' | 'project' | 'page'

/** Result of matching a route */
export interface RouteMatch {
  templateId: TemplateId
  slug?: string
}

// =============================================================================
// Route Patterns (most specific → least specific)
// =============================================================================

/**
 * Preview route patterns.
 * - Pattern captures (parentheses) become the slug
 * - Order matters: first match wins
 * - Catch-all patterns go last
 *
 * SCAFFOLDING: When adding new document types, add patterns here:
 * { pattern: /^your-type\/(.+)$/, templateId: 'yourType', description: '/preview/your-type/{slug} → YourTypeTemplate' },
 */
const PREVIEW_ROUTES: Array<{ pattern: RegExp; templateId: TemplateId; description: string }> = [
  { pattern: /^$/, templateId: 'home', description: '/preview → HomeTemplate' },
  { pattern: /^about$/, templateId: 'about', description: '/preview/about → AboutTemplate' },
  {
    pattern: /^projects$/,
    templateId: 'projectsIndex',
    description: '/preview/projects → ProjectsIndexTemplate',
  },
  {
    pattern: /^projects\/(.+)$/,
    templateId: 'project',
    description: '/preview/projects/{slug} → ProjectTemplate',
  },
  // TODO: Add more specific routes above this line
  {
    pattern: /^(.+)$/,
    templateId: 'page',
    description: '/preview/{slug} → PageTemplate (catch-all)',
  },
]

// =============================================================================
// Route Matching
// =============================================================================

/**
 * Match a route path against preview patterns.
 * @param route - The route string (e.g., "project/my-project")
 */
export function matchPreviewRoute(route: string | undefined): RouteMatch | null {
  const path = (route || '').replace(/^\/+|\/+$/g, '') // trim slashes

  for (const { pattern, templateId } of PREVIEW_ROUTES) {
    const match = path.match(pattern)
    if (match) {
      return { templateId, slug: match[1] }
    }
  }

  return null
}

/**
 * Get list of supported preview route patterns for error messages.
 * Derived from PREVIEW_ROUTES so it stays in sync automatically.
 */
export function getSupportedRoutePatterns(): string[] {
  return PREVIEW_ROUTES.map((r) => r.description)
}
