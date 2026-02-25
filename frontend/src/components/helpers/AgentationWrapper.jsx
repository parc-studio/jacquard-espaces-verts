import { Agentation, loadAnnotations, saveAnnotations } from 'agentation'
import { useEffect, useState } from 'react'

/**
 * AgentationWrapper
 *
 * Two modes controlled by the `mode` prop:
 *
 * - "dev"    → Developer's local env. No auth gate. Connects to local MCP
 *              server (endpoint prop) so pulled annotations appear as markers.
 * - "review" → Deployed comments branch. Shows a login form (name + shared
 *              password), then renders Agentation on success.
 *
 * All annotation events sync to Sanity via /api/annotations.
 * The reviewer's name is attached to every annotation for attribution.
 *
 * Forensic mode is enforced for maximum context (computed styles, accessibility,
 * full DOM path, nearby elements). The setting is pre-seeded in localStorage
 * before the Agentation component mounts.
 */

const API = '/api/annotations'
const STORAGE_KEY = 'agentation-reviewer'
const SETTINGS_KEY = 'feedback-toolbar-settings'

// Force forensic output detail for maximum annotation context.
// Agentation reads settings from localStorage on mount with:
//   { ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) }
// so we merge outputDetail: "forensic" into any existing settings.
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const existing = raw ? JSON.parse(raw) : {}
    existing.outputDetail = 'forensic'
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(existing))
  } catch {
    // Ignore — component will fall back to its defaults
  }
}

function getStoredReviewer() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function storeReviewer(name, password) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, password, authenticated: true }))
}

function normalizeSanityAnnotation(doc) {
  let parsed = null

  if (typeof doc?.content === 'string') {
    try {
      parsed = JSON.parse(doc.content)
    } catch {
      parsed = null
    }
  }

  const fallbackId =
    typeof doc?._id === 'string' && doc._id.startsWith('annotation-')
      ? doc._id.replace('annotation-', '')
      : null

  const id = parsed?.id || doc?.annotationId || fallbackId
  const x = parsed?.x ?? doc?.positionX
  const y = parsed?.y ?? doc?.positionY

  if (!id || typeof x !== 'number' || typeof y !== 'number') return null

  return {
    id,
    x,
    y,
    comment: parsed?.comment || doc?.comment || '',
    element: parsed?.element || 'Element',
    elementPath: parsed?.elementPath || '',
    timestamp: parsed?.timestamp || (doc?._createdAt ? Date.parse(doc._createdAt) : Date.now()),
    url: parsed?.url || doc?.pageUrl,
    status: parsed?.status || doc?.status,
    selectedText: parsed?.selectedText,
    nearbyText: parsed?.nearbyText,
    cssClasses: parsed?.cssClasses,
    nearbyElements: parsed?.nearbyElements,
    computedStyles: parsed?.computedStyles,
    fullPath: parsed?.fullPath,
    accessibility: parsed?.accessibility,
    boundingBox: parsed?.boundingBox,
    reactComponents: parsed?.reactComponents,
  }
}

async function hydrateLocalAnnotationsFromSanity() {
  const pathname = window.location.pathname
  const response = await fetch(
    `${API}?path=${encodeURIComponent(pathname)}&status=${encodeURIComponent('new,in-progress')}`
  )

  if (!response.ok) {
    throw new Error(`Sanity fetch failed (${response.status})`)
  }

  const docs = await response.json()
  if (!Array.isArray(docs) || docs.length === 0) return

  const fromSanity = docs.map(normalizeSanityAnnotation).filter(Boolean)

  if (fromSanity.length === 0) return

  const existing = loadAnnotations(pathname)
  const mergedById = new Map(existing.map((annotation) => [annotation.id, annotation]))

  for (const annotation of fromSanity) {
    if (!mergedById.has(annotation.id)) {
      mergedById.set(annotation.id, annotation)
    }
  }

  saveAnnotations(pathname, Array.from(mergedById.values()))
}

