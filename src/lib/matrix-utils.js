/**
 * Returns true if `matrix` is an array of arrays, every row has the same
 * length as the number of rows (i.e. it is n x n), and every entry is
 * exactly 0 or 1. This is the shape the loop-analysis API requires (see
 * normalizeAdjacencyMatrix in src/lib/api.js) and does *not* additionally
 * require symmetry or a zero diagonal, so an already-square/binary matrix
 * that happens to be asymmetric or have self-loops is still "valid" here and
 * is left untouched by sanitizeAdjacencyMatrix below; only shape-invalid
 * (ragged/non-square/non-binary) matrices get repaired.
 *
 * @param {*} matrix - value to check
 * @returns {boolean}
 */
export const isValidAdjacencyMatrix = matrix => {
  if (!Array.isArray(matrix)) return false
  const n = matrix.length
  return matrix.every(row =>
    Array.isArray(row) && row.length === n && row.every(value => value === 0 || value === 1),
  )
}

/**
 * Repairs a possibly-malformed adjacency matrix (ragged rows, wrong
 * dimensions, non-binary/non-symmetric entries) into the nearest valid n x n
 * symmetric binary adjacency matrix, where n is the number of rows in the
 * input. Missing/invalid entries are treated as 0 (no edge); an edge is kept
 * if either [i][j] or [j][i] indicated one, so a single corrupted cell can't
 * silently drop an otherwise-intact edge. Self-loops are cleared, since
 * adjacency matrices in this app never represent them. Returns the original
 * matrix unchanged (same reference) when it is already valid, so callers can
 * cheaply detect whether a repair happened.
 *
 * This is deliberately a *repair*, not a reset-to-empty, so that transient
 * corruption (e.g. an old/buggy build persisting a jagged matrix to
 * localStorage) doesn't silently discard a user's graph.
 *
 * @param {*} matrix - candidate adjacency matrix (any shape)
 * @returns {number[][]} valid n x n symmetric binary adjacency matrix
 */
export const sanitizeAdjacencyMatrix = matrix => {
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

/**
 * Returns a new matrix with one additional row and column of zeros appended,
 * representing an isolated new node.
 *
 * @param {number[][]} matrix - square symmetric adjacency matrix
 * @returns {number[][]} new matrix of size (n+1) x (n+1)
 */
export const addNodeToMatrix = matrix => {
  const safeMatrix = sanitizeAdjacencyMatrix(matrix)
  const n = safeMatrix.length
  const newMatrix = safeMatrix.map(row => [...row, 0])
  newMatrix.push(Array(n + 1).fill(0))
  return newMatrix
}

/**
 * Returns a new matrix with an undirected edge added between src and tgt.
 * Has no effect if the edge already exists, if src === tgt, or if either
 * index is out of bounds.
 *
 * @param {number[][]} matrix - square symmetric adjacency matrix
 * @param {number} src - source node index
 * @param {number} tgt - target node index
 * @returns {number[][]} new matrix
 */
export const addEdgeToMatrix = (matrix, src, tgt) => {
  const safeMatrix = sanitizeAdjacencyMatrix(matrix)
  const newMatrix = safeMatrix.map(row => [...row])
  if (src === tgt || !newMatrix[src] || !newMatrix[tgt]) return newMatrix
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
  const safeMatrix = sanitizeAdjacencyMatrix(matrix)
  return safeMatrix
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
