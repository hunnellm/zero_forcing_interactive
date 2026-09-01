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
  LOOPED: 'looped',
  MAXIMUM_LOOPED: 'maximum-looped',
  FORTS: 'forts',
  BLOCKING_SETS: 'blocking-sets',
}

// Forcing "mode" for the looped-forcing card: whether the standard (simple)
// rule or the looped rule (any vertex may force with a unique white neighbor
// in the looped graph) applies. Kept distinct from NUMBER_VARIANTS/SET_VARIANTS
// above, which describe variants of simple/PSD/transmission forcing.
export const FORCING_RULE = Object.freeze({
  SIMPLE: 'simple',
  LOOPED: 'looped',
})

// Single source of truth for the advanced (backend-powered) analysis modes
// introduced alongside looped zero forcing. See computation-panel.js and
// graph/context.js for where these are dispatched/rendered.
export const ADVANCED_VARIANTS = Object.freeze({
  LOOPED: 'looped',
  MAXIMUM_LOOPED: 'maximum-looped',
  FORT: 'fort',
  BLOCKING_SETS: 'blocking-sets',
})

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

// Maximum vertex count accepted by the looped-forcing/fort/blocking-set backend
// (see MAX_VERTICES in server.js, which must stay in sync with this value).
// Enforcing the same limit client-side lets the UI reject oversized requests
// before spending a round trip on a guaranteed 400 response.
export const MAX_LOOP_VERTICES = 20

const normalizeNumericParameter = value => Number(clampParameter(value, 1).toFixed(6))

export const createNumberVariantConfig = ({ variant, alpha, beta }) => (
  variant === NUMBER_VARIANTS.PROPORTIONAL
    ? { variant, alpha: normalizeNumericParameter(alpha), beta: normalizeNumericParameter(beta) }
    : { variant }
)

export const createSetsVariantConfig = variant => ({ variant })

// loopedVertices is accepted as an iterable (e.g. a Set) of vertex indices;
// it is normalised to a sorted array so equivalent configurations always
// produce the same cache key regardless of insertion order.
export const createCacheKey = ({ graph6String, operation, variant, alpha, beta, loopedVertices }) => JSON.stringify({
  graph6String,
  operation,
  variant,
  alpha: alpha ?? null,
  beta: beta ?? null,
  loopedVertices: loopedVertices ? [...loopedVertices].sort((a, b) => a - b) : null,
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
