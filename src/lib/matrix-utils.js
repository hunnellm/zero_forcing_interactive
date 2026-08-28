/**
 * Returns a new matrix with one additional row and column of zeros appended,
 * representing an isolated new node.
 *
 * @param {number[][]} matrix - square symmetric adjacency matrix
 * @returns {number[][]} new matrix of size (n+1) x (n+1)
 */
export const addNodeToMatrix = matrix => {
  const n = matrix.length
  const newMatrix = matrix.map(row => [...row, 0])
  newMatrix.push(Array(n + 1).fill(0))
  return newMatrix
}

/**
 * Returns a new matrix with an undirected edge added between src and tgt.
 * Has no effect if the edge already exists or if src === tgt.
 *
 * @param {number[][]} matrix - square symmetric adjacency matrix
 * @param {number} src - source node index
 * @param {number} tgt - target node index
 * @returns {number[][]} new matrix
 */
export const addEdgeToMatrix = (matrix, src, tgt) => {
  if (src === tgt) return matrix.map(row => [...row])
  const newMatrix = matrix.map(row => [...row])
  newMatrix[src][tgt] = 1
  newMatrix[tgt][src] = 1
  return newMatrix
}

/**
 * Returns a new matrix with the node at nodeIndex removed.
 * The node's row and column are deleted; remaining indices shift down.
 *
 * @param {number[][]} matrix - square symmetric adjacency matrix
 * @param {number} nodeIndex - index of the node to remove
 * @returns {number[][]} new matrix of size (n-1) x (n-1)
 */
export const removeNodeFromMatrix = (matrix, nodeIndex) => {
  return matrix
    .filter((_, i) => i !== nodeIndex)
    .map(row => row.filter((_, j) => j !== nodeIndex))
}

/**
 * Builds a plain { source, target } edge list from an adjacency matrix's
 * underlying 2D data array. Each undirected edge is emitted exactly once
 * (only the lower triangle is scanned). This is the single source of truth
 * used both for the initial graph layout and for any later redraw, so both
 * see the exact same edge set.
 *
 * @param {{data: number[][]}} adjacencyMatrix - ml-matrix Matrix instance (or matrix-like object with a `.data` 2D array)
 * @returns {Array<{source: number, target: number}>}
 */
export const buildEdgeListFromMatrix = adjacencyMatrix => {
  const edges = []
  adjacencyMatrix.data.forEach((row, i) => {
    for (let j = 0; j < i; j += 1) {
      if (row[j] === 1) edges.push({ source: i, target: j })
    }
  })
  return edges
}
