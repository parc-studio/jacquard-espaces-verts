/**
 * Feedback Auth API Route
 *
 * Simple password gate for the annotation toolbar on the comments branch.
 * Validates a shared password — no sessions, no cookies.
 * The client stores auth state in localStorage after a successful check.
 */

export const prerender = false

import type { APIRoute } from 'astro'
import { FEEDBACK_PASSWORD } from 'astro:env/server'

export const POST: APIRoute = async ({ request }) => {
  const jsonHeaders = { 'Content-Type': 'application/json' }

  try {
    const body = await request.json()
    if (!body || typeof body !== 'object' || typeof body.password !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid password' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }
    const { password } = body as { password: string }

    if (!FEEDBACK_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Feedback not configured' }), {
        status: 503,
        headers: jsonHeaders,
      })
    }

    if (password !== FEEDBACK_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Invalid password' }), {
        status: 401,
        headers: jsonHeaders,
      })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders })
  } catch {
    return new Response(JSON.stringify({ error: 'Bad request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
