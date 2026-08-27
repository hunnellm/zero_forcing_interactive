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

console.log('forcing analysis tests passed')
