/**
 * api.js - client for looped forcing / maximum looped forcing / loop fort
 * and blocking-set analysis. These computations run in-browser by default,
 * off the main thread in a Web Worker (see src/workers/forcing.worker.js and
 * src/lib/forcing/compute-core.js), and only fall back to the backend zero
 * forcing API exposed by server.js (see /api/forcing/*) when a worker is
 * unavailable, fails, or exceeds its in-browser time budget - or when the
 * REACT_APP_FORCE_BACKEND build-time flag forces backend-only mode.
 *
 * This module deliberately never references `import.meta` or constructs a
 * `Worker` directly (both would break the plain-Node test harness used by
 * api.test.js, which loads and evaluates this file's transpiled source
 * outside of webpack). Instead, `registerForcingWorkerFactory` lets the
 * actual UI entry point (src/components/graph/context.js) inject a factory
 * that knows how to construct the worker via webpack's native
 * `new Worker(new URL(..., import.meta.url))` syntax.
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

// Default per-request in-browser computation budget before falling back to
// the backend (if reachable). Kept generous since these are exponential
// brute-force algorithms; see src/lib/forcing/compute-core.js.
const DEFAULT_WORKER_TIMEOUT_MS = 20000

const makeAbortError = () => {
  const error = new Error('Aborted')
  error.name = 'AbortError'
  return error
}

class WorkerUnavailableError extends Error {}

// Set true only via REACT_APP_FORCE_BACKEND=true at build time (see
// webpack.config.js); this always skips the worker and uses the backend
// API, which is occasionally useful for debugging/parity checks.
const shouldForceBackend = () => (
  typeof process !== 'undefined' && process.env && process.env.REACT_APP_FORCE_BACKEND === 'true'
)

let workerFactory = null
let sharedWorker = null
let workerUnavailable = false
let requestCounter = 0

/**
 * Registers a factory used to lazily construct (and reuse) the shared
 * forcing Web Worker. Called once from src/components/graph/context.js,
 * which is the only place allowed to reference `Worker`/`import.meta` (see
 * the module docstring above for why). Passing a falsy factory (or never
 * calling this at all, e.g. under Node) means every call below falls back
 * to the backend API.
 */
export const registerForcingWorkerFactory = factory => {
  workerFactory = factory || null
  workerUnavailable = false
  if (sharedWorker) {
    sharedWorker.terminate()
    sharedWorker = null
  }
}

const getSharedWorker = () => {
  if (shouldForceBackend() || workerUnavailable || typeof workerFactory !== 'function') return null
  if (sharedWorker) return sharedWorker

  try {
    sharedWorker = workerFactory()
  } catch (error) {
    workerUnavailable = true
    sharedWorker = null
  }
  return sharedWorker
}

// Attempts to run `op` in the shared worker, resolving with the worker's
// `result` payload. Rejects with WorkerUnavailableError if no worker is
// available (caller should fall back to the backend), with an AbortError if
// `signal` fires or the worker reports the request as cancelled, or with a
// ForcingApiError for a worker-reported computation error/timeout.
const runViaWorker = (op, payload, { signal, timeoutMs } = {}) => new Promise((resolve, reject) => {
  const worker = getSharedWorker()
  if (!worker) {
    reject(new WorkerUnavailableError('No forcing worker is available.'))
    return
  }

  if (signal?.aborted) {
    reject(makeAbortError())
    return
  }

  const id = `forcing-${ ++requestCounter }`
  let settled = false

  const cleanup = () => {
    worker.removeEventListener('message', onMessage)
    worker.removeEventListener('error', onError)
    if (signal) signal.removeEventListener('abort', onAbort)
  }

  const onMessage = event => {
    const data = event.data || {}
    if (data.id !== id || settled) return
    settled = true
    cleanup()

    if (data.ok) {
      resolve(data.result)
      return
    }

    const { code, message } = data.error || {}
    if (code === 'cancelled') {
      reject(makeAbortError())
    } else {
      reject(new ForcingApiError(message || 'In-browser computation failed.', { status: null, cause: { code } }))
    }
  }

  const onError = () => {
    if (settled) return
    settled = true
    cleanup()
    // A script/runtime error in the worker itself (not a reported
    // computation failure) - treat the worker as unusable going forward.
    workerUnavailable = true
    reject(new WorkerUnavailableError('The forcing worker crashed.'))
  }

  const onAbort = () => {
    if (settled) return
    settled = true
    worker.postMessage({ id, type: 'cancel' })
    cleanup()
    reject(makeAbortError())
  }

  worker.addEventListener('message', onMessage)
  worker.addEventListener('error', onError)
  if (signal) signal.addEventListener('abort', onAbort)

  worker.postMessage({ id, op, payload, timeoutMs: timeoutMs || DEFAULT_WORKER_TIMEOUT_MS })
})

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

const postForcing = async (endpoint, { adjacencyMatrix, loopedVertices, signal }) => {
  const body = { adjacencyMatrix, loopedVertices: [...(loopedVertices || [])].sort((a, b) => a - b) }
  const startedAt = Date.now()

  try {
    const result = await runViaWorker(endpoint, body, { signal })
    return { result, meta: { elapsedMs: Date.now() - startedAt, vertexCount: adjacencyMatrix.length, source: 'worker' } }
  } catch (error) {
    if (isCancelledError(error)) throw error
    // Any other worker failure (unavailable, crashed, timed out, or an
    // unexpected computation error) falls back to the backend API, if one
    // is reachable - see the module docstring above.
  }

  return requestJson(`/api/forcing/${ endpoint }`, { method: 'POST', body, signal })
}

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
