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
    presets: [['@babel/preset-env', { modules: 'commonjs', targets: { node: 'current' } }]],
    babelrc: false,
    configFile: false,
    sourceType: 'module',
    filename: resolved,
  }).code

  const moduleObject = { exports: {} }
  moduleCache.set(resolved, moduleObject.exports)

  const localRequire = request => {
    if (!request.startsWith('.')) {
      return require(request)
    }

    const absoluteRequest = path.resolve(path.dirname(resolved), request)
    const requestPath = path.extname(request)
      ? request
      : (fs.existsSync(`${ absoluteRequest }.js`) ? `${ request }.js` : path.join(request, 'index.js'))
    return loadModule(path.relative(__dirname, path.resolve(path.dirname(resolved), requestPath)))
  }

  new Function('require', 'module', 'exports', transformedCode)(localRequire, moduleObject, moduleObject.exports)
  moduleCache.set(resolved, moduleObject.exports)
  return moduleObject.exports
}

// forcing.worker.js runs as a Web Worker, using the global `self` to receive
// messages and post responses. Mock just enough of that surface to drive the
// worker's message handler directly from this Node test.
const createMockSelf = () => {
  const listeners = {}
  const posted = []
  return {
    listeners,
    posted,
    addEventListener(type, handler) {
      listeners[type] = listeners[type] || []
      listeners[type].push(handler)
    },
    postMessage(message) {
      posted.push(message)
    },
    dispatch(data) {
      for (const handler of (listeners.message || [])) {
        handler({ data })
      }
    },
  }
}

const waitForResponse = (mockSelf, id) => new Promise((resolve, reject) => {
  const deadline = Date.now() + 5000
  const poll = () => {
    const response = mockSelf.posted.find(message => message.id === id)
    if (response) {
      resolve(response)
      return
    }
    if (Date.now() > deadline) {
      reject(new Error(`Timed out waiting for a response to request ${ id }`))
      return
    }
    setTimeout(poll, 5)
  }
  poll()
})

const PATH_3 = [
  [0, 1, 0],
  [1, 0, 1],
  [0, 1, 0],
]

async function main() {
  // --- happy path: { id, ok: true, result } for a supported operation ---
  {
    const mockSelf = createMockSelf()
    global.self = mockSelf
    loadModule('./forcing.worker.js')

    mockSelf.dispatch({ id: 'req-1', op: 'looped', payload: { adjacencyMatrix: PATH_3, loopedVertices: [] } })
    const response = await waitForResponse(mockSelf, 'req-1')

    assert.strictEqual(response.ok, true)
    assert.deepStrictEqual(response.result, { loopedVertices: [], number: 1, sets: [[0], [2]] })
  }

  // --- unknown operation reports a structured error rather than throwing ---
  {
    const mockSelf = createMockSelf()
    global.self = mockSelf
    moduleCache.delete(path.resolve(__dirname, './forcing.worker.js'))
    loadModule('./forcing.worker.js')

    mockSelf.dispatch({ id: 'req-2', op: 'not-a-real-op', payload: {} })
    const response = await waitForResponse(mockSelf, 'req-2')

    assert.strictEqual(response.ok, false)
    assert.strictEqual(response.error.code, 'error')
  }

  // --- cancellation: a 'cancel' message for an in-flight id yields a
  // { ok: false, error: { code: 'cancelled' } } response instead of a result ---
  {
    const mockSelf = createMockSelf()
    global.self = mockSelf
    moduleCache.delete(path.resolve(__dirname, './forcing.worker.js'))
    loadModule('./forcing.worker.js')

    // maximum-looped over an edgeless 6-vertex graph never lets any vertex
    // force (no neighbors to become "the" unique white one), so the search
    // must explore combos of every size for every loop configuration -
    // comfortably exceeding the worker's checkpoint cadence and making
    // cancellation/timeout observable well before completion.
    const noEdges6 = Array.from({ length: 6 }, () => new Array(6).fill(0))
    mockSelf.dispatch({ id: 'req-3', op: 'maximum-looped', payload: { adjacencyMatrix: noEdges6 } })
    mockSelf.dispatch({ id: 'req-3', type: 'cancel' })

    const response = await waitForResponse(mockSelf, 'req-3')
    assert.strictEqual(response.ok, false)
    assert.strictEqual(response.error.code, 'cancelled')
  }

  // --- timeout: an already-past timeoutMs yields a { code: 'timeout' } response ---
  {
    const mockSelf = createMockSelf()
    global.self = mockSelf
    moduleCache.delete(path.resolve(__dirname, './forcing.worker.js'))
    loadModule('./forcing.worker.js')

    mockSelf.dispatch({
      id: 'req-4',
      op: 'maximum-looped',
      payload: { adjacencyMatrix: Array.from({ length: 6 }, () => new Array(6).fill(0)) },
      timeoutMs: -1,
    })

    const response = await waitForResponse(mockSelf, 'req-4')
    assert.strictEqual(response.ok, false)
    assert.strictEqual(response.error.code, 'timeout')
  }

  delete global.self
  console.log('forcing.worker.test.js: all tests passed')
}

main().catch(error => {
  console.error(error)
  delete global.self
  process.exit(1)
})
