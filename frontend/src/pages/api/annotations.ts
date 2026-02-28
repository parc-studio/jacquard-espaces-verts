/**
 * Annotations API Route
 *
 * Server-side endpoint that proxies Agentation annotation events to Sanity.
 * Keeps the SANITY_WRITE_TOKEN on the server — never exposed to the client.
 *
 * GET    → Fetch annotations (filterable by ?status=new,in-progress&url=...)
 * POST   → Create or replace an annotation
 * PATCH  → Update an annotation payload
 * DELETE → Mark an annotation as done
 */

export const prerender = false

import { clientConfig } from '@/utils/sanity/client'
import { createClient } from '@sanity/client'
import type { APIRoute } from 'astro'
import { FEEDBACK_PASSWORD, SANITY_WRITE_TOKEN } from 'astro:env/server'

/** Validate the x-feedback-password header on write requests. */
function validateAuth(request: Request): Response | null {
  if (!FEEDBACK_PASSWORD) return null // Auth not configured — allow (dev mode)
  const header = request.headers.get('x-feedback-password')
  if (header !== FEEDBACK_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return null
}

const writeClient = createClient({
  ...clientConfig,
  useCdn: false,
  token: SANITY_WRITE_TOKEN,
})

const jsonHeaders = { 'Content-Type': 'application/json' }

/** GET — fetch annotations from Sanity, optionally filtered */
export const GET: APIRoute = async ({ url }) => {
  try {
    const statusFilter = url.searchParams.get('status')
    const urlFilter = url.searchParams.get('url')
    const pathFilter = url.searchParams.get('path')

    const conditions = ['_type == "annotation"']
    const params: Record<string, unknown> = {}

    if (statusFilter) {
      const statuses = statusFilter.split(',').map((s) => s.trim())
      conditions.push('status in $statuses')
      params.statuses = statuses
    }

    if (urlFilter) {
      conditions.push('pageUrl match $urlFilter')
      params.urlFilter = `${urlFilter}*`
    }

    if (pathFilter) {
      conditions.push('pageUrl match $pathFilter')
      params.pathFilter = `*${pathFilter}*`
    }

    const query = `*[${conditions.join(' && ')}] | order(_createdAt desc)`
    const annotations = await writeClient.fetch(query, params)

    return new Response(JSON.stringify(annotations), {
      status: 200,
      headers: jsonHeaders,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: jsonHeaders })
  }
}

/** POST — create or replace an annotation document */
export const POST: APIRoute = async ({ request }) => {
  const authError = validateAuth(request)
  if (authError) return authError

  try {
    const body = await request.json()

    // Validate required fields
    const required = ['id', 'url', 'x', 'y'] as const
    const missing = required.filter((f) => body[f] == null)
    if (missing.length) {
      return new Response(
        JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` }),
        { status: 400, headers: jsonHeaders }
      )
    }

    const doc = {
      _id: `annotation-${body.id}`,
      _type: 'annotation',
      annotationId: body.id,
      content: JSON.stringify(body, null, 2),
      pageUrl: body.url,
      positionX: body.x,
      positionY: body.y,
      status: 'new',
      ...(body.reviewerName && { reviewerName: body.reviewerName }),
    }

    await writeClient.createOrReplace(doc)
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: jsonHeaders })
  }
}

/** PATCH — update an annotation payload */
export const PATCH: APIRoute = async ({ request }) => {
  const authError = validateAuth(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { id } = body
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing required field: id' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    const payload = body.annotation && typeof body.annotation === 'object' ? body.annotation : body

    await writeClient
      .patch(`annotation-${id}`)
      .set({
        content: JSON.stringify(payload, null, 2),
      })
      .commit()

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: jsonHeaders })
  }
}

/** DELETE — mark an annotation as done */
export const DELETE: APIRoute = async ({ request }) => {
  const authError = validateAuth(request)
  if (authError) return authError

  try {
    const { id } = await request.json()
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing required field: id' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }
    await writeClient.patch(`annotation-${id}`).set({ status: 'done' }).commit()
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: jsonHeaders })
  }
}
