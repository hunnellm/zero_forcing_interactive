const assert = require('assert')

// Inline implementations so this file can run without a build step.
// Keep in sync with src/lib/matrix-utils.js.

const isValidAdjacencyMatrix = matrix => {
  if (!Array.isArray(matrix)) return false
  const n = matrix.length
  return matrix.every(row =>
    Array.isArray(row) && row.length === n && row.every(value => value === 0 || value === 1),
  )
}

const sanitizeAdjacencyMatrix = matrix => {
  if (isValidAdjacencyMatrix(matrix)) return matrix
  if (!Array.isArray(matrix)) return []

  const n = matrix.length
  const repaired = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => {
    const row = matrix[i]
    const value = Array.isArray(row) ? row[j] : undefined
    return value === 1 || value === true ? 1 : 0
  }))

  for (let i = 0; i < n; i += 1) {
    repaired[i][i] = 0
    for (let j = i + 1; j < n; j += 1) {
      const connected = repaired[i][j] === 1 || repaired[j][i] === 1 ? 1 : 0
      repaired[i][j] = connected
      repaired[j][i] = connected
    }
  }
  return repaired
}

const addNodeToMatrix = matrix => {
  const safeMatrix = sanitizeAdjacencyMatrix(matrix)
  const n = safeMatrix.length
  const newMatrix = safeMatrix.map(row => [...row, 0])
  newMatrix.push(Array(n + 1).fill(0))
  return newMatrix
}

const addEdgeToMatrix = (matrix, src, tgt) => {
  const safeMatrix = sanitizeAdjacencyMatrix(matrix)
  const newMatrix = safeMatrix.map(row => [...row])
  if (src === tgt || !newMatrix[src] || !newMatrix[tgt]) return newMatrix
  newMatrix[src][tgt] = 1
  newMatrix[tgt][src] = 1
  return newMatrix
}

const removeNodeFromMatrix = (matrix, nodeIndex) => {
  const safeMatrix = sanitizeAdjacencyMatrix(matrix)
  return safeMatrix
    .filter((_, i) => i !== nodeIndex)
    .map(row => row.filter((_, j) => j !== nodeIndex))
}

const buildEdgeListFromMatrix = adjacencyMatrix => {
  const edges = []
  adjacencyMatrix.data.forEach((row, i) => {
    for (let j = 0; j < i; j += 1) {
      if (row[j] === 1) edges.push({ source: i, target: j })
    }
  })
  return edges
}

// addNodeToMatrix tests

const singleNode = addNodeToMatrix([[0]])
assert.deepStrictEqual(singleNode, [
  [0, 0],
  [0, 0],
])

const edgeThenAdd = addNodeToMatrix([[0, 1], [1, 0]])
assert.deepStrictEqual(edgeThenAdd, [
  [0, 1, 0],
  [1, 0, 0],
  [0, 0, 0],
])

// Original matrix must not be mutated
const original = [[0, 1], [1, 0]]
addNodeToMatrix(original)
assert.deepStrictEqual(original, [[0, 1], [1, 0]], 'addNodeToMatrix must not mutate input')

// addEdgeToMatrix tests

const emptyTwo = [[0, 0], [0, 0]]
const withEdge = addEdgeToMatrix(emptyTwo, 0, 1)
assert.deepStrictEqual(withEdge, [[0, 1], [1, 0]])

// Self-loop should be ignored
const noSelfLoop = addEdgeToMatrix(emptyTwo, 1, 1)
assert.deepStrictEqual(noSelfLoop, [[0, 0], [0, 0]])

// Adding an existing edge should be idempotent
const alreadyEdge = [[0, 1], [1, 0]]
const again = addEdgeToMatrix(alreadyEdge, 0, 1)
assert.deepStrictEqual(again, [[0, 1], [1, 0]])

// Original matrix must not be mutated
addEdgeToMatrix(alreadyEdge, 0, 1)
assert.deepStrictEqual(alreadyEdge, [[0, 1], [1, 0]], 'addEdgeToMatrix must not mutate input')

// removeNodeFromMatrix tests

// Removing the only node gives an empty matrix
const removedOnly = removeNodeFromMatrix([[0]], 0)
assert.deepStrictEqual(removedOnly, [])

// Removing the middle node of a 3-node path graph disconnects the remaining two
const pathThree = [[0, 1, 0], [1, 0, 1], [0, 1, 0]]
const removedMiddle = removeNodeFromMatrix(pathThree, 1)
assert.deepStrictEqual(removedMiddle, [[0, 0], [0, 0]])

// Removing the first node of a 3-node path preserves the remaining edge
const removedFirst = removeNodeFromMatrix(pathThree, 0)
assert.deepStrictEqual(removedFirst, [[0, 1], [1, 0]])

// Removing the last node of a 3-node path preserves the remaining edge
const removedLast = removeNodeFromMatrix(pathThree, 2)
assert.deepStrictEqual(removedLast, [[0, 1], [1, 0]])

// Original matrix must not be mutated
const origRemove = [[0, 1], [1, 0]]
removeNodeFromMatrix(origRemove, 0)
assert.deepStrictEqual(origRemove, [[0, 1], [1, 0]], 'removeNodeFromMatrix must not mutate input')

// buildEdgeListFromMatrix tests

