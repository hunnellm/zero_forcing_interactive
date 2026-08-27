/* global BigInt */
import { clampParameter } from './forcing'
import { parseGraph6 } from './graph6'
import { minRankByGraph6 } from './max-nullity-data'
import { MAX_DISPLAYED_MINIMUM_SETS, NUMBER_VARIANTS, SET_VARIANTS } from './forcing-analysis-shared'

const toBigInt = value => BigInt(value)

export class CancellationError extends Error {
  constructor(message = 'Computation cancelled') {
    super(message)
    this.name = 'CancellationError'
  }
}

const normalizeNumericParameter = value => Number(clampParameter(value, 1).toFixed(6))

const maskForVertex = vertex => 1n << toBigInt(vertex)

const hasVertex = (mask, vertex) => (mask & maskForVertex(vertex)) !== 0n

const popcount = mask => {
  let count = 0
  let current = mask
  while (current > 0n) {
    count += Number(current & 1n)
    current >>= 1n
  }
  return count
}

const bitmaskToSet = (mask, n) => {
  const vertices = []
  for (let vertex = 0; vertex < n; vertex += 1) {
    if (hasVertex(mask, vertex)) {
      vertices.push(vertex)
    }
  }
  return vertices
}

const buildAdjacencyMasks = adjacencyData => adjacencyData.map((row, rowIndex) => row.reduce(
  (mask, entry, columnIndex) => (
    entry === 1 && rowIndex !== columnIndex
      ? (mask | maskForVertex(columnIndex))
      : mask
  ),
  0n,
))

const createWorkPoller = checkCancelled => {
  return () => {
    if (checkCancelled()) {
      throw new CancellationError()
    }
  }
}

const enumerateSubsets = (n, size, callback) => {
  if (size < 0 || size > n) return false
  if (size === 0) return callback(0n)

  const recurse = (start, depth, mask) => {
    if (depth === size) {
      return callback(mask)
    }
    for (let vertex = start; vertex <= n - (size - depth); vertex += 1) {
      if (recurse(vertex + 1, depth + 1, mask | maskForVertex(vertex))) {
        return true
      }
    }
    return false
  }

  return recurse(0, 0, 0n)
}

const zeroForcingClosure = (adjacencyMasks, initialMask, n, poll) => {
  let black = initialMask
  let changed = true
  while (changed) {
    changed = false
    for (let vertex = 0; vertex < n; vertex += 1) {
      poll()
      if (!hasVertex(black, vertex)) continue
      const whiteNeighbors = adjacencyMasks[vertex] & ~black
      if (whiteNeighbors !== 0n && (whiteNeighbors & (whiteNeighbors - 1n)) === 0n) {
        const nextBlack = black | whiteNeighbors
        if (nextBlack !== black) {
          black = nextBlack
          changed = true
        }
      }
    }
  }
  return black
}

const whiteComponents = (adjacencyData, blackMask, n, poll) => {
  const components = []
  const visited = new Set()

  for (let vertex = 0; vertex < n; vertex += 1) {
    poll()
    if (hasVertex(blackMask, vertex) || visited.has(vertex)) continue

    const stack = [vertex]
    const component = []
    visited.add(vertex)

    while (stack.length > 0) {
      const current = stack.pop()
      component.push(current)
      adjacencyData[current].forEach((entry, neighbor) => {
        if (entry !== 1 || hasVertex(blackMask, neighbor) || visited.has(neighbor)) return
        visited.add(neighbor)
        stack.push(neighbor)
      })
    }

    components.push(component)
  }

  return components
}

