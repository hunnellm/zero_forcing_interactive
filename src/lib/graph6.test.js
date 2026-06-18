const assert = require('assert')
const fs = require('fs')
const path = require('path')
const babel = require('@babel/core')

const sourcePath = path.resolve(__dirname, './graph6.js')
const sourceCode = fs.readFileSync(sourcePath, 'utf8')
const transformedCode = babel.transformSync(sourceCode, {
  presets: [['@babel/preset-env', { modules: 'commonjs' }]],
  sourceType: 'module',
}).code

const moduleObject = { exports: {} }
new Function('module', 'exports', transformedCode)(moduleObject, moduleObject.exports)
const { parseGraph6, encodeGraph6 } = moduleObject.exports

const oneVertexGraph = parseGraph6('@')
assert.deepStrictEqual(oneVertexGraph, [[0]])

const edgeOnTwoVertices = parseGraph6('A_')
assert.deepStrictEqual(edgeOnTwoVertices, [
  [0, 1],
  [1, 0],
])

const triangleGraph = parseGraph6('Bw')
assert.deepStrictEqual(triangleGraph, [
  [0, 1, 1],
  [1, 0, 1],
  [1, 1, 0],
])

const triangleWithHeader = parseGraph6('>>graph6<<Bw')
assert.deepStrictEqual(triangleWithHeader, triangleGraph)

assert.throws(() => parseGraph6(''), /Graph6 string is empty/)
assert.throws(() => parseGraph6('A!'), /Invalid graph6 character/)
assert.throws(() => parseGraph6('D'), /Graph6 edge data length is invalid/)

// encodeGraph6 tests
assert.strictEqual(encodeGraph6([[0]]), '@')
assert.strictEqual(encodeGraph6([[0, 1], [1, 0]]), 'A_')
assert.strictEqual(encodeGraph6([[0, 1, 1], [1, 0, 1], [1, 1, 0]]), 'Bw')
assert.strictEqual(encodeGraph6([[0, 0], [0, 0]]), 'A?')

// round-trip: parse then encode should reproduce the original string
const dhc = 'Dhc'
assert.strictEqual(encodeGraph6(parseGraph6(dhc)), dhc)

console.log('graph6 parser tests passed')
