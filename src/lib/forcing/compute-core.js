/**
 * compute-core.js - pure, browser-safe port of the looped zero forcing
 * algorithms in `python/loop_zf.py` (looped forcing, maximum looped forcing,
 * loop forts, and loop blocking sets).
 *
 * This module has no Node/server-only dependencies (no `fs`, `child_process`,
 * `express`, etc.) and no DOM/Worker globals, so it can run identically on
 * the main thread, inside a Web Worker (see `src/workers/forcing.worker.js`),
 * or under the plain-Node test harness used elsewhere in this repo.
 *
 * Vertices are represented as 0-based indices matching adjacency-matrix rows
 * (unlike the Python library, which supports arbitrary vertex labels), which
 * keeps this port simpler since the app's graphs are always indexed this way.
 * Sets of vertices are represented as bitmasks (safe for the enforced
 * MAX_LOOP_VERTICES <= 20 cap, well within 32-bit-safe integer bitwise ops).
 */

import { MAX_LOOP_VERTICES } from '../forcing-analysis-shared'

export { MAX_LOOP_VERTICES }

export class ComputeLimitError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ComputeLimitError'
  }
}

export class ComputeCancelledError extends Error {
  constructor(message = 'Computation was cancelled.') {
    super(message)
    this.name = 'ComputeCancelledError'
  }
}

export class ComputeTimeoutError extends Error {
  constructor(message = 'Computation exceeded the in-browser time budget.') {
    super(message)
    this.name = 'ComputeTimeoutError'
  }
}

// Creates a checkpoint function that computationally-heavy loops below call
// periodically. Every `everyNSteps` calls it checks for cancellation/timeout
// and (crucially, inside a Worker) awaits a macrotask so any pending
// 'cancel' postMessage can actually be delivered and observed - without this
// a long synchronous computation would block the worker's message queue and
// no cancellation could ever be observed until the computation finished.
export const createCheckpoint = ({ isCancelled = () => false, deadlineAt = Infinity, everyNSteps = 2048 } = {}) => {
  let steps = 0
  return async () => {
    steps += 1
    if (steps % everyNSteps !== 0) return
    if (isCancelled()) throw new ComputeCancelledError()
    if (Date.now() > deadlineAt) throw new ComputeTimeoutError()
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}

const noopCheckpoint = async () => {}

const popcount = mask => {
  let count = 0
  let m = mask
  while (m) {
    m &= m - 1
    count += 1
  }
  return count
}

export const assertVertexLimit = adjacencyMatrix => {
  const n = Array.isArray(adjacencyMatrix) ? adjacencyMatrix.length : 0
  if (n > MAX_LOOP_VERTICES) {
    throw new ComputeLimitError(
      `This computation supports at most ${ MAX_LOOP_VERTICES } vertices; the current graph has ${ n }.`,
    )
  }
}

export const buildAdjacencyMasks = adjacencyMatrix => {
  const n = adjacencyMatrix.length
  const adjMask = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    const row = adjacencyMatrix[i]
    let mask = 0
    for (let j = 0; j < n; j++) {
      if (row[j]) mask |= (1 << j)
    }
    adjMask[i] = mask
  }
  return { adjMask, n }
}

export const maskFromVertices = vertices => {
  let mask = 0
  for (const v of (vertices || [])) mask |= (1 << v)
  return mask
}

export const verticesFromMask = (mask, n) => {
  const out = []
  for (let i = 0; i < n; i++) {
    if ((mask >> i) & 1) out.push(i)
  }
  return out
}

export const compareVertexArrays = (a, b) => {
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return a.length - b.length
}

const isSubsetArray = (small, big) => {
  const bigSet = new Set(big)
  return small.every(v => bigSet.has(v))
}

// Enumerates every n-bit mask with exactly k bits set, using Gosper's hack.
// Equivalent to (but far more memory efficient than) building
// itertools.combinations(range(n), k) and OR-ing the indices together.
function* combinationMasks(n, k) {
  if (k === 0) {
    yield 0
    return
  }
  if (k > n) return

  let mask = (1 << k) - 1
  const limit = 1 << n
  while (mask < limit) {
    yield mask
    const c = mask & -mask
    const r = mask + c
    mask = (((r ^ mask) >> 2) / c) | r
  }
}

