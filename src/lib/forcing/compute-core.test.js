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

const core = loadModule('./compute-core.js')

// Path graph on 3 vertices: 0 - 1 - 2
const PATH_3 = [
  [0, 1, 0],
  [1, 0, 1],
  [0, 1, 0],
]

// 4-cycle: 0 - 1 - 2 - 3 - 0
const CYCLE_4 = [
  [0, 1, 0, 1],
  [1, 0, 1, 0],
  [0, 1, 0, 1],
  [1, 0, 1, 0],
]

async function main() {
  // --- looped forcing: parity with `python3 python/cli.py` for P3, no loops ---
  {
    const result = await core.runLoopedForcingCompute({ adjacencyMatrix: PATH_3, loopedVertices: [] })
    assert.deepStrictEqual(result, { loopedVertices: [], number: 1, sets: [[0], [2]] })
  }

  // --- looped forcing: P3 with a loop at vertex 1 (matches python reference output) ---
  {
    const result = await core.runLoopedForcingCompute({ adjacencyMatrix: PATH_3, loopedVertices: [1] })
    assert.deepStrictEqual(result, { loopedVertices: [1], number: 1, sets: [[0], [2]] })
  }

  // --- maximum looped forcing number: P3 (matches python reference output) ---
  {
    const result = await core.runMaximumLoopedForcingCompute({ adjacencyMatrix: PATH_3 })
    assert.strictEqual(result.number, 1)
    assert.deepStrictEqual(result.configurations.map(cfg => cfg.loopedVertices), [[], [0, 1, 2], [0, 2], [1]])
  }

  // --- loop forts: P3 with a loop at vertex 1 (matches python reference output) ---
  {
    const result = await core.runLoopFortsCompute({ adjacencyMatrix: PATH_3, loopedVertices: [1] })
    assert.deepStrictEqual(result, { loopedVertices: [1], forts: [[0, 2]], minimalForts: [[0, 2]] })
  }

  // --- loop blocking sets: P3 with a loop at vertex 1 has no valid blocking set at all,
  // matching the python library's (n, []) sentinel result. ---
  {
    const result = await core.runLoopBlockingSetsCompute({ adjacencyMatrix: PATH_3, loopedVertices: [1] })
    assert.deepStrictEqual(result, { loopedVertices: [1], number: 3, sets: [] })
  }

  // --- 4-cycle looped forcing, no loops (matches python reference output) ---
  {
    const result = await core.runLoopedForcingCompute({ adjacencyMatrix: CYCLE_4, loopedVertices: [] })
    assert.strictEqual(result.number, 2)
    assert.deepStrictEqual(result.sets, [[0, 1], [0, 3], [1, 2], [2, 3]])
  }

  // --- 4-cycle maximum looped forcing (matches python reference output) ---
  {
    const result = await core.runMaximumLoopedForcingCompute({ adjacencyMatrix: CYCLE_4 })
    assert.strictEqual(result.number, 2)
    assert.deepStrictEqual(result.configurations.map(cfg => cfg.loopedVertices), [[], [0, 1, 2, 3], [0, 2], [1, 3]])
  }

  // --- 4-cycle loop forts/blocking sets with loops at {0,2} (matches python reference output) ---
  {
    const forts = await core.runLoopFortsCompute({ adjacencyMatrix: CYCLE_4, loopedVertices: [0, 2] })
    assert.deepStrictEqual(forts.forts, [[1, 3], [0, 1, 2], [0, 2, 3], [0, 1, 2, 3]])
    assert.deepStrictEqual(forts.minimalForts, [[1, 3], [0, 1, 2], [0, 2, 3]])

    const blocking = await core.runLoopBlockingSetsCompute({ adjacencyMatrix: CYCLE_4, loopedVertices: [0, 2] })
    assert.strictEqual(blocking.number, 3)
    assert.deepStrictEqual(blocking.sets, [[0, 1, 2], [0, 2, 3]])
  }

  // --- vertex limit is enforced defensively, mirroring MAX_LOOP_VERTICES/server.js ---
  {
    const oversized = Array.from({ length: core.MAX_LOOP_VERTICES + 1 }, (_, i) => (
      Array.from({ length: core.MAX_LOOP_VERTICES + 1 }, (_, j) => (i !== j && (j === i + 1 || i === j + 1) ? 1 : 0))
    ))
    await assert.rejects(
      () => core.runLoopedForcingCompute({ adjacencyMatrix: oversized, loopedVertices: [] }),
      error => error instanceof core.ComputeLimitError,
    )
  }

  // --- cancellation: a checkpoint that always reports cancelled should reject promptly ---
  {
    const checkpoint = core.createCheckpoint({ isCancelled: () => true, everyNSteps: 1 })
    await assert.rejects(
      () => core.runMaximumLoopedForcingCompute({ adjacencyMatrix: CYCLE_4, checkpoint }),
      error => error instanceof core.ComputeCancelledError,
    )
  }

  // --- timeout: an already-elapsed deadline should reject with ComputeTimeoutError ---
  {
    const checkpoint = core.createCheckpoint({ deadlineAt: Date.now() - 1, everyNSteps: 1 })
    await assert.rejects(
      () => core.runMaximumLoopedForcingCompute({ adjacencyMatrix: CYCLE_4, checkpoint }),
      error => error instanceof core.ComputeTimeoutError,
    )
  }

  // --- unknown operation dispatch ---
  assert.throws(() => core.runForcingCompute('not-a-real-op', {}), /Unknown forcing computation/)

  console.log('compute-core.test.js: all tests passed')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
