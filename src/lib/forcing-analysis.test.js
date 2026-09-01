const assert = require('assert')
const fs = require('fs')
const path = require('path')
const babel = require('@babel/core')

const moduleCache = new Map()

const loadModule = modulePath => {
  const resolved = path.resolve(__dirname, modulePath)
  if (moduleCache.has(resolved)) {
    return moduleCache.get(resolved)
  }

  const sourceCode = fs.readFileSync(resolved, 'utf8')
  const transformedCode = babel.transformSync(sourceCode, {
    presets: [['@babel/preset-env', { modules: 'commonjs' }]],
    sourceType: 'module',
    filename: resolved,
  }).code

  const moduleObject = { exports: {} }
  moduleCache.set(resolved, moduleObject.exports)

  const localRequire = request => {
    if (!request.startsWith('.')) {
      return require(request)
    }

    const requestPath = path.extname(request) ? request : `${request}.js`
    return loadModule(path.relative(__dirname, path.resolve(path.dirname(resolved), requestPath)))
  }

  new Function('require', 'module', 'exports', transformedCode)(localRequire, moduleObject, moduleObject.exports)
  moduleCache.set(resolved, moduleObject.exports)
  return moduleObject.exports
}

const analysis = loadModule('./forcing-analysis.js')
const shared = loadModule('./forcing-analysis-shared.js')
const { encodeGraph6 } = loadModule('./graph6.js')

const pathGraph5 = [
  [0, 1, 0, 0, 0],
  [1, 0, 1, 0, 0],
  [0, 1, 0, 1, 0],
  [0, 0, 1, 0, 1],
  [0, 0, 0, 1, 0],
]

const graph6String = encodeGraph6(pathGraph5)

assert.strictEqual(shared.createOperationState().status, shared.COMPUTE_STATUS.IDLE, 'Computations should begin idle until explicitly triggered')
assert.strictEqual(shared.clampActiveSetIndex(-1, 3), 0, 'Previous navigation should clamp at the first set')
assert.strictEqual(shared.clampActiveSetIndex(9, 3), 2, 'Next navigation should clamp at the last set')
assert.strictEqual(shared.isResultStale('a', 'b'), true, 'Mismatched graph+variant keys should be stale')
assert.strictEqual(shared.isResultStale('a', 'a'), false, 'Matching graph+variant keys should stay fresh')

const proportionalKey = shared.createCacheKey({
  graph6String,
  operation: shared.COMPUTE_OPERATIONS.NUMBER,
  ...shared.createNumberVariantConfig({
    variant: shared.NUMBER_VARIANTS.PROPORTIONAL,
    alpha: 0.5,
    beta: 0.75,
  }),
})

const proportionalKeyChanged = shared.createCacheKey({
  graph6String,
  operation: shared.COMPUTE_OPERATIONS.NUMBER,
  ...shared.createNumberVariantConfig({
    variant: shared.NUMBER_VARIANTS.PROPORTIONAL,
    alpha: 0.75,
    beta: 0.75,
  }),
})

assert.notStrictEqual(proportionalKey, proportionalKeyChanged, 'Cache keys should include proportional forcing parameters')

const loopedKeyA = shared.createCacheKey({
  graph6String,
  operation: shared.ADVANCED_VARIANTS.LOOPED,
  variant: shared.ADVANCED_VARIANTS.LOOPED,
  loopedVertices: new Set([2, 0]),
})
const loopedKeyB = shared.createCacheKey({
  graph6String,
  operation: shared.ADVANCED_VARIANTS.LOOPED,
  variant: shared.ADVANCED_VARIANTS.LOOPED,
  loopedVertices: new Set([0, 2]),
})
const loopedKeyDifferentConfig = shared.createCacheKey({
  graph6String,
  operation: shared.ADVANCED_VARIANTS.LOOPED,
  variant: shared.ADVANCED_VARIANTS.LOOPED,
  loopedVertices: new Set([0, 1]),
})

assert.strictEqual(loopedKeyA, loopedKeyB, 'Cache keys for loop configurations should be independent of Set insertion order')
assert.notStrictEqual(loopedKeyA, loopedKeyDifferentConfig, 'Cache keys should change when the loop configuration changes')
assert.deepStrictEqual(
  Object.values(shared.ADVANCED_VARIANTS).sort(),
  ['blocking-sets', 'fort', 'looped', 'maximum-looped'],
  'ADVANCED_VARIANTS should expose the looped-forcing, maximum-looped, fort, and blocking-set variants',
)

const faultTolerant = analysis.computeNumberResult({
  adjacencyData: pathGraph5,
  graph6String,
  variant: shared.NUMBER_VARIANTS.FAULT_TOLERANT,
})
assert.strictEqual(faultTolerant.value, 2, 'P5 should have fault-tolerant forcing number 2')