// LOOPED closure: any vertex may force if it has exactly one white neighbor
// in the looped graph (loops present exactly on the vertices in loopMask).
export const loopedClosure = (adjMask, initialMask, loopMask, n) => {
  let blue = initialMask
  let changed = true

  while (changed) {
    changed = false
    let toBlue = 0

    for (let v = 0; v < n; v++) {
      let nbrs = adjMask[v]
      if ((loopMask >> v) & 1) nbrs |= (1 << v)

      const whiteNbrs = nbrs & ~blue
      if (whiteNbrs !== 0 && (whiteNbrs & (whiteNbrs - 1)) === 0) {
        toBlue |= whiteNbrs
      }
    }

    if (toBlue) {
      blue |= toBlue
      changed = true
    }
  }

  return blue
}

const loopedZeroForcingNumberOnly = async ({ adjMask, n, loopMask, fullMask, checkpoint }) => {
  for (let size = 0; size <= n; size++) {
    for (const mask of combinationMasks(n, size)) {
      await checkpoint()
      if (loopedClosure(adjMask, mask, loopMask, n) === fullMask) return size
    }
  }
  return n
}

export const loopedZeroForcingNumber = async ({ adjMask, n, loopMask, fullMask, checkpoint = noopCheckpoint }) => {
  if (n === 0) return { number: 0, sets: [[]] }

  const size = await loopedZeroForcingNumberOnly({ adjMask, n, loopMask, fullMask, checkpoint })
  const sets = []
  for (const mask of combinationMasks(n, size)) {
    await checkpoint()
    if (loopedClosure(adjMask, mask, loopMask, n) === fullMask) {
      sets.push(verticesFromMask(mask, n))
    }
  }
  sets.sort(compareVertexArrays)
  return { number: size, sets }
}

export const maximumLoopedZeroForcingNumber = async ({ adjMask, n, fullMask, checkpoint = noopCheckpoint }) => {
  if (n === 0) return { number: 0, configurations: [{ loopedVertices: [], sets: [[]] }] }

  let maxLz = -1
  let maximizingConfigs = []
  const totalConfigs = 1 << n

  for (let loopMask = 0; loopMask < totalConfigs; loopMask++) {
    await checkpoint()
    const lz = await loopedZeroForcingNumberOnly({ adjMask, n, loopMask, fullMask, checkpoint })
    if (lz > maxLz) {
      maxLz = lz
      maximizingConfigs = [loopMask]
    } else if (lz === maxLz) {
      maximizingConfigs.push(loopMask)
    }
  }

  const configurations = []
  for (const loopMask of maximizingConfigs) {
    await checkpoint()
    const { sets } = await loopedZeroForcingNumber({ adjMask, n, loopMask, fullMask, checkpoint })
    configurations.push({ loopedVertices: verticesFromMask(loopMask, n), sets })
  }
  configurations.sort((a, b) => compareVertexArrays(a.loopedVertices, b.loopedVertices))

  return { number: maxLz, configurations }
}

export const loopForts = async ({
  adjMask, n, loopMask, includeEmpty = false, includeFull = true, checkpoint = noopCheckpoint,
}) => {
  if (n === 0) return includeEmpty ? [[]] : []

  const nbrMasks = new Array(n)
  for (let v = 0; v < n; v++) {
    let mask = adjMask[v]
    if ((loopMask >> v) & 1) mask |= (1 << v)
    nbrMasks[v] = mask
  }

  const isFortMask = mask => {
    for (let v = 0; v < n; v++) {
      if (popcount(nbrMasks[v] & mask) === 1) return false
    }
    return true
  }

  const fullMask = (1 << n) - 1
  const forts = []

  for (let mask = 0, total = 1 << n; mask < total; mask++) {
    await checkpoint()
    if (!includeEmpty && mask === 0) continue
    if (!includeFull && mask === fullMask) continue
    if (isFortMask(mask)) forts.push(verticesFromMask(mask, n))
  }

  forts.sort((a, b) => (a.length - b.length) || compareVertexArrays(a, b))
  return forts
}

export const minimalLoopForts = async ({ adjMask, n, loopMask, includeEmpty = false, checkpoint = noopCheckpoint }) => {
  const forts = await loopForts({ adjMask, n, loopMask, includeEmpty, includeFull: true, checkpoint })

  const minimal = []
  for (const S of forts) {
    await checkpoint()
    let isMinimal = true
    for (const T of forts) {
      if (T !== S && isSubsetArray(T, S)) {
        isMinimal = false
        break
      }
    }
    if (isMinimal) minimal.push(S)
  }

  minimal.sort((a, b) => (a.length - b.length) || compareVertexArrays(a, b))
  return minimal
}

