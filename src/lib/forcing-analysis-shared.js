import { clampParameter } from './forcing'

export const COMPUTE_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  SUCCESS: 'success',
  ERROR: 'error',
  CANCELLED: 'cancelled',
}

export const COMPUTE_OPERATIONS = {
  NUMBER: 'number',
  SETS: 'sets',
}

// Single source of truth for forcing-number variants. Import this constant
// (rather than re-declaring the string literals) everywhere a variant is
// parsed, dispatched, or rendered so the UI and analysis code can never fall
// out of sync with one another.
export const NUMBER_VARIANTS = Object.freeze({
  FAULT_TOLERANT: 'fault-tolerant',
  PROPORTIONAL: 'ProportionalZeroForcing',
  MAXIMUM_NULLITY: 'maximum-nullity',
})

// Single source of truth for minimum-set variants. See NUMBER_VARIANTS above.
export const SET_VARIANTS = Object.freeze({
  STANDARD: 'standard',
  PSD: 'psd',
  FAULT_TOLERANT: 'fault-tolerant',
})

// UI cap for representative minimum forcing sets. This keeps navigation responsive
// while still giving users a substantial sample of distinct automorphism classes.
export const MAX_DISPLAYED_MINIMUM_SETS = 50

const normalizeNumericParameter = value => Number(clampParameter(value, 1).toFixed(6))

export const createNumberVariantConfig = ({ variant, alpha, beta }) => (
  variant === NUMBER_VARIANTS.PROPORTIONAL
    ? { variant, alpha: normalizeNumericParameter(alpha), beta: normalizeNumericParameter(beta) }
    : { variant }
)

export const createSetsVariantConfig = variant => ({ variant })

export const createCacheKey = ({ graph6String, operation, variant, alpha, beta }) => JSON.stringify({
  graph6String,
  operation,
  variant,
  alpha: alpha ?? null,
  beta: beta ?? null,
})

export const isResultStale = (resultKey, currentKey) => Boolean(resultKey && currentKey && resultKey !== currentKey)

export const clampActiveSetIndex = (index, totalSets) => {
  if (totalSets <= 0) return 0
  return Math.min(Math.max(index, 0), totalSets - 1)
}

export const createOperationState = () => ({
  status: COMPUTE_STATUS.IDLE,
  result: null,
  resultKey: null,
  error: null,
  elapsedMs: 0,
})
