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
  registerForcingWorkerFactory,
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

// Minimal stand-in for the real forcing Web Worker (see
// src/workers/forcing.worker.js): a fake message-based transport so
// worker-first behavior can be exercised without a real Worker/DOM.
class FakeWorker {
  constructor(respond) {
    this.respond = respond
    this.listeners = {}
    this.terminated = false
  }

  addEventListener(type, handler) {
    this.listeners[type] = this.listeners[type] || []
    this.listeners[type].push(handler)
  }

  removeEventListener(type, handler) {
    this.listeners[type] = (this.listeners[type] || []).filter(fn => fn !== handler)
  }

  emit(type, event) {
    for (const handler of (this.listeners[type] || [])) handler(event)
  }

  postMessage(message) {
    this.respond(message, this)
  }

  terminate() {
    this.terminated = true
  }
}

const withNoFetchCalls = async fn => {
  const original = global.fetch
  global.fetch = () => { throw new Error('fetch should not have been called') }
  try {
    await fn()
  } finally {
    global.fetch = original
  }
}

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

  // --- worker-first: a registered worker factory is used instead of the backend ---
  await withNoFetchCalls(async () => {
    registerForcingWorkerFactory(() => new FakeWorker((message, worker) => {
      setTimeout(() => worker.emit('message', {
        data: { id: message.id, ok: true, result: { loopedVertices: [], number: 1, sets: [[0]] } },
      }), 0)
    }))

    const response = await computeLoopedForcing({ adjacencyMatrix: PATH_GRAPH, loopedVertices: [] })
    assert.strictEqual(response.result.number, 1)
    assert.strictEqual(response.meta.source, 'worker')
  })

  // --- worker unavailable (factory throws): falls back to the backend ---
  await withMockFetch(async () => jsonResponse({ result: { number: 7, loopedVertices: [], sets: [] } }), async () => {
    registerForcingWorkerFactory(() => { throw new Error('Worker is not supported in this environment.') })

    const response = await computeLoopedForcing({ adjacencyMatrix: PATH_GRAPH, loopedVertices: [] })
    assert.strictEqual(response.result.number, 7)
  })

  // --- worker reports a computation failure: falls back to the backend ---
  await withMockFetch(async () => jsonResponse({ result: { number: 8, loopedVertices: [], sets: [] } }), async () => {
    registerForcingWorkerFactory(() => new FakeWorker((message, worker) => {
      setTimeout(() => worker.emit('message', {
        data: { id: message.id, ok: false, error: { code: 'error', message: 'computation blew up' } },
      }), 0)
    }))

    const response = await computeLoopedForcing({ adjacencyMatrix: PATH_GRAPH, loopedVertices: [] })
    assert.strictEqual(response.result.number, 8)
  })

  // --- cancelling while the worker is in flight rejects with an AbortError and
  // never falls back to the backend (matches existing cancel-semantics) ---
  await withNoFetchCalls(async () => {
    let cancelMessage = null
    registerForcingWorkerFactory(() => new FakeWorker((message, worker) => {
      if (message.type === 'cancel') {
        cancelMessage = message
        return
      }
      // Never resolves on its own; only the abort path should settle this.
      void worker
    }))

    const controller = new AbortController()
    const pending = computeLoopedForcing({
      adjacencyMatrix: PATH_GRAPH, loopedVertices: [], signal: controller.signal,
    })
    controller.abort()

    await assert.rejects(() => pending, error => isCancelledError(error))
    assert.ok(cancelMessage, 'aborting should notify the worker so it can stop cooperatively')
  })

  // --- REACT_APP_FORCE_BACKEND=true always uses the backend, even with a
  // working worker factory registered ---
  await withMockFetch(async () => jsonResponse({ result: { number: 9, loopedVertices: [], sets: [] } }), async () => {
    process.env.REACT_APP_FORCE_BACKEND = 'true'
    registerForcingWorkerFactory(() => new FakeWorker((message, worker) => {
      setTimeout(() => worker.emit('message', {
        data: { id: message.id, ok: true, result: { number: -1, loopedVertices: [], sets: [] } },
      }), 0)
    }))

    try {
      const response = await computeLoopedForcing({ adjacencyMatrix: PATH_GRAPH, loopedVertices: [] })
      assert.strictEqual(response.result.number, 9)
    } finally {
      delete process.env.REACT_APP_FORCE_BACKEND
    }
  })

  // --- invalid adjacency matrix: rejects before any transport call ---
  await withNoFetchCalls(async () => {
    registerForcingWorkerFactory(null)
    await assert.rejects(
      () => computeLoopedForcing({ adjacencyMatrix: null, loopedVertices: [] }),
      error => error instanceof ForcingApiError && /must be an array/.test(error.message),
    )
    await assert.rejects(
      () => computeLoopedForcing({ adjacencyMatrix: [[0, 1], [1, 0, 0]], loopedVertices: [] }),
      error => error instanceof ForcingApiError && /square/.test(error.message),
    )
  })

  // --- worker failure + backend fallback failure: combined error with both causes ---
  await withMockFetch(async () => jsonResponse({ error: 'backend down' }, { ok: false, status: 503 }), async () => {
    registerForcingWorkerFactory(() => new FakeWorker((message, worker) => {
      setTimeout(() => worker.emit('message', {
        data: { id: message.id, ok: false, error: { code: 'protocol', message: 'unknown op' } },
      }), 0)
    }))

    await assert.rejects(
      () => computeLoopedForcing({ adjacencyMatrix: PATH_GRAPH, loopedVertices: [] }),
      error => (
        error instanceof ForcingApiError
        && error.message === 'In-browser computation failed and backend fallback is unavailable.'
        && error.cause?.workerError?.message === 'unknown op'
        && error.cause?.backendError?.message === 'backend down'
      ),
    )
  })

  registerForcingWorkerFactory(null)

  console.log('api.test.js: all tests passed')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
