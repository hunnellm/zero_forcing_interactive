/**
 * forcing.worker.js - Web Worker wrapper around compute-core.js, running
 * looped forcing / maximum looped forcing / loop forts / loop blocking-set
 * analysis off the main thread.
 *
 * Protocol (see src/lib/api.js for the main-thread client):
 *   Main -> worker: { id, op, payload, timeoutMs? }
 *   Main -> worker: { id, type: 'cancel' }               (cancel a request)
 *   Worker -> main: { id, ok: true, result }
 *   Worker -> main: { id, ok: false, error: { code, message } }
 *     where code is one of 'cancelled' | 'timeout' | 'error'.
 *
 * Multiple in-flight requests are supported (each tracked by its own id),
 * although in practice the UI only ever has one advanced-analysis request
 * outstanding at a time.
 */

import { createCheckpoint, runForcingCompute, ComputeCancelledError, ComputeTimeoutError } from '../lib/forcing/compute-core'

// Default budget for a single in-browser computation before it is treated as
// a timeout (the caller may override this per-request via `timeoutMs`).
const DEFAULT_TIMEOUT_MS = 20000

const cancelledIds = new Set()

const toErrorPayload = error => {
  if (error instanceof ComputeCancelledError) {
    return { code: 'cancelled', message: error.message }
  }
  if (error instanceof ComputeTimeoutError) {
    return { code: 'timeout', message: error.message }
  }
  return { code: 'error', message: error instanceof Error ? error.message : 'Unknown computation failure' }
}

self.addEventListener('message', event => {
  const data = event.data || {}

  if (data.type === 'cancel') {
    cancelledIds.add(data.id)
    return
  }

  const { id, op, payload, timeoutMs } = data
  const deadlineAt = Date.now() + (Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS)

  const checkpoint = createCheckpoint({
    isCancelled: () => cancelledIds.has(id),
    deadlineAt,
    // Checked more frequently than compute-core's default so cancellation
    // and timeouts are observed promptly even for smaller graphs, at the
    // cost of a slightly more frequent (but still cheap) macrotask yield.
    everyNSteps: 256,
  })

  Promise.resolve()
    .then(() => runForcingCompute(op, payload, checkpoint))
    .then(result => {
      self.postMessage({ id, ok: true, result })
    })
    .catch(error => {
      self.postMessage({ id, ok: false, error: toErrorPayload(error) })
    })
    .finally(() => {
      cancelledIds.delete(id)
    })
})