export const loopBlockingNumber = async ({ adjMask, n, loopMask, checkpoint = noopCheckpoint }) => {
  if (n === 0) return { number: 0, sets: [[]] }

  const nbrMasks = new Array(n)
  for (let u = 0; u < n; u++) {
    let mask = adjMask[u]
    if ((loopMask >> u) & 1) mask |= (1 << u)
    nbrMasks[u] = mask
  }

  const isBlockingMask = mask => {
    for (let u = 0; u < n; u++) {
      if (popcount(nbrMasks[u] & mask) < 2) return false
    }
    return true
  }

  for (let size = 0; size <= n; size++) {
    const sets = []
    for (const mask of combinationMasks(n, size)) {
      await checkpoint()
      if (isBlockingMask(mask)) sets.push(verticesFromMask(mask, n))
    }
    if (sets.length > 0) {
      sets.sort(compareVertexArrays)
      return { number: size, sets }
    }
  }

  return { number: n, sets: [] }
}

// ---------------------------------------------------------------------------
// Public per-operation entry points. Payload/return shapes mirror the
// backend's `/api/forcing/*` `result` payloads (see server.js / python/cli.py)
// so callers (src/lib/api.js) can use either transport interchangeably.
// ---------------------------------------------------------------------------

export const runLoopedForcingCompute = async ({ adjacencyMatrix, loopedVertices = [], checkpoint = noopCheckpoint }) => {
  assertVertexLimit(adjacencyMatrix)
  const { adjMask, n } = buildAdjacencyMasks(adjacencyMatrix)
  const loopMask = maskFromVertices(loopedVertices)
  const fullMask = n === 0 ? 0 : (1 << n) - 1

  const { number, sets } = await loopedZeroForcingNumber({ adjMask, n, loopMask, fullMask, checkpoint })
  return { loopedVertices: verticesFromMask(loopMask, n), number, sets }
}

export const runMaximumLoopedForcingCompute = async ({ adjacencyMatrix, checkpoint = noopCheckpoint }) => {
  assertVertexLimit(adjacencyMatrix)
  const { adjMask, n } = buildAdjacencyMasks(adjacencyMatrix)
  const fullMask = n === 0 ? 0 : (1 << n) - 1

  return maximumLoopedZeroForcingNumber({ adjMask, n, fullMask, checkpoint })
}

export const runLoopFortsCompute = async ({ adjacencyMatrix, loopedVertices = [], checkpoint = noopCheckpoint }) => {
  assertVertexLimit(adjacencyMatrix)
  const { adjMask, n } = buildAdjacencyMasks(adjacencyMatrix)
  const loopMask = maskFromVertices(loopedVertices)

  const forts = await loopForts({ adjMask, n, loopMask, includeEmpty: false, includeFull: true, checkpoint })
  const minimalForts = await minimalLoopForts({ adjMask, n, loopMask, includeEmpty: false, checkpoint })
  return { loopedVertices: verticesFromMask(loopMask, n), forts, minimalForts }
}

export const runLoopBlockingSetsCompute = async ({ adjacencyMatrix, loopedVertices = [], checkpoint = noopCheckpoint }) => {
  assertVertexLimit(adjacencyMatrix)
  const { adjMask, n } = buildAdjacencyMasks(adjacencyMatrix)
  const loopMask = maskFromVertices(loopedVertices)

  const { number, sets } = await loopBlockingNumber({ adjMask, n, loopMask, checkpoint })
  return { loopedVertices: verticesFromMask(loopMask, n), number, sets }
}

// Keys intentionally match FORCING_ENDPOINTS in src/lib/api.js (and the
// backend's `op` values in python/cli.py) so both transports share one set
// of operation identifiers. A Map (rather than a plain object) is used so
// lookups can never resolve to inherited Object.prototype members (e.g. if
// `op` were the string "constructor").
export const COMPUTE_OPS = new Map([
  ['looped', runLoopedForcingCompute],
  ['maximum-looped', runMaximumLoopedForcingCompute],
  ['forts', runLoopFortsCompute],
  ['blocking-sets', runLoopBlockingSetsCompute],
])

export const runForcingCompute = (op, payload, checkpoint) => {
  const handler = COMPUTE_OPS.get(op)
  if (typeof handler !== 'function') throw new Error(`Unknown forcing computation: ${ op }`)
  return handler({ ...payload, checkpoint })
}
