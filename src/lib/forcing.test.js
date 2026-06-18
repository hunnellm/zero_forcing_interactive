const assert = require('assert')
const fs = require('fs')
const path = require('path')
const babel = require('@babel/core')

const sourcePath = path.resolve(__dirname, './forcing.js')
const sourceCode = fs.readFileSync(sourcePath, 'utf8')
const transformedCode = babel.transformSync(sourceCode, {
  presets: [['@babel/preset-env', { modules: 'commonjs' }]],
  sourceType: 'module',
}).code

const moduleObject = { exports: {} }
new Function('module', 'exports', transformedCode)(moduleObject, moduleObject.exports)
const {
  FORCING_MODES,
  clampParameter,
  formatNodeLabel,
  initialWeights,
  runForcingStep,
} = moduleObject.exports

const pathGraph = [
  [0, 1, 0],
  [1, 0, 1],
  [0, 1, 0],
]

const psdDifferenceGraph = [
  [0, 1, 0, 1, 0],
  [1, 0, 1, 0, 0],
  [0, 1, 0, 0, 0],
  [1, 0, 0, 0, 1],
  [0, 0, 0, 1, 0],
]

// Mode-specific forcing behavior (zero vs psd)
const zeroStep = runForcingStep({
  mode: FORCING_MODES.ZERO,
  adjacencyData: psdDifferenceGraph,
  coloredNodes: new Set([0]),
  nodeWeights: initialWeights(5, new Set([0])),
  alpha: 0.5,
  beta: 0.5,
})
assert.deepStrictEqual(
  [...zeroStep.coloredNodes].sort((a, b) => a - b),
  [0],
  'Zero forcing should not force in this configuration',
)

const psdStep = runForcingStep({
  mode: FORCING_MODES.PSD,
  adjacencyData: psdDifferenceGraph,
  coloredNodes: new Set([0]),
  nodeWeights: initialWeights(5, new Set([0])),
  alpha: 0.5,
  beta: 0.5,
})
assert.deepStrictEqual(
  [...psdStep.coloredNodes].sort((a, b) => a - b),
  [0, 1, 3],
  'PSD forcing should force nodes in distinct uncolored components',
)

// Transmission accumulation from multiple eligible transmitters
const transmissionStep = runForcingStep({
  mode: FORCING_MODES.TRANSMISSION,
  adjacencyData: [
    [0, 0, 1],
    [0, 0, 1],
    [1, 1, 0],
  ],
  coloredNodes: new Set([0, 1]),
  nodeWeights: new Map([[0, 1], [1, 1], [2, 0]]),
  alpha: 0.4,
  beta: 0.7,
})
assert.strictEqual(transmissionStep.nodeWeights.get(2), 0.8)
assert.ok(transmissionStep.coloredNodes.has(2), 'Node 2 should fill when weight exceeds beta')

// Transmission threshold must be strict (> beta, not >= beta)
const strictThresholdStep = runForcingStep({
  mode: FORCING_MODES.TRANSMISSION,
  adjacencyData: pathGraph,
  coloredNodes: new Set([0]),
  nodeWeights: new Map([[0, 1], [1, 0], [2, 0]]),
  alpha: 0.5,
  beta: 0.5,
})
assert.strictEqual(strictThresholdStep.nodeWeights.get(1), 0.5)
assert.ok(!strictThresholdStep.coloredNodes.has(1), 'Node 1 should remain unfilled when weight equals beta')

// Label formatting includes current weight
assert.strictEqual(formatNodeLabel(7, 0.333), '7 (w=0.33)')

// Parameter clamping to [0, 1]
assert.strictEqual(clampParameter(-1, 0.5), 0)
assert.strictEqual(clampParameter(2, 0.5), 1)
assert.strictEqual(clampParameter('bad', 0.25), 0.25)

console.log('forcing logic tests passed')
