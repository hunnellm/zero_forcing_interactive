import { COMPUTE_STATUS } from '../lib/forcing-analysis-shared'

export const formatElapsed = elapsedMs => `${(elapsedMs / 1000).toFixed(1)}s`

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
