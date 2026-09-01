/**
 * api.js - thin fetch wrapper around the backend zero forcing API exposed by
 * server.js (see /api/forcing/*). Provides cancellable requests and a
 * lightweight backend-availability check so the UI can fall back gracefully
 * when no backend is running (e.g. on the static GitHub Pages deployment).
 */

// Relative by default so the dev server proxy (see webpack.config.js) and any
// same-origin production deployment work without configuration. Set
// FORCING_API_BASE_URL at build time to point at a separately hosted backend.
export const FORCING_API_BASE_URL = (
  typeof process !== 'undefined' && process.env && process.env.FORCING_API_BASE_URL
) || ''

export const FORCING_ENDPOINTS = Object.freeze({
  LOOPED: 'looped',
  MAXIMUM_LOOPED: 'maximum-looped',
  FORTS: 'forts',
  BLOCKING_SETS: 'blocking-sets',
})

export class ForcingApiError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message)
    this.name = 'ForcingApiError'
    this.status = status ?? null
    if (cause) this.cause = cause
  }
}

export const isCancelledError = error => error?.name === 'AbortError'

const requestJson = async (path, { method = 'GET', body, signal } = {}) => {
  let response
  try {
    response = await fetch(`${ FORCING_API_BASE_URL }${ path }`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (error) {
    if (isCancelledError(error)) throw error
    throw new ForcingApiError('Unable to reach the enhanced zero forcing backend.', { cause: error })
  }

  let payload = null
  try {
    payload = await response.json()
  } catch (error) {
    // Non-JSON error responses fall through to the generic message below.
  }

  if (!response.ok) {
    throw new ForcingApiError(payload?.error || `Backend request failed with status ${ response.status }.`, {
      status: response.status,
    })
  }

  return payload
}

/**
 * Returns true if the backend appears to be reachable, false otherwise.
 * Never throws; intended for feature-detection so the UI can hide/disable
 * backend-only modes when no server is available.
 */
export const checkBackendAvailable = async (signal) => {
  try {
    const payload = await requestJson('/api/forcing/health', { signal })
    return Boolean(payload?.ok)
  } catch (error) {
    if (isCancelledError(error)) throw error
    return false
  }
}

const postForcing = (endpoint, { adjacencyMatrix, loopedVertices, signal }) => requestJson(`/api/forcing/${ endpoint }`, {
  method: 'POST',
  body: { adjacencyMatrix, loopedVertices: [...(loopedVertices || [])].sort((a, b) => a - b) },
  signal,
})

export const computeLoopedForcing = ({ adjacencyMatrix, loopedVertices, signal }) => (
  postForcing(FORCING_ENDPOINTS.LOOPED, { adjacencyMatrix, loopedVertices, signal })
)

export const computeMaximumLoopedForcing = ({ adjacencyMatrix, signal }) => (
  postForcing(FORCING_ENDPOINTS.MAXIMUM_LOOPED, { adjacencyMatrix, loopedVertices: [], signal })
)

export const computeLoopForts = ({ adjacencyMatrix, loopedVertices, signal }) => (
  postForcing(FORCING_ENDPOINTS.FORTS, { adjacencyMatrix, loopedVertices, signal })
)

export const computeLoopBlockingSets = ({ adjacencyMatrix, loopedVertices, signal }) => (
  postForcing(FORCING_ENDPOINTS.BLOCKING_SETS, { adjacencyMatrix, loopedVertices, signal })
)
