const assert = require('assert')

// Inline implementations so this file can run without a build step.
// Keep in sync with src/lib/matrix-utils.js.

const addNodeToMatrix = matrix => {
  const n = matrix.length
  const newMatrix = matrix.map(row => [...row, 0])
  newMatrix.push(Array(n + 1).fill(0))
  return newMatrix
}

const addEdgeToMatrix = (matrix, src, tgt) => {
  if (src === tgt) return matrix.map(row => [...row])
  const newMatrix = matrix.map(row => [...row])
  newMatrix[src][tgt] = 1
  newMatrix[tgt][src] = 1
  return newMatrix
}

const removeNodeFromMatrix = (matrix, nodeIndex) => {
  return matrix
    .filter((_, i) => i !== nodeIndex)
    .map(row => row.filter((_, j) => j !== nodeIndex))
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

console.log('matrix-utils tests passed')
