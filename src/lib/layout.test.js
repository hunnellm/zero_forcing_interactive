const assert = require('assert')
const fs = require('fs')
const path = require('path')
const babel = require('@babel/core')

const sourcePath = path.resolve(__dirname, './layout.js')
const sourceCode = fs.readFileSync(sourcePath, 'utf8')
const transformedCode = babel.transformSync(sourceCode, {
  presets: [['@babel/preset-env', { modules: 'commonjs' }]],
  sourceType: 'module',
}).code

const moduleObject = { exports: {} }
new Function('module', 'exports', transformedCode)(moduleObject, moduleObject.exports)
const { connectedComponents, computeInitialLayout } = moduleObject.exports

// --- connectedComponents ---

// Single node, no edges
assert.deepStrictEqual(
  connectedComponents([0], new Map([[0, []]])),
  [[0]]
)

// Two nodes, one edge -> one component
assert.deepStrictEqual(
  connectedComponents([0, 1], new Map([[0, [1]], [1, [0]]])),
  [[0, 1]]
)

// Two isolated nodes -> two components
const isolated = connectedComponents([0, 1], new Map([[0, []], [1, []]]))
assert.strictEqual(isolated.length, 2)
assert.ok(isolated.some(c => c.length === 1 && c[0] === 0))
assert.ok(isolated.some(c => c.length === 1 && c[0] === 1))

// Triangle: all in one component
const triAdj = new Map([
  [0, [1, 2]], [1, [0, 2]], [2, [0, 1]],
])
assert.deepStrictEqual(connectedComponents([0, 1, 2], triAdj), [[0, 1, 2]])

// Path 0-1-2 plus isolated 3 -> two components
const pathAdj = new Map([
  [0, [1]], [1, [0, 2]], [2, [1]], [3, []],
])
const pathComps = connectedComponents([0, 1, 2, 3], pathAdj)
assert.strictEqual(pathComps.length, 2)
const compSizes = pathComps.map(c => c.length).sort((a, b) => a - b)
assert.deepStrictEqual(compSizes, [1, 3])

// --- computeInitialLayout ---

// Empty input returns empty map
const emptyResult = computeInitialLayout([], [], 500, 400)
assert.strictEqual(emptyResult.size, 0)

// Single node: positioned at (0, 0)
const singleResult = computeInitialLayout([{ id: 0 }], [], 500, 400)
assert.strictEqual(singleResult.size, 1)
assert.ok(Number.isFinite(singleResult.get(0).x))
assert.ok(Number.isFinite(singleResult.get(0).y))

// All nodes receive finite positions
const nodes4 = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }]
const edges4 = [
  { source: 0, target: 1 },
  { source: 1, target: 2 },
  { source: 2, target: 3 },
]
const result4 = computeInitialLayout(nodes4, edges4, 500, 400)
assert.strictEqual(result4.size, 4)
for (const [, pos] of result4) {
  assert.ok(Number.isFinite(pos.x), `x should be finite, got ${pos.x}`)
  assert.ok(Number.isFinite(pos.y), `y should be finite, got ${pos.y}`)
}

// Deterministic: same input always produces the same positions
const resultA = computeInitialLayout(nodes4, edges4, 500, 400)
const resultB = computeInitialLayout(nodes4, edges4, 500, 400)
for (const { id } of nodes4) {
  assert.strictEqual(resultA.get(id).x, resultB.get(id).x, `x differs for node ${id}`)
  assert.strictEqual(resultA.get(id).y, resultB.get(id).y, `y differs for node ${id}`)
}

// Disconnected graph: both components receive positions
const discNodes = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }]
const discEdges = [
  { source: 0, target: 1 },  // component A
  { source: 2, target: 3 },  // component B
]
const discResult = computeInitialLayout(discNodes, discEdges, 500, 400)
assert.strictEqual(discResult.size, 4)
for (const { id } of discNodes) {
  assert.ok(Number.isFinite(discResult.get(id).x))
  assert.ok(Number.isFinite(discResult.get(id).y))
}

// Fully disconnected (edgeless) nodes – all receive positions
const isolatedNodes = [{ id: 0 }, { id: 1 }, { id: 2 }]
const isoResult = computeInitialLayout(isolatedNodes, [], 500, 400)
assert.strictEqual(isoResult.size, 3)
for (const { id } of isolatedNodes) {
  assert.ok(Number.isFinite(isoResult.get(id).x))
  assert.ok(Number.isFinite(isoResult.get(id).y))
}

// Edge whose endpoint is an object {id} should be handled
const objEdgeNodes = [{ id: 0 }, { id: 1 }]
const objEdges = [{ source: { id: 0 }, target: { id: 1 } }]
const objResult = computeInitialLayout(objEdgeNodes, objEdges, 500, 400)
assert.strictEqual(objResult.size, 2)
assert.ok(Number.isFinite(objResult.get(0).x))
assert.ok(Number.isFinite(objResult.get(1).x))

// Complete graph K4: all nodes should be spatially separated
const k4Nodes = [0, 1, 2, 3].map(id => ({ id }))
const k4Edges = []
for (let i = 0; i < 4; i++) {
  for (let j = i + 1; j < 4; j++) {
    k4Edges.push({ source: i, target: j })
  }
}
const k4Result = computeInitialLayout(k4Nodes, k4Edges, 500, 400)
const k4Positions = [...k4Result.values()]
// No two nodes should be at exactly the same location
for (let i = 0; i < k4Positions.length; i++) {
  for (let j = i + 1; j < k4Positions.length; j++) {
    const dx = k4Positions[i].x - k4Positions[j].x
    const dy = k4Positions[i].y - k4Positions[j].y
    const dist = Math.sqrt(dx * dx + dy * dy)
    assert.ok(dist > 0.001, `Nodes ${i} and ${j} are too close (dist=${dist})`)
  }
}

// Redraw parity regression test: computeInitialLayout is the single shared
// algorithm used for both the first-display layout pass and manual redraw
// (see GraphProvider.triggerManualRedraw). Since node x/y are not part of
// the function's inputs (only ids + edges are), re-invoking it for the
// exact same graph -- as a "redraw" would -- must reproduce the exact same
// balancing/placement as the original "first display" call, even when the
// nodes carry stale/previous positions from prior interaction.
const firstDisplayNodes = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }]
const firstDisplayEdges = [
  { source: 0, target: 1 },
  { source: 1, target: 2 },
  { source: 2, target: 3 },
  { source: 3, target: 0 },
]
const firstDisplayResult = computeInitialLayout(firstDisplayNodes, firstDisplayEdges, 500, 400)

// Simulate nodes that have since been dragged around / perturbed by prior
// interaction -- a redraw should ignore those stale coordinates entirely.
const redrawInputNodes = firstDisplayNodes.map(({ id }) => ({ id, x: 9999, y: -9999 }))
const redrawResult = computeInitialLayout(redrawInputNodes, firstDisplayEdges, 500, 400)

for (const { id } of firstDisplayNodes) {
  assert.strictEqual(
    redrawResult.get(id).x,
    firstDisplayResult.get(id).x,
    `redraw x should match first-display x for node ${id}`,
  )
  assert.strictEqual(
    redrawResult.get(id).y,
    firstDisplayResult.get(id).y,
    `redraw y should match first-display y for node ${id}`,
  )
}

console.log('layout tests passed')
