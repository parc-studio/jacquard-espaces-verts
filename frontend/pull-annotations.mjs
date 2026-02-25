#!/usr/bin/env node

/**
 * Pull Annotations from Sanity → local Agentation MCP server
 *
 * Fetches annotations with status "new" or "in-progress" from Sanity
 * and pushes them into the local Agentation MCP server so they appear
 * as markers in the developer's browser.
 *
 * Usage:
 *   pnpm pull:annotations
 *   pnpm pull:annotations --status=new
 *   pnpm pull:annotations --url=http://localhost:4321/about
 *
 * Prerequisites:
 *   - Agentation MCP server running: npx agentation-mcp server
 *   - Dev server running: pnpm dev:frontend
 */

const MCP_URL = process.env.MCP_URL || 'http://localhost:4747'
const API_URL = process.env.API_URL || 'http://localhost:4321/api/annotations'

// Parse CLI args
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [key, val] = a.slice(2).split('=')
      return [key, val || 'true']
    })
)

const status = args.status || 'new,in-progress'
const urlFilter = args.url || ''

async function main() {
  // 1. Fetch annotations from Sanity via the Astro API route
  const params = new URLSearchParams({ status })
  if (urlFilter) params.set('url', urlFilter)

  console.log(`\n📡 Fetching annotations from Sanity (status: ${status})...`)

  const res = await fetch(`${API_URL}?${params}`)
  if (!res.ok) {
    console.error(`❌ Failed to fetch annotations: ${res.status} ${res.statusText}`)
    process.exit(1)
  }

  const annotations = await res.json()
  console.log(`   Found ${annotations.length} annotation(s)`)

  if (annotations.length === 0) {
    console.log('✅ Nothing to pull.\n')
    return
  }

  // 2. Check MCP server health
  try {
    const health = await fetch(`${MCP_URL}/health`)
    if (!health.ok) throw new Error()
  } catch {
    console.error(`❌ MCP server not reachable at ${MCP_URL}`)
    console.error('   Start it with: npx agentation-mcp server')
    process.exit(1)
  }

  // 3. Group annotations by pageUrl
  const byPage = new Map()
  for (const ann of annotations) {
    const url = ann.pageUrl || 'unknown'
    if (!byPage.has(url)) byPage.set(url, [])
    byPage.get(url).push(ann)
  }

  // 4. Create sessions and push annotations
  let total = 0

  for (const [pageUrl, pageAnnotations] of byPage) {
    // Create a session for this page
    const sessionRes = await fetch(`${MCP_URL}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: pageUrl }),
    })

    if (!sessionRes.ok) {
      console.error(`❌ Failed to create session for ${pageUrl}`)
      continue
    }

    const session = await sessionRes.json()
    const sessionId = session.id || session.sessionId
    console.log(`\n📄 ${pageUrl}`)
    console.log(`   Session: ${sessionId}`)

    // Push each annotation
    for (const ann of pageAnnotations) {
      const mcpAnnotation = {
        id: ann.annotationId || ann._id.replace('annotation-', ''),
        comment: ann.comment,
        element: ann.element,
        elementPath: ann.elementPath,
        url: ann.pageUrl,
        x: ann.positionX,
        y: ann.positionY,
        timestamp: new Date(ann._createdAt).getTime(),
        ...(ann.selectedText && { selectedText: ann.selectedText }),
        ...(ann.nearbyText && { nearbyText: ann.nearbyText }),
        ...(ann.reactComponents && { reactComponents: ann.reactComponents }),
        ...(ann.cssClasses && { cssClasses: ann.cssClasses }),
        ...(ann.intent && { intent: ann.intent }),
        ...(ann.severity && { severity: ann.severity }),
      }

      const pushRes = await fetch(`${MCP_URL}/sessions/${sessionId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mcpAnnotation),
      })

      if (pushRes.ok) {
        const reviewer = ann.reviewerName ? ` (by ${ann.reviewerName})` : ''
        console.log(`   ✅ "${ann.comment}"${reviewer}`)
        total++
      } else {
        console.error(`   ❌ Failed to push: "${ann.comment}"`)
      }
    }
  }

  console.log(`\n🎯 Pulled ${total} annotation(s) to MCP server.`)
  console.log('   Refresh your browser to see the markers.\n')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