const proportional = analysis.computeNumberResult({
  adjacencyData: pathGraph5,
  graph6String,
  variant: shared.NUMBER_VARIANTS.PROPORTIONAL,
  alpha: 1,
  beta: 1,
})
assert.strictEqual(proportional.value, 1, 'Proportional forcing with α=β=1 should match standard forcing on P5')

const maximumNullity = analysis.computeNumberResult({
  adjacencyData: pathGraph5,
  graph6String,
  variant: shared.NUMBER_VARIANTS.MAXIMUM_NULLITY,
})
assert.strictEqual(maximumNullity.value, 1, 'P5 should have maximum nullity 1')

const standardSets = analysis.computeSetsResult({
  adjacencyData: pathGraph5,
  variant: shared.SET_VARIANTS.STANDARD,
})
assert.strictEqual(standardSets.number, 1, 'P5 should have forcing number 1')
assert.deepStrictEqual(standardSets.sets, [[0]], 'Standard minimum forcing sets should collapse to one automorphism representative on P5')
assert.strictEqual(standardSets.truncated, false, 'Small representative lists should not be truncated')

const psdSets = analysis.computeSetsResult({
  adjacencyData: pathGraph5,
  variant: shared.SET_VARIANTS.PSD,
})
assert.strictEqual(psdSets.number, 1, 'P5 should have PSD forcing number 1')
assert.deepStrictEqual(psdSets.sets, [[0], [1], [2]], 'PSD minimum forcing sets should retain one representative per automorphism class on P5')

const truncatedPsdSets = analysis.computeSetsResult({
  adjacencyData: pathGraph5,
  variant: shared.SET_VARIANTS.PSD,
  cap: 2,
})
assert.strictEqual(truncatedPsdSets.truncated, true, 'Representative sets should report truncation when the display cap is exceeded')
assert.strictEqual(truncatedPsdSets.sets.length, 2, 'Representative sets should be capped at the requested display limit')

assert.throws(
  () => analysis.computeSetsResult({
    adjacencyData: pathGraph5,
    variant: shared.SET_VARIANTS.PSD,
    checkCancelled: () => true,
  }),
  error => error && error.name === 'CancellationError',
  'Cancelled computations should surface a cancellation error',
)

const faultTolerantSets = analysis.computeSetsResult({
  adjacencyData: pathGraph5,
  variant: shared.SET_VARIANTS.FAULT_TOLERANT,
})
assert.strictEqual(faultTolerantSets.number, 2, 'P5 should have fault-tolerant forcing number 2')
assert.deepStrictEqual(faultTolerantSets.sets, [[0, 4]], 'FTZF minimum sets on P5 should collapse to one automorphism representative {0,4}')
assert.strictEqual(faultTolerantSets.truncated, false, 'Small FTZF representative lists should not be truncated')

const truncatedFaultTolerantSets = analysis.computeSetsResult({
  adjacencyData: pathGraph5,
  variant: shared.SET_VARIANTS.FAULT_TOLERANT,
  cap: 0,
})
assert.strictEqual(truncatedFaultTolerantSets.sets.length, 0, 'FTZF representative sets should be capped at the requested display limit')
assert.strictEqual(truncatedFaultTolerantSets.truncated, true, 'FTZF representative sets should report truncation when the display cap is exceeded')

assert.throws(
  () => analysis.computeSetsResult({
    adjacencyData: pathGraph5,
    variant: shared.SET_VARIANTS.FAULT_TOLERANT,
    checkCancelled: () => true,
  }),
  error => error && error.name === 'CancellationError',
  'Cancelled FTZF computations should surface a cancellation error',
)

// Regression coverage: every recognized SET_VARIANTS entry must be handled by
// computeSetsResult's dispatcher. This guards against the class of bug where
// a new variant is added to SET_VARIANTS (or the dispatcher's cases drift
// out of sync with it) but the dispatcher throws "Unsupported minimum-set
// variant" for it at runtime.
Object.values(shared.SET_VARIANTS).forEach(variant => {
  assert.doesNotThrow(
    () => analysis.computeSetsResult({ adjacencyData: pathGraph5, variant }),
    `computeSetsResult should recognize and dispatch the "${variant}" SET_VARIANTS entry`,
  )
})

// Passing a raw string that matches a known variant value (as arrives from
// worker postMessage payloads, localStorage, or the UI toggle) must also be
// recognized, independent of strict `===` identity with the SET_VARIANTS
// object references.
const faultTolerantByLiteral = analysis.computeSetsResult({
  adjacencyData: pathGraph5,
  variant: 'fault-tolerant',
})
assert.strictEqual(faultTolerantByLiteral.number, 2, 'The literal "fault-tolerant" string should dispatch identically to SET_VARIANTS.FAULT_TOLERANT')

assert.throws(
  () => analysis.computeSetsResult({
    adjacencyData: pathGraph5,
    variant: 'not-a-real-variant',
  }),
  /Unsupported minimum-set variant: not-a-real-variant/,
  'Unrecognized variants should still surface a clear unsupported-variant error',
)

console.log('forcing analysis tests passed')