// No edges -> empty list
assert.deepStrictEqual(buildEdgeListFromMatrix({ data: [[0, 0], [0, 0]] }), [])

// Each undirected edge is emitted exactly once (lower triangle only)
const triangleMatrix = { data: [
  [0, 1, 1],
  [1, 0, 1],
  [1, 1, 0],
] }
assert.deepStrictEqual(buildEdgeListFromMatrix(triangleMatrix), [
  { source: 1, target: 0 },
  { source: 2, target: 0 },
  { source: 2, target: 1 },
])

// The same adjacency matrix always yields the same edge list -- this is the
// invariant that lets both the initial layout pass and manual redraw feed
// computeInitialLayout with an identical edge set for identical graphs.
const rebuilt = buildEdgeListFromMatrix(triangleMatrix)
assert.deepStrictEqual(rebuilt, buildEdgeListFromMatrix(triangleMatrix))

// isValidAdjacencyMatrix tests

assert.strictEqual(isValidAdjacencyMatrix([[0, 1], [1, 0]]), true)
assert.strictEqual(isValidAdjacencyMatrix([]), true)
assert.strictEqual(isValidAdjacencyMatrix(null), false)
assert.strictEqual(isValidAdjacencyMatrix('not a matrix'), false)
assert.strictEqual(isValidAdjacencyMatrix([[0, 1], [1]]), false, 'ragged rows are invalid')
assert.strictEqual(isValidAdjacencyMatrix([[0, 1, 0], [1, 0, 0]]), false, 'non-square is invalid')
assert.strictEqual(isValidAdjacencyMatrix([[0, 2], [2, 0]]), false, 'non-binary entries are invalid')

// sanitizeAdjacencyMatrix tests

// Already-valid matrices are returned unchanged (same reference)
const alreadyValid = [[0, 1], [1, 0]]
assert.strictEqual(sanitizeAdjacencyMatrix(alreadyValid), alreadyValid)

// Non-array input resets to an empty graph
assert.deepStrictEqual(sanitizeAdjacencyMatrix(null), [])
assert.deepStrictEqual(sanitizeAdjacencyMatrix(undefined), [])
assert.deepStrictEqual(sanitizeAdjacencyMatrix('garbage'), [])

// Ragged rows are repaired to n x n (n = number of rows), missing entries default to 0
assert.deepStrictEqual(sanitizeAdjacencyMatrix([[0, 1, 0], [1, 0], [0]]), [
  [0, 1, 0],
  [1, 0, 0],
  [0, 0, 0],
])

// Rows longer than n are truncated to n x n
assert.deepStrictEqual(sanitizeAdjacencyMatrix([[0, 1, 0, 9], [1, 0]]), [
  [0, 1],
  [1, 0],
])

// Asymmetric entries recovered during a ragged-row repair are OR-ed across
// the diagonal, so a one-sided edge caused by corruption survives instead of
// being silently dropped (an already-square/binary-but-asymmetric matrix is
// considered valid shape-wise and is left untouched by sanitize, matching
// what the loop-analysis API itself validates -- see normalizeAdjacencyMatrix
// in src/lib/api.js).
assert.deepStrictEqual(sanitizeAdjacencyMatrix([[0, 1], []]), [
  [0, 1],
  [1, 0],
])

// Self-loops recovered during a repair are cleared, since this app's
// adjacency matrices never represent them (an already-square/binary matrix
// with 1s on the diagonal is left untouched by sanitize, matching what the
// API validates)
assert.deepStrictEqual(sanitizeAdjacencyMatrix([[1, 1], [1]]), [
  [0, 1],
  [1, 0],
])

// Non-binary/truthy entries are coerced to 0/1
assert.deepStrictEqual(sanitizeAdjacencyMatrix([[0, 'x'], [true, 0]]), [
  [0, 1],
  [1, 0],
])

// Simulates a malformed value loaded from localStorage on app startup:
// non-square/ragged data must repair into something the loop-analysis API
// (src/lib/api.js normalizeAdjacencyMatrix) will accept.
const malformedFromStorage = [[0, 1, 1], [1, 0], [1]]
const repairedFromStorage = sanitizeAdjacencyMatrix(malformedFromStorage)
assert.strictEqual(isValidAdjacencyMatrix(repairedFromStorage), true)
assert.deepStrictEqual(repairedFromStorage, [
  [0, 1, 1],
  [1, 0, 0],
  [1, 0, 0],
])

// addNodeToMatrix, addEdgeToMatrix, and removeNodeFromMatrix all preserve the
// square-shape invariant even when handed a malformed matrix (e.g. because
// upstream state briefly went ragged, or malformed data slipped through)
assert.strictEqual(isValidAdjacencyMatrix(addNodeToMatrix([[0, 1], [1]])), true)
assert.strictEqual(isValidAdjacencyMatrix(addEdgeToMatrix([[0, 1], [1]], 0, 1)), true)
assert.strictEqual(isValidAdjacencyMatrix(removeNodeFromMatrix([[0, 1, 0], [1], [0, 0]], 0)), true)

// addEdgeToMatrix ignores out-of-bounds indices instead of throwing
assert.deepStrictEqual(addEdgeToMatrix([[0, 1], [1, 0]], 0, 5), [[0, 1], [1, 0]])

console.log('matrix-utils tests passed')