const psdClosure = (adjacencyData, adjacencyMasks, initialMask, n, poll) => {
  let black = initialMask
  let changed = true

  while (changed) {
    changed = false
    const components = whiteComponents(adjacencyData, black, n, poll)
    let newBlack = 0n

    for (let vertex = 0; vertex < n; vertex += 1) {
      poll()
      if (!hasVertex(black, vertex)) continue
      components.forEach(component => {
        let uniqueNeighbor = null
        for (let index = 0; index < component.length; index += 1) {
          const candidate = component[index]
          if ((adjacencyMasks[vertex] & maskForVertex(candidate)) === 0n) continue
          if (uniqueNeighbor !== null) {
            uniqueNeighbor = -1
            break
          }
          uniqueNeighbor = candidate
        }
        if (uniqueNeighbor !== null && uniqueNeighbor !== -1) {
          newBlack |= maskForVertex(uniqueNeighbor)
        }
      })
    }

    const nextBlack = black | newBlack
    if (nextBlack !== black) {
      black = nextBlack
      changed = true
    }
  }

  return black
}

const proportionalWeights = (adjacencyData, initialSet, alpha, beta, poll) => {
  const n = adjacencyData.length
  const weights = new Map()
  const filledVertices = new Set(initialSet)
  const unfilledVertices = new Set([...Array(n).keys()].filter(vertex => !filledVertices.has(vertex)))
  const collectedForces = new Set()

  for (let vertex = 0; vertex < n; vertex += 1) {
    weights.set(vertex, filledVertices.has(vertex) ? 1 : 0)
  }

  let again = true
  while (again) {
    again = false
    const currentFilled = [...filledVertices]
    for (let index = 0; index < currentFilled.length; index += 1) {
      poll()
      const vertex = currentFilled[index]
      const unfilledNeighbors = adjacencyData[vertex]
        .map((entry, neighbor) => entry === 1 ? neighbor : null)
        .filter(neighbor => neighbor !== null && unfilledVertices.has(neighbor))

      if (unfilledNeighbors.length !== 1) continue

      const receiver = unfilledNeighbors[0]
      const forceKey = `${vertex}->${receiver}`
      if (collectedForces.has(forceKey)) continue

      again = true
      collectedForces.add(forceKey)
      const updatedWeight = (weights.get(receiver) || 0) + (alpha * (weights.get(vertex) || 0))
      weights.set(receiver, updatedWeight)
      if (updatedWeight >= beta) {
        filledVertices.add(receiver)
        unfilledVertices.delete(receiver)
      }
    }
  }

  return weights
}

const isProportionalForcingSet = (adjacencyData, initialSet, alpha, beta, poll) => {
  const weights = proportionalWeights(adjacencyData, initialSet, alpha, beta, poll)
  return [...weights.values()].every(weight => weight >= beta)
}

const zeroForcingNumber = (adjacencyMasks, n, poll) => {
  const fullMask = (1n << toBigInt(n)) - 1n
  for (let size = 0; size <= n; size += 1) {
    let found = false
    enumerateSubsets(n, size, mask => {
      poll()
      if (zeroForcingClosure(adjacencyMasks, mask, n, poll) === fullMask) {
        found = true
        return true
      }
      return false
    })
    if (found) return size
  }
  return n
}

const faultTolerantNumber = (adjacencyMasks, n, faults, poll) => {
  if (faults < 0) {
    throw new Error('faults must be greater than or equal to 0')
  }
  if (n === 0) return 0

  const fullMask = (1n << toBigInt(n)) - 1n
  const z = zeroForcingNumber(adjacencyMasks, n, poll)
  const lowerBound = faults === 0 ? z : z + faults
  const closureCache = new Map()

  const getClosure = mask => {
    if (!closureCache.has(mask)) {
      closureCache.set(mask, zeroForcingClosure(adjacencyMasks, mask, n, poll))
    }
    return closureCache.get(mask)
  }

  const isFaultTolerantSet = (mask, size) => {
    if (getClosure(mask) !== fullMask) return false
    const subsetSize = size - faults
    if (subsetSize <= 0) return false
    const includedVertices = bitmaskToSet(mask, n)
    let valid = true
    const enumerateFaultSubsets = (start, depth, subsetMask) => {
      if (!valid) return true
      if (depth === subsetSize) {
        poll()
        if (getClosure(subsetMask) !== fullMask) {
          valid = false
          return true
        }
        return false
      }
      for (let index = start; index <= includedVertices.length - (subsetSize - depth); index += 1) {
        if (enumerateFaultSubsets(index + 1, depth + 1, subsetMask | maskForVertex(includedVertices[index]))) {
          return true
        }
      }
      return false
    }
    enumerateFaultSubsets(0, 0, 0n)
    return valid
  }

  for (let size = lowerBound; size <= n; size += 1) {
    let found = false
    enumerateSubsets(n, size, mask => {
      poll()
      if (isFaultTolerantSet(mask, size)) {
        found = true
        return true
      }
      return false
    })
    if (found) return size
  }

  return -1
}

