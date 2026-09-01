const assert = require('assert')
const fs = require('fs')
const path = require('path')
const babel = require('@babel/core')

const sourcePath = path.resolve(__dirname, './api.js')
const sourceCode = fs.readFileSync(sourcePath, 'utf8')
const transformedCode = babel.transformSync(sourceCode, {
  presets: [['@babel/preset-env', { modules: 'commonjs', targets: { node: 'current' } }]],
  sourceType: 'module',
}).code

const moduleObject = { exports: {} }
new Function('module', 'exports', transformedCode)(moduleObject, moduleObject.exports)
const {
  checkBackendAvailable,
  computeLoopedForcing,
  computeMaximumLoopedForcing,
  computeLoopForts,
  computeLoopBlockingSets,
  ForcingApiError,
  isCancelledError,
} = moduleObject.exports

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
})

const withMockFetch = async (impl, fn) => {
  const original = global.fetch
  global.fetch = impl
  try {
    await fn()
  } finally {
    global.fetch = original
  }
}

const PATH_GRAPH = [
  [0, 1, 0],
  [1, 0, 1],
  [0, 1, 0],
]

async function main() {
  await withMockFetch(async () => jsonResponse({ ok: true, operations: ['looped'] }), async () => {
    const available = await checkBackendAvailable()
    assert.strictEqual(available, true)
  })

  await withMockFetch(async () => { throw new TypeError('network error') }, async () => {
    const available = await checkBackendAvailable()
    assert.strictEqual(available, false)
  })

  await withMockFetch(async (url, options) => {
    assert.ok(url.endsWith('/api/forcing/looped'))
    const body = JSON.parse(options.body)
    assert.deepStrictEqual(body.adjacencyMatrix, PATH_GRAPH)
    assert.deepStrictEqual(body.loopedVertices, [0, 2])
    return jsonResponse({ result: { number: 1, loopedVertices: [0, 2], sets: [[0]] } })
  }, async () => {
    const response = await computeLoopedForcing({ adjacencyMatrix: PATH_GRAPH, loopedVertices: new Set([2, 0]) })
    assert.strictEqual(response.result.number, 1)
  })

  await withMockFetch(async () => jsonResponse({ result: { number: 2, configurations: [] } }), async () => {
    const response = await computeMaximumLoopedForcing({ adjacencyMatrix: PATH_GRAPH })
    assert.strictEqual(response.result.number, 2)
  })

  await withMockFetch(async () => jsonResponse({ result: { forts: [], minimalForts: [] } }), async () => {
    const response = await computeLoopForts({ adjacencyMatrix: PATH_GRAPH, loopedVertices: [] })
    assert.deepStrictEqual(response.result.forts, [])
  })

  await withMockFetch(async () => jsonResponse({ result: { number: 3, sets: [] } }), async () => {
    const response = await computeLoopBlockingSets({ adjacencyMatrix: PATH_GRAPH, loopedVertices: [] })
    assert.strictEqual(response.result.number, 3)
  })

  await withMockFetch(async () => jsonResponse({ error: 'boom' }, { ok: false, status: 422 }), async () => {
    await assert.rejects(
      () => computeLoopedForcing({ adjacencyMatrix: PATH_GRAPH, loopedVertices: [] }),
      error => error instanceof ForcingApiError && error.status === 422 && error.message === 'boom',
    )
  })

  await withMockFetch(async () => {
    const error = new Error('aborted')
    error.name = 'AbortError'
    throw error
  }, async () => {
    await assert.rejects(
      () => computeLoopedForcing({ adjacencyMatrix: PATH_GRAPH, loopedVertices: [] }),
      error => isCancelledError(error),
    )
  })

  console.log('api.test.js: all tests passed')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
