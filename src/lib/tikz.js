/**
 * TikZ export utility for zero-forcing graphs.
 *
 * Converts the current graph state (nodes with positions and colors, edges)
 * into a compilable TikZ picture string.
 */

/**
 * Escape characters that are special in LaTeX so node labels render safely.
 * Uses a single-pass replacement so introduced escape sequences are not
 * re-processed.
 * @param {string|number} label
 * @returns {string}
 */
export const escapeLatex = (label) => {
  const str = String(label)
  const map = {
    '\\': '\\textbackslash{}',
    '{': '\\{',
    '}': '\\}',
    '%': '\\%',
    '&': '\\&',
    '$': '\\$',
    '#': '\\#',
    '_': '\\_',
    '^': '\\^{}',
    '~': '\\textasciitilde{}',
  }
  return str.replace(/[\\{}%&$#_^~]/g, char => map[char])
}

/**
 * Parse a CSS hex color (3- or 6-digit) to { r, g, b } (0-255 each).
 * Returns null if the string is not a recognised hex color.
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }|null}
 */
export const hexToRgb = (hex) => {
  if (typeof hex !== 'string') return null
  const clean = hex.trim().replace(/^#/, '')
  if (clean.length === 3) {
    const [r, g, b] = clean.split('').map(c => parseInt(c + c, 16))
    return { r, g, b }
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16)
    const g = parseInt(clean.slice(2, 4), 16)
    const b = parseInt(clean.slice(4, 6), 16)
    return { r, g, b }
  }
  return null
}

/**
 * Convert a screen coordinate pair to TikZ coordinates.
 *
 * TikZ uses a right-handed coordinate system with y pointing upward, whereas
 * most browser/canvas systems have y pointing downward. The coordinates are
 * also scaled from pixel-space to cm-space so the output is a comfortable
 * size on paper.
 *
 * @param {number} x  – screen x in pixels
 * @param {number} y  – screen y in pixels
 * @param {number} [scale=0.05]  – pixels-per-cm divisor
 * @returns {{ x: number, y: number }}
 */
export const screenToTikz = (x, y, scale = 0.05) => ({
  x: +(x * scale).toFixed(3),
  y: +((-y) * scale).toFixed(3),
})

/**
 * Build a deterministic TikZ color name from a node id and hex color.
 * @param {number|string} nodeId
 * @returns {string}
 */
const colorName = (nodeId) => `nodecolor${nodeId}`

/**
 * Generate a complete TikZ picture string from graph data.
 *
 * @param {Array<{ id: number, x: number, y: number }>} nodes
 * @param {Array<{ source: number|{ id: number }, target: number|{ id: number } }>} edges
 * @param {Set<number>} coloredNodes  – set of node ids that are "colored"
 * @param {string} filledColor        – hex color applied to colored nodes (e.g. '#a14f92')
 * @param {number} [scale=0.05]
 * @returns {string}
 */
export const generateTikz = (nodes, edges, coloredNodes, filledColor, scale = 0.05) => {
  const sortedNodes = [...nodes].sort((a, b) => a.id - b.id)

  // Determine which unique colors are actually used
  const usedColors = new Set()
  const filledRgb = hexToRgb(filledColor)
  if (filledRgb) {
    sortedNodes.forEach(n => {
      if (coloredNodes.has(n.id)) usedColors.add(filledColor)
    })
  }

  // Build \definecolor lines (only for colors actually used)
  const colorDefs = []
  usedColors.forEach(hex => {
    const rgb = hexToRgb(hex)
    if (rgb) {
      const cleanHex = hex.replace(/^#/, '').toUpperCase()
      colorDefs.push(`\\definecolor{filledcolor}{HTML}{${cleanHex}}`)
    }
  })

  // Build node lines
  const nodeLines = sortedNodes.map(n => {
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) return null
    const { x, y } = screenToTikz(n.x, n.y, scale)
    const fill = coloredNodes.has(n.id) ? 'fill=filledcolor,' : 'fill=white,'
    const label = escapeLatex(n.id)
    return `  \\node[draw,circle,${fill}inner sep=2pt] (n${n.id}) at (${x},${y}) {${label}};`
  }).filter(Boolean)

  // Build edge lines – resolve source/target whether stored as id or object
  const resolveId = (endpoint) =>
    typeof endpoint === 'object' && endpoint !== null ? endpoint.id : endpoint

  const edgeLines = edges.map(e => {
    const src = resolveId(e.source)
    const tgt = resolveId(e.target)
    return `  \\draw (n${src}) -- (n${tgt});`
  })

  const lines = [
    '\\begin{tikzpicture}',
    ...colorDefs,
    ...nodeLines,
    ...edgeLines,
    '\\end{tikzpicture}',
  ]

  return lines.join('\n')
}