const proportionalNumber = (adjacencyData, alpha, beta, poll) => {
  const n = adjacencyData.length
  for (let size = 0; size <= n; size += 1) {
    let found = false
    enumerateSubsets(n, size, mask => {
      poll()
      if (isProportionalForcingSet(adjacencyData, bitmaskToSet(mask, n), alpha, beta, poll)) {
        found = true
        return true
      }
      return false
    })
    if (found) return size
  }
  return false
}

const degreeSequence = adjacencyData => adjacencyData.map(row => row.reduce((sum, entry) => sum + entry, 0))

const coloredSignature = (adjacencyData, setMask, vertex) => adjacencyData[vertex].reduce(
  (count, entry, neighbor) => count + (entry === 1 && hasVertex(setMask, neighbor) ? 1 : 0),
  0,
)

const areColoredGraphsIsomorphic = (adjacencyDataA, setMaskA, adjacencyDataB, setMaskB) => {
  const n = adjacencyDataA.length
  if (n !== adjacencyDataB.length || popcount(setMaskA) !== popcount(setMaskB)) return false

  const degreesA = degreeSequence(adjacencyDataA)
  const degreesB = degreeSequence(adjacencyDataB)
  const signaturesA = [...Array(n).keys()].map(vertex => `${degreesA[vertex]}|${hasVertex(setMaskA, vertex) ? 1 : 0}|${coloredSignature(adjacencyDataA, setMaskA, vertex)}`)
  const signaturesB = [...Array(n).keys()].map(vertex => `${degreesB[vertex]}|${hasVertex(setMaskB, vertex) ? 1 : 0}|${coloredSignature(adjacencyDataB, setMaskB, vertex)}`)

  const indicesBySignatureB = signaturesB.reduce((groups, signature, vertex) => {
    if (!groups.has(signature)) {
      groups.set(signature, [])
    }
    groups.get(signature).push(vertex)
    return groups
  }, new Map())

  const order = [...Array(n).keys()].sort((left, right) => {
    const leftCount = (indicesBySignatureB.get(signaturesA[left]) || []).length
    const rightCount = (indicesBySignatureB.get(signaturesA[right]) || []).length
    return leftCount - rightCount
  })

  const mapping = new Map()
  const usedTargets = new Set()

  const search = depth => {
    if (depth === order.length) return true
    const source = order[depth]
    const candidates = indicesBySignatureB.get(signaturesA[source]) || []

    for (let index = 0; index < candidates.length; index += 1) {
      const target = candidates[index]
      if (usedTargets.has(target)) continue

      let consistent = true
      for (const [mappedSource, mappedTarget] of mapping.entries()) {
        if (adjacencyDataA[source][mappedSource] !== adjacencyDataB[target][mappedTarget]) {
          consistent = false
          break
        }
      }
      if (!consistent) continue

      mapping.set(source, target)
      usedTargets.add(target)
      if (search(depth + 1)) {
        return true
      }
      mapping.delete(source)
      usedTargets.delete(target)
    }

    return false
  }

  return search(0)
}

