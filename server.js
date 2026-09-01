/**
 * server.js - lightweight Express backend that wraps the enhanced-zf Python
 * library (vendored under ./python) to expose looped zero forcing, maximum
 * looped zero forcing, loop forts, and loop blocking sets over a small JSON
 * API consumed by the frontend (see src/lib/api.js).
 *
 * Run in development with `npm run server` (defaults to PORT=5051, override
 * with the PORT or FORCING_API_PORT environment variable).
 */

const path = require('path')
const { spawn } = require('child_process')
const express = require('express')

// Brute-force algorithms below are exponential in the number of vertices;
// this keeps requests from hanging the server indefinitely.
const MAX_VERTICES = 20
const PYTHON_EXECUTABLE = process.env.FORCING_PYTHON_EXECUTABLE || 'python3'
const CLI_PATH = path.join(__dirname, 'python', 'cli.py')

const OPERATIONS = new Set(['looped', 'maximum-looped', 'forts', 'blocking-sets'])

const isSquareBinaryMatrix = matrix => (
  Array.isArray(matrix) &&
  matrix.every(row => (
    Array.isArray(row) &&
    row.length === matrix.length &&
    row.every(value => value === 0 || value === 1)
  ))
)

const isSymmetric = matrix => matrix.every((row, i) => row.every((value, j) => value === matrix[j][i]))

const validateRequestBody = body => {
  const { adjacencyMatrix, loopedVertices } = body || {}

  if (!isSquareBinaryMatrix(adjacencyMatrix)) {
    return 'adjacencyMatrix must be a square matrix of 0s and 1s.'
  }

  if (!isSymmetric(adjacencyMatrix)) {
    return 'adjacencyMatrix must be symmetric.'
  }

  if (adjacencyMatrix.length > MAX_VERTICES) {
    return `adjacencyMatrix must have at most ${ MAX_VERTICES } vertices for these computations.`
  }

  if (loopedVertices !== undefined) {
    if (!Array.isArray(loopedVertices)) {
      return 'loopedVertices must be an array of vertex indices.'
    }
    const n = adjacencyMatrix.length
    if (!loopedVertices.every(v => Number.isInteger(v) && v >= 0 && v < n)) {
      return 'loopedVertices must contain valid vertex indices for the given graph.'
    }
  }

  return null
}

const runPythonCli = (op, adjacencyMatrix, loopedVertices) => new Promise((resolve, reject) => {
  const child = spawn(PYTHON_EXECUTABLE, [CLI_PATH])
  let stdout = ''
  let stderr = ''

  child.stdout.on('data', chunk => { stdout += chunk })
  child.stderr.on('data', chunk => { stderr += chunk })

  child.on('error', error => reject(error))

  child.on('close', code => {
    if (code !== 0 && !stdout) {
      reject(new Error(stderr || `python process exited with code ${ code }`))
      return
    }
    try {
      resolve(JSON.parse(stdout))
    } catch (error) {
      reject(new Error(`Unable to parse python output: ${ error.message }`))
    }
  })

  child.stdin.write(JSON.stringify({ op, adjacencyMatrix, loopedVertices: loopedVertices || [] }))
  child.stdin.end()
})

const createForcingHandler = op => async (req, res) => {
  const validationError = validateRequestBody(req.body)
  if (validationError) {
    res.status(400).json({ error: validationError })
    return
  }

  const { adjacencyMatrix, loopedVertices } = req.body
  const startedAt = Date.now()

  try {
    const output = await runPythonCli(op, adjacencyMatrix, loopedVertices)
    const elapsedMs = Date.now() - startedAt

    if (!output.ok) {
      res.status(422).json({ error: output.error || 'Computation failed.', meta: { elapsedMs } })
      return
    }

    res.json({ result: output.result, meta: { elapsedMs, vertexCount: adjacencyMatrix.length } })
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to run the enhanced zero forcing backend.' })
  }
}

const createApp = () => {
  const app = express()
  app.use(express.json({ limit: '1mb' }))

  app.get('/api/forcing/health', (req, res) => {
    res.json({ ok: true, operations: [...OPERATIONS] })
  })

  app.post('/api/forcing/looped', createForcingHandler('looped'))
  app.post('/api/forcing/maximum-looped', createForcingHandler('maximum-looped'))
  app.post('/api/forcing/forts', createForcingHandler('forts'))
  app.post('/api/forcing/blocking-sets', createForcingHandler('blocking-sets'))

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    res.status(500).json({ error: error.message || 'Unexpected server error.' })
  })

  return app
}

if (require.main === module) {
  const port = process.env.PORT || process.env.FORCING_API_PORT || 5051
  const app = createApp()
  app.listen(port, () => {
    console.log(`Enhanced zero forcing API listening on port ${ port }`)
  })
}

module.exports = { createApp, validateRequestBody, isSquareBinaryMatrix, isSymmetric }
