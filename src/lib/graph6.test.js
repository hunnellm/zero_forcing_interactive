const assert = require('assert')
const fs = require('fs')
const path = require('path')
const babel = require('@babel/core')

const sourcePath = path.resolve(__dirname, './graph6.js')
const sourceCode = fs.readFileSync(sourcePath, 'utf8')
const testableSourceCode = `${ sourceCode }\nexport const __test_encodeGraphOrder = encodeGraphOrder\n`
const transformedCode = babel.transformSync(testableSourceCode, {
  presets: [['@babel/preset-env', { modules: 'commonjs' }]],
  sourceType: 'module',
}).code

const moduleObject = { exports: {} }
new Function('module', 'exports', transformedCode)(moduleObject, moduleObject.exports)
const { parseGraph6, encodeGraph6, __test_encodeGraphOrder } = moduleObject.exports

const decodeGraph6Values = graph6 => graph6.split('').map(char => char.charCodeAt(0) - 63)
const buildCirculantGraph = (order, steps) => {
  const matrix = [...Array(order)].map(() => Array(order).fill(0))
  for (let i = 0; i < order; i += 1) {
    for (const step of steps) {
      const j = (i + step) % order
      matrix[i][j] = 1
      matrix[j][i] = 1
    }
  }
  return matrix
}

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

// regression: graph6 bit ordering must match Sage/standard graph6
const circulant16Steps138Graph6 = 'OlSggUDOhAaDAD`AgOlAD'
const circulant16Steps138 = buildCirculantGraph(16, [1, 3, 8])
assert.deepStrictEqual(parseGraph6(circulant16Steps138Graph6), circulant16Steps138)
assert.strictEqual(encodeGraph6(circulant16Steps138), circulant16Steps138Graph6)

// order encoding boundaries around single-byte and extended encoding
for (const order of [62, 63]) {
  const matrix = [...Array(order)].map(() => Array(order).fill(0))
  assert.strictEqual(parseGraph6(encodeGraph6(matrix)).length, order)
}

// order encoding boundaries around 4-chunk and 6-chunk order forms
assert.deepStrictEqual(decodeGraph6Values(__test_encodeGraphOrder(258047)), [63, 62, 63, 63])
assert.deepStrictEqual(decodeGraph6Values(__test_encodeGraphOrder(258048)), [63, 63, 0, 0, 0, 63, 0, 0])

for (const order of [258047, 258048]) {
  const expectedDataLength = Math.ceil(order * (order - 1) / 12)
  assert.throws(
    () => parseGraph6(__test_encodeGraphOrder(order)),
    new RegExp(`expected ${ expectedDataLength } characters, received 0`)
  )
}

// regression: values above 2^31 must not use signed 32-bit shifts
assert.deepStrictEqual(decodeGraph6Values(__test_encodeGraphOrder(2147483648)), [63, 63, 2, 0, 0, 0, 0, 0])

console.log('graph6 parser tests passed')