const areEquivalentUnderAutomorphism = (adjacencyData, setMaskA, setMaskB) => (
  setMaskA === setMaskB || areColoredGraphsIsomorphic(adjacencyData, setMaskA, adjacencyData, setMaskB)
)

const minimumRankLookupCache = new Map()

const getMinimumRankLookupEntries = order => {
  if (minimumRankLookupCache.has(order)) {
    return minimumRankLookupCache.get(order)
  }

  const entries = Object.keys(minRankByGraph6)
    .map(key => ({
      key,
      adjacencyData: parseGraph6(key),
    }))
    .filter(entry => entry.adjacencyData.length === order)
    .map(entry => ({
      ...entry,
      degreeKey: degreeSequence(entry.adjacencyData).slice().sort((left, right) => left - right).join(','),
    }))

  minimumRankLookupCache.set(order, entries)
  return entries
}

const findMinimumRankLookupKey = adjacencyData => {
  const order = adjacencyData.length
  const degreeKey = degreeSequence(adjacencyData).slice().sort((left, right) => left - right).join(',')
  const candidates = getMinimumRankLookupEntries(order).filter(entry => entry.degreeKey === degreeKey)

  for (let index = 0; index < candidates.length; index += 1) {
    if (areColoredGraphsIsomorphic(adjacencyData, 0n, candidates[index].adjacencyData, 0n)) {
      return candidates[index].key
    }
  }

  return null
}

const isFaultTolerantZeroForcingSet = (adjacencyMasks, closureCache, mask, n, faults, poll) => {
  const fullMask = (1n << toBigInt(n)) - 1n

  const getClosure = m => {
    if (!closureCache.has(m)) {
      closureCache.set(m, zeroForcingClosure(adjacencyMasks, m, n, poll))
    }
    return closureCache.get(m)
  }

  if (getClosure(mask) !== fullMask) return false
  const size = popcount(mask)
  const subsetSize = size - faults
  if (subsetSize <= 0) return false
  const includedVertices = bitmaskToSet(mask, n)
  let valid = true

  const enumerateFaultSubsets = (start, depth, subsetMask) => {
    if (!valid) return true
    if (depth === subsetSize) {
      poll()
      if (getClosure(subsetMask) !== fullMask) {
        valid = false
        return true
      }
      return false
    }
    for (let index = start; index <= includedVertices.length - (subsetSize - depth); index += 1) {
      if (enumerateFaultSubsets(index + 1, depth + 1, subsetMask | maskForVertex(includedVertices[index]))) {
        return true
      }
    }
    return false
  }

  enumerateFaultSubsets(0, 0, 0n)
  return valid
}

const findRepresentativeFaultTolerantMinimumSets = (adjacencyData, faults, cap, poll) => {
  const n = adjacencyData.length
  const adjacencyMasks = buildAdjacencyMasks(adjacencyData)
  const closureCache = new Map()

  for (let size = 0; size <= n; size += 1) {
    const representatives = []
    let truncated = false
    let foundAny = false

    const stop = enumerateSubsets(n, size, mask => {
      poll()
      if (!isFaultTolerantZeroForcingSet(adjacencyMasks, closureCache, mask, n, faults, poll)) return false
      foundAny = true
      const alreadyRepresented = representatives.some(existing => areEquivalentUnderAutomorphism(adjacencyData, existing, mask))
      if (!alreadyRepresented) {
        representatives.push(mask)
        if (representatives.length > cap) {
          truncated = true
          return true
        }
      }
      return false
    })

    if (foundAny || stop) {
      const limitedRepresentatives = representatives.slice(0, cap)
      return {
        number: size,
        sets: limitedRepresentatives.map(mask => bitmaskToSet(mask, n)),
        truncated,
      }
    }
  }

  return {
    number: n,
    sets: [],
    truncated: false,
  }
}

