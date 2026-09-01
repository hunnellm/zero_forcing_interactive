import { COMPUTE_STATUS } from '../lib/forcing-analysis-shared'

export const formatElapsed = elapsedMs => `${(elapsedMs / 1000).toFixed(1)}s`

// Loop-analysis computations (see src/lib/api.js `postForcing`) run in a
// Web Worker first and only fall back to the backend when the worker is
// unavailable or fails; when *both* stages fail, the resulting
// `ForcingApiError` carries `{ workerError, backendError }` in `cause`. This
// formats that combined failure into a single message so users can tell a
// worker protocol/import bug apart from an unreachable backend, instead of
// seeing a single opaque "computation failed" string.
export const formatLoopAnalysisError = error => {
  const message = error?.message || 'Unable to compute the requested value.'
  const workerError = error?.cause?.workerError
  if (!workerError) return message

  const workerCode = workerError.cause?.code
  const workerDetail = workerError.message
    ? (workerCode ? `${workerError.message} (${workerCode})` : workerError.message)
    : workerCode

  return workerDetail ? `${message} Worker error: ${workerDetail}` : message
}

export const createAnalysisHeaderMeta = ({ status, stale, elapsedMs = 0 }) => {
  const statusChip = {
    label: 'Idle',
    color: 'default',
  }

  if (status === COMPUTE_STATUS.RUNNING) {
    statusChip.label = 'Running'
    statusChip.color = 'info'
  } else if (status === COMPUTE_STATUS.SUCCESS) {
    statusChip.label = 'Success'
    statusChip.color = 'success'
  } else if (status === COMPUTE_STATUS.ERROR) {
    statusChip.label = 'Error'
    statusChip.color = 'error'
  } else if (status === COMPUTE_STATUS.CANCELLED) {
    statusChip.label = 'Cancelled'
    statusChip.color = 'warning'
  }

  return {
    statusChip,
    showProgress: status === COMPUTE_STATUS.RUNNING,
    showCancel: status === COMPUTE_STATUS.RUNNING,
    showStale: Boolean(stale),
    elapsedLabel: elapsedMs > 0 ? formatElapsed(elapsedMs) : null,
  }
}
