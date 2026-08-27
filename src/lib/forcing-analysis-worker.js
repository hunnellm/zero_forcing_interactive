import { computeNumberResult, computeSetsResult } from './forcing-analysis'

self.addEventListener('message', event => {
  const { operation, payload } = event.data || {}

  try {
    const result = operation === 'sets'
      ? computeSetsResult(payload)
      : computeNumberResult(payload)

    self.postMessage({
      status: 'success',
      result,
    })
  } catch (error) {
    self.postMessage({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown computation failure',
    })
  }
})
