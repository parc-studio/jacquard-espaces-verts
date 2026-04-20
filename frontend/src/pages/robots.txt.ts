import type { APIRoute } from 'astro'

const siteUrl = import.meta.env.SITE_URL || 'http://localhost:4321'

const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap-index.xml
`

export const GET: APIRoute = () => {
  return new Response(robotsTxt, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
