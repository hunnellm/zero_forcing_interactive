const assert = require('assert')
const { createApp, validateRequestBody, isSquareBinaryMatrix, isSymmetric } = require('./server')

const PATH_GRAPH_4 = [
  [0, 1, 0, 0],
  [1, 0, 1, 0],
  [0, 1, 0, 1],
  [0, 0, 1, 0],
]

const test = (name, fn) => {
  console.log(`server.test.js: ${ name }`)
  return Promise.resolve().then(fn)
}

const withServer = async fn => {
  const app = createApp()
  const server = app.listen(0)
  const { port } = server.address()
  try {
    await fn(`http://127.0.0.1:${ port }`)
  } finally {
    server.close()
  }
}

const postJson = async (baseUrl, path, body) => {
  const response = await fetch(`${ baseUrl }${ path }`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: await response.json() }
}

async function main() {
  await test('isSquareBinaryMatrix validates shape and entries', () => {
    assert.strictEqual(isSquareBinaryMatrix(PATH_GRAPH_4), true)
    assert.strictEqual(isSquareBinaryMatrix([[0, 1], [1]]), false)
    assert.strictEqual(isSquareBinaryMatrix([[0, 2], [2, 0]]), false)
    assert.strictEqual(isSquareBinaryMatrix('not-a-matrix'), false)
  })

  await test('isSymmetric detects asymmetric matrices', () => {
    assert.strictEqual(isSymmetric(PATH_GRAPH_4), true)
    assert.strictEqual(isSymmetric([[0, 1], [0, 0]]), false)
  })

  await test('validateRequestBody rejects invalid adjacency matrices', () => {
    assert.ok(validateRequestBody({ adjacencyMatrix: null }))
    assert.ok(validateRequestBody({ adjacencyMatrix: [[0, 1], [0, 0]] }))
    assert.strictEqual(validateRequestBody({ adjacencyMatrix: PATH_GRAPH_4, loopedVertices: [0, 1] }), null)
  })

  await test('validateRequestBody rejects out-of-range loop vertices', () => {
    assert.ok(validateRequestBody({ adjacencyMatrix: PATH_GRAPH_4, loopedVertices: [0, 10] }))
    assert.ok(validateRequestBody({ adjacencyMatrix: PATH_GRAPH_4, loopedVertices: ['a'] }))
  })

  await test('GET /api/forcing/health responds with ok', async () => {
    await withServer(async baseUrl => {
      const response = await fetch(`${ baseUrl }/api/forcing/health`)
      assert.strictEqual(response.status, 200)
      const body = await response.json()
      assert.strictEqual(body.ok, true)
    })
  })

  await test('POST /api/forcing/looped computes a looped zero forcing number', async () => {
    await withServer(async baseUrl => {
      const { status, body } = await postJson(baseUrl, '/api/forcing/looped', {
        adjacencyMatrix: PATH_GRAPH_4,
        loopedVertices: [0, 3],
      })
      assert.strictEqual(status, 200)
      assert.strictEqual(typeof body.result.number, 'number')
      assert.deepStrictEqual(body.result.loopedVertices, [0, 3])
      assert.ok(Array.isArray(body.result.sets))
    })
  })

  await test('POST /api/forcing/maximum-looped computes over all configurations', async () => {
    await withServer(async baseUrl => {
      const { status, body } = await postJson(baseUrl, '/api/forcing/maximum-looped', {
        adjacencyMatrix: PATH_GRAPH_4,
      })
      assert.strictEqual(status, 200)
      assert.strictEqual(typeof body.result.number, 'number')
      assert.ok(Array.isArray(body.result.configurations))
      assert.ok(body.result.configurations.length > 0)
    })
  })

  await test('POST /api/forcing/forts computes loop forts', async () => {
    await withServer(async baseUrl => {
      const { status, body } = await postJson(baseUrl, '/api/forcing/forts', {
        adjacencyMatrix: PATH_GRAPH_4,
        loopedVertices: [],
      })
      assert.strictEqual(status, 200)
      assert.ok(Array.isArray(body.result.forts))
      assert.ok(Array.isArray(body.result.minimalForts))
    })
  })

  await test('POST /api/forcing/blocking-sets computes loop blocking sets', async () => {
    await withServer(async baseUrl => {
      const { status, body } = await postJson(baseUrl, '/api/forcing/blocking-sets', {
        adjacencyMatrix: PATH_GRAPH_4,
        loopedVertices: [],
      })
      assert.strictEqual(status, 200)
      assert.strictEqual(typeof body.result.number, 'number')
      assert.ok(Array.isArray(body.result.sets))
    })
  })

  await test('POST /api/forcing/looped rejects invalid input with 400', async () => {
    await withServer(async baseUrl => {
      const { status, body } = await postJson(baseUrl, '/api/forcing/looped', {
        adjacencyMatrix: [[0, 1], [0, 0]],
      })
      assert.strictEqual(status, 400)
      assert.ok(body.error)
    })
  })

  console.log('server.test.js: all tests passed')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