// --- Sanity sync handlers ---

function createHandlers(reviewerName, password) {
  const authHeaders = password
    ? { 'Content-Type': 'application/json', 'x-feedback-password': password }
    : { 'Content-Type': 'application/json' }

  return {
    handleAdd(annotation) {
      fetch(API, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          ...annotation,
          url: annotation.url || window.location.href,
          reviewerName,
        }),
      }).catch((err) => {
        console.warn('[Agentation → Sanity] Failed to sync:', err.message)
      })
    },

    handleUpdate(annotation) {
      fetch(API, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ id: annotation.id, annotation }),
      }).catch((err) => {
        console.warn('[Agentation → Sanity] Failed to update:', err.message)
      })
    },

    handleDelete(annotation) {
      fetch(API, {
        method: 'DELETE',
        headers: authHeaders,
        body: JSON.stringify({ id: annotation.id }),
      }).catch((err) => {
        console.warn('[Agentation → Sanity] Failed to delete:', err.message)
      })
    },
  }
}

// --- Login form for reviewers on the comments branch ---

function LoginForm({ onSuccess }) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !password.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/feedback-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        storeReviewer(name.trim(), password)
        onSuccess(name.trim(), password)
      } else {
        const data = await res.json()
        setError(data.error || 'Invalid password')
      }
    } catch {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 99999,
        background: '#1a1a1a',
        color: '#fff',
        borderRadius: '12px',
        padding: '20px',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        width: '280px',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '12px' }}>Leave Feedback</div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            marginBottom: '8px',
            border: '1px solid #333',
            borderRadius: '6px',
            background: '#111',
            color: '#fff',
            fontSize: '14px',
            boxSizing: 'border-box',
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            marginBottom: '12px',
            border: '1px solid #333',
            borderRadius: '6px',
            background: '#111',
            color: '#fff',
            fontSize: '14px',
            boxSizing: 'border-box',
          }}
        />
        {error && (
          <div style={{ color: '#ff6b6b', marginBottom: '8px', fontSize: '13px' }}>{error}</div>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '8px',
            border: 'none',
            borderRadius: '6px',
            background: '#4f46e5',
            color: '#fff',
            fontWeight: 600,
            fontSize: '14px',
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Verifying...' : 'Start'}
        </button>
      </form>
    </div>
  )
}

// --- Main component ---

export default function AgentationWrapper({ mode = 'dev' }) {
  const [reviewerName, setReviewerName] = useState(null)
  const [feedbackPassword, setFeedbackPassword] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (mode === 'dev') {
      let active = true

      ;(async () => {
        try {
          await hydrateLocalAnnotationsFromSanity()
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.warn('[Agentation] Failed to hydrate local annotations from Sanity:', message)
        } finally {
          if (active) {
            setReviewerName('dev')
            setReady(true)
          }
        }
      })()

      return () => {
        active = false
      }
    }

    setReady(false)

    if (mode === 'review') {
      // Review mode: check stored auth
      const stored = getStoredReviewer()
      if (stored?.authenticated && stored?.name) {
        setReviewerName(stored.name)
        if (stored.password) setFeedbackPassword(stored.password)
        setReady(true)
      }
      return
    }
  }, [mode])

  // Review mode — show login if not authenticated
  if (!ready) {
    return (
      <LoginForm
        onSuccess={(name, password) => {
          setReviewerName(name)
          setFeedbackPassword(password)
          setReady(true)
        }}
      />
    )
  }

  const { handleAdd, handleUpdate, handleDelete } = createHandlers(
    reviewerName || 'anonymous',
    feedbackPassword
  )

  // Dev mode: connect to local MCP server so pulled annotations show as markers
  const agentationProps = {
    onAnnotationAdd: handleAdd,
    onAnnotationUpdate: handleUpdate,
    onAnnotationDelete: handleDelete,
    ...(mode === 'dev' && { endpoint: 'http://localhost:4747' }),
  }

  return <Agentation {...agentationProps} />
}