const findRepresentativeMinimumSets = (adjacencyData, variant, cap, poll) => {
  const n = adjacencyData.length
  const adjacencyMasks = buildAdjacencyMasks(adjacencyData)
  const fullMask = (1n << toBigInt(n)) - 1n
  const closure = variant === SET_VARIANTS.PSD
    ? mask => psdClosure(adjacencyData, adjacencyMasks, mask, n, poll)
    : mask => zeroForcingClosure(adjacencyMasks, mask, n, poll)

  for (let size = 0; size <= n; size += 1) {
    const representatives = []
    let truncated = false
    let foundAny = false

    const stop = enumerateSubsets(n, size, mask => {
      poll()
      if (closure(mask) !== fullMask) return false
      foundAny = true
      const alreadyRepresented = representatives.some(existing => areEquivalentUnderAutomorphism(adjacencyData, existing, mask))
      if (!alreadyRepresented) {
        representatives.push(mask)
        if (representatives.length > cap) {
          truncated = true
          return true
        }
      }
      return false
    })

    if (foundAny || stop) {
      const limitedRepresentatives = representatives.slice(0, cap)
      return {
        number: size,
        sets: limitedRepresentatives.map(mask => bitmaskToSet(mask, n)),
        truncated,
      }
    }
  }

  return {
    number: n,
    sets: [],
    truncated: false,
  }
}

export const computeNumberResult = ({
  adjacencyData,
  graph6String,
  variant,
  alpha = 1,
  beta = 1,
  checkCancelled = () => false,
}) => {
  const poll = createWorkPoller(checkCancelled)
  const adjacencyMasks = buildAdjacencyMasks(adjacencyData)
  const nodeCount = adjacencyData.length

  if (variant === NUMBER_VARIANTS.FAULT_TOLERANT) {
    return {
      variant,
      label: 'Fault-tolerant forcing number',
      value: faultTolerantNumber(adjacencyMasks, nodeCount, 1, poll),
    }
  }

  if (variant === NUMBER_VARIANTS.PROPORTIONAL) {
    const normalizedAlpha = normalizeNumericParameter(alpha)
    const normalizedBeta = normalizeNumericParameter(beta)
    return {
      variant,
      alpha: normalizedAlpha,
      beta: normalizedBeta,
      label: 'Proportional forcing number',
      value: proportionalNumber(adjacencyData, normalizedAlpha, normalizedBeta, poll),
    }
  }

  if (variant === NUMBER_VARIANTS.MAXIMUM_NULLITY) {
    const lookupKey = adjacencyData.length <= 8 ? findMinimumRankLookupKey(adjacencyData) : graph6String
    if (!(lookupKey in minRankByGraph6)) {
      throw new Error('Maximum-nullity lookup is unavailable for this graph. This app currently uses the exact graph6 lookup from hunnellm/maximum-nullity for graphs on at most 8 vertices.')
    }
    return {
      variant,
      label: 'Maximum nullity',
      value: nodeCount - minRankByGraph6[lookupKey],
    }
  }

  throw new Error(`Unsupported number variant: ${variant}`)
}

export const computeSetsResult = ({
  adjacencyData,
  variant,
  cap = MAX_DISPLAYED_MINIMUM_SETS,
  checkCancelled = () => false,
}) => {
  const poll = createWorkPoller(checkCancelled)
  if (!Object.values(SET_VARIANTS).includes(variant)) {
    throw new Error(`Unsupported minimum-set variant: ${variant}`)
  }

  if (variant === SET_VARIANTS.FAULT_TOLERANT) {
    const result = findRepresentativeFaultTolerantMinimumSets(adjacencyData, 1, cap, poll)
    return {
      variant,
      label: 'Minimum fault-tolerant forcing sets up to graph automorphism',
      ...result,
    }
  }

  const result = findRepresentativeMinimumSets(adjacencyData, variant, cap, poll)
  return {
    variant,
    label: variant === SET_VARIANTS.PSD
      ? 'Minimum PSD forcing sets up to graph automorphism'
      : 'Minimum forcing sets up to graph automorphism',
    ...result,
  }
}
