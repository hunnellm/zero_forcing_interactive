const assert = require('assert')
const fs = require('fs')
const path = require('path')
const babel = require('@babel/core')

const sourcePath = path.resolve(__dirname, './tikz.js')
const sourceCode = fs.readFileSync(sourcePath, 'utf8')
const transformedCode = babel.transformSync(sourceCode, {
  presets: [['@babel/preset-env', { modules: 'commonjs' }]],
  sourceType: 'module',
}).code

const moduleObject = { exports: {} }
new Function('module', 'exports', transformedCode)(moduleObject, moduleObject.exports)
const { escapeLatex, hexToRgb, screenToTikz, generateTikz } = moduleObject.exports

// ---------------------------------------------------------------------------
// escapeLatex
// ---------------------------------------------------------------------------
assert.strictEqual(escapeLatex('hello'), 'hello', 'plain text unchanged')
assert.strictEqual(escapeLatex('a_b'), 'a\\_b', 'underscore escaped')
assert.strictEqual(escapeLatex('a%b'), 'a\\%b', 'percent escaped')
assert.strictEqual(escapeLatex('a&b'), 'a\\&b', 'ampersand escaped')
assert.strictEqual(escapeLatex('a$b'), 'a\\$b', 'dollar escaped')
assert.strictEqual(escapeLatex('a#b'), 'a\\#b', 'hash escaped')
assert.strictEqual(escapeLatex('a^b'), 'a\\^{}b', 'caret escaped')
assert.strictEqual(escapeLatex('a~b'), 'a\\textasciitilde{}b', 'tilde escaped')
assert.strictEqual(escapeLatex(42), '42', 'numeric label converted to string')

// ---------------------------------------------------------------------------
// hexToRgb
// ---------------------------------------------------------------------------
assert.deepStrictEqual(hexToRgb('#ff0000'), { r: 255, g: 0, b: 0 }, '6-digit hex red')
assert.deepStrictEqual(hexToRgb('#00ff00'), { r: 0, g: 255, b: 0 }, '6-digit hex green')
assert.deepStrictEqual(hexToRgb('#fff'), { r: 255, g: 255, b: 255 }, '3-digit hex white')
assert.deepStrictEqual(hexToRgb('#000'), { r: 0, g: 0, b: 0 }, '3-digit hex black')
assert.deepStrictEqual(hexToRgb('#a14f92'), { r: 161, g: 79, b: 146 }, 'default app color')
assert.strictEqual(hexToRgb('notacolor'), null, 'invalid returns null')
assert.strictEqual(hexToRgb(null), null, 'null returns null')

// ---------------------------------------------------------------------------
// screenToTikz
// ---------------------------------------------------------------------------
const origin = screenToTikz(0, 0)
assert.strictEqual(origin.x, 0, 'origin x is 0')
assert.strictEqual(origin.y, 0, 'origin y is 0')

const flipped = screenToTikz(0, 100, 0.05)
assert.strictEqual(flipped.y, -5, 'y-axis is inverted')

const scaled = screenToTikz(200, 0, 0.05)
assert.strictEqual(scaled.x, 10, 'x scaled correctly')

// ---------------------------------------------------------------------------
// generateTikz
// ---------------------------------------------------------------------------
const nodes = [
  { id: 0, x: 0, y: 0 },
  { id: 1, x: 100, y: 0 },
]
const edges = [{ source: 0, target: 1 }]
const coloredNodes = new Set([0])
const filledColor = '#ff0000'

const tikz = generateTikz(nodes, edges, coloredNodes, filledColor, 0.05)

assert.ok(tikz.includes('\\begin{tikzpicture}'), 'has tikzpicture begin')
assert.ok(tikz.includes('\\end{tikzpicture}'), 'has tikzpicture end')
assert.ok(tikz.includes('\\definecolor{filledcolor}{HTML}{FF0000}'), 'has color definition')
assert.ok(tikz.includes('fill=filledcolor'), 'colored node uses filledcolor')
assert.ok(tikz.includes('fill=white'), 'uncolored node uses white')
assert.ok(tikz.includes('(n0)'), 'node 0 present')
assert.ok(tikz.includes('(n1)'), 'node 1 present')
assert.ok(tikz.includes('\\draw (n0) -- (n1)'), 'edge present')

// No color def when no nodes are colored
const tikzNoColor = generateTikz(nodes, edges, new Set(), filledColor, 0.05)
assert.ok(!tikzNoColor.includes('\\definecolor'), 'no definecolor when no colored nodes')

// Edge source/target as objects (as react-force-graph stores them after simulation)
const edgesAsObjects = [{ source: { id: 0 }, target: { id: 1 } }]
const tikzObjEdges = generateTikz(nodes, edgesAsObjects, new Set(), filledColor, 0.05)
assert.ok(tikzObjEdges.includes('\\draw (n0) -- (n1)'), 'object-style edge resolved correctly')

// Node without valid coordinates should be skipped
const nodesWithMissing = [
  { id: 0, x: 0, y: 0 },
  { id: 1, x: NaN, y: 0 },
]
const tikzMissing = generateTikz(nodesWithMissing, [], new Set(), filledColor, 0.05)
assert.ok(!tikzMissing.includes('(n1)'), 'node with NaN x is skipped')

console.log('All tikz tests passed.')
