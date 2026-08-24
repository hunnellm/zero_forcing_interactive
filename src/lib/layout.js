/**
 * Deterministic initial graph layout.
 *
 * Pipeline:
 *  1. Extract connected components.
 *  2. Seed each component with a circular arrangement (nodes ordered by
 *     degree desc then id asc) so high-degree hubs are spread around the ring.
 *  3. Run a Fruchterman–Reingold warm-start pass to reduce overlaps/crossings
 *     before the first visible frame.
 *  4. Pack multiple components into the drawing area using a row-based bin.
 */

/** Number of FR iterations for the offline warm-start pass. */
const FR_ITERATIONS = 120

/** FR tuning constant – larger C spreads the graph more. */
const FR_C = 1.2

/**
 * Extract connected components via BFS.
 * @param {number[]} nodeIds
 * @param {Map<number, number[]>} adjacency  nodeId -> list of neighbour ids
 * @returns {number[][]}  each sub-array is one component
 */
export function connectedComponents(nodeIds, adjacency) {
  const visited = new Set()
  const components = []
  for (const id of nodeIds) {
    if (visited.has(id)) continue
    const component = []
    const queue = [id]
    visited.add(id)
    while (queue.length) {
      const cur = queue.shift()
      component.push(cur)
      for (const nb of (adjacency.get(cur) || [])) {
        if (!visited.has(nb)) {
          visited.add(nb)
          queue.push(nb)
        }
      }
    }
    components.push(component)
  }
  return components
}

/**
 * Place component nodes on a circle.
 * Nodes are ordered by degree (desc) then id (asc) for determinism and to
 * spread high-degree hubs evenly, reducing initial edge crossings.
 *
 * @param {number[]} nodeIds
 * @param {Map<number, number>} degrees  nodeId -> degree
 * @param {number} radius
 * @returns {Map<number, {x: number, y: number}>}
 */
function circularPlacement(nodeIds, degrees, radius) {
  const sorted = [...nodeIds].sort((a, b) => {
    const diff = (degrees.get(b) || 0) - (degrees.get(a) || 0)
    return diff !== 0 ? diff : a - b
  })
  const pos = new Map()
  if (sorted.length === 1) {
    pos.set(sorted[0], { x: 0, y: 0 })
    return pos
  }
  const step = (2 * Math.PI) / sorted.length
  sorted.forEach((id, i) => {
    // Start at the top of the circle for a natural upright layout
    const angle = i * step - Math.PI / 2
    pos.set(id, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) })
  })
  return pos
}

/**
 * Run Fruchterman–Reingold spring-electrical force iterations on a component.
 * Positions are modified in-place.
 *
 * @param {number[]} nodeIds
 * @param {Map<number, number[]>} adjacency
 * @param {Map<number, {x: number, y: number}>} positions
 * @param {number} area  layout area used to calibrate the ideal edge length k
 */
function fruchtermanReingold(nodeIds, adjacency, positions, area) {
  const n = nodeIds.length
  if (n <= 1) return

  // Ideal edge length
  const k = FR_C * Math.sqrt(area / n)
  // Initial temperature: controls max displacement per step
  let temperature = Math.sqrt(area) / 10
  const coolingFactor = Math.pow(0.01 / temperature, 1 / FR_ITERATIONS)

  const disp = new Map(nodeIds.map(id => [id, { x: 0, y: 0 }]))

  for (let iter = 0; iter < FR_ITERATIONS; iter++) {
    // Reset displacements
    for (const d of disp.values()) { d.x = 0; d.y = 0 }

    // Repulsive forces (all pairs)
    for (let i = 0; i < n; i++) {
      const u = nodeIds[i]
      const pu = positions.get(u)
      const du = disp.get(u)
      for (let j = i + 1; j < n; j++) {
        const v = nodeIds[j]
        const pv = positions.get(v)
        const dv = disp.get(v)
        let dx = pu.x - pv.x
        let dy = pu.y - pv.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
        const rep = (k * k) / dist
        dx = (dx / dist) * rep
        dy = (dy / dist) * rep
        du.x += dx
        du.y += dy
        dv.x -= dx
        dv.y -= dy
      }
    }

    // Attractive forces along edges (process each edge once via id ordering)
    for (const u of nodeIds) {
      const pu = positions.get(u)
      const du = disp.get(u)
      for (const v of (adjacency.get(u) || [])) {
        if (v <= u) continue  // each undirected edge processed once
        const pv = positions.get(v)
        const dv = disp.get(v)
        const dx = pu.x - pv.x
        const dy = pu.y - pv.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
        const att = (dist * dist) / k
        const fx = (dx / dist) * att
        const fy = (dy / dist) * att
        du.x -= fx
        du.y -= fy
        dv.x += fx
        dv.y += fy
      }
    }

    // Apply limited displacements and cool temperature
    for (const u of nodeIds) {
      const pu = positions.get(u)
      const du = disp.get(u)
      const dlen = Math.sqrt(du.x * du.x + du.y * du.y) || 0.01
      const scale = Math.min(dlen, temperature) / dlen
      pu.x += du.x * scale
      pu.y += du.y * scale
    }
    temperature *= coolingFactor
  }
}

/**
 * Translate and scale component positions so their bounding box is centred on
 * (cx, cy) and fits within (w × h) with the given padding.
 * Modifies positions in-place.
 */
function fitAndCenter(nodeIds, positions, cx, cy, w, h, padding) {
  if (nodeIds.length === 0) return
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const id of nodeIds) {
    const p = positions.get(id)
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const ox = (minX + maxX) / 2
  const oy = (minY + maxY) / 2
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const pad = padding || 10
  const scale = Math.min((w - 2 * pad) / rangeX, (h - 2 * pad) / rangeY)
  const safeScale = isFinite(scale) && scale > 0 ? scale : 1
  for (const id of nodeIds) {
    const p = positions.get(id)
    p.x = cx + (p.x - ox) * safeScale
    p.y = cy + (p.y - oy) * safeScale
  }
}

/**
 * Compute a deterministic initial layout for a graph.
 *
 * The returned coordinates are in the same logical space used by
 * react-force-graph-2d (origin at centre, units in pixels relative to the
 * supplied width/height). Using a fixed normalised canvas size (e.g. 500×400)
 * is fine because the ForceGraph camera adapts independently.
 *
 * @param {Array<{id: number}>} nodes
 * @param {Array<{source: number|object, target: number|object}>} edges
 * @param {number} width   drawing area width
 * @param {number} height  drawing area height
 * @returns {Map<number, {x: number, y: number}>}  nodeId → position
 */
export function computeInitialLayout(nodes, edges, width, height) {
  if (!nodes.length) return new Map()

  const nodeIds = nodes.map(n => n.id)
  const MARGIN = 20
  const usableW = Math.max(width - 2 * MARGIN, 50)
  const usableH = Math.max(height - 2 * MARGIN, 50)

  // Build adjacency list and degree map
  const adjacency = new Map(nodeIds.map(id => [id, []]))
  const degrees = new Map(nodeIds.map(id => [id, 0]))

  for (const edge of edges) {
    const src = typeof edge.source === 'object' ? edge.source.id : edge.source
    const tgt = typeof edge.target === 'object' ? edge.target.id : edge.target
    if (adjacency.has(src) && adjacency.has(tgt) && src !== tgt) {
      adjacency.get(src).push(tgt)
      adjacency.get(tgt).push(src)
      degrees.set(src, degrees.get(src) + 1)
      degrees.set(tgt, degrees.get(tgt) + 1)
    }
  }

  const components = connectedComponents(nodeIds, adjacency)

  // Layout each component independently in its own local coordinate space
  const compLayouts = components.map(comp => {
    // Seed radius scales with the component's share of nodes
    const frac = comp.length / nodes.length
    const baseRadius = Math.min(usableW, usableH) * 0.4 * Math.sqrt(frac)
    const radius = Math.max(baseRadius, 30)
    const pos = circularPlacement(comp, degrees, radius)
    // Area calibration: component gets a share of the total drawing area
    const area = usableW * usableH * frac
    fruchtermanReingold(comp, adjacency, pos, Math.max(area, 2500))
    return { comp, pos }
  })

  const allPositions = new Map()

  if (compLayouts.length === 1) {
    // Single component – fill the full drawing area
    const { comp, pos } = compLayouts[0]
    fitAndCenter(comp, pos, 0, 0, usableW, usableH, 15)
    for (const [id, p] of pos) allPositions.set(id, { x: p.x, y: p.y })
    return allPositions
  }

  // Multiple components – compute bounding boxes, then pack into rows
  const compBoxes = compLayouts.map(({ comp, pos }) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const id of comp) {
      const p = pos.get(id)
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    return {
      w: maxX - minX + 2 * MARGIN,
      h: maxY - minY + 2 * MARGIN,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
    }
  })

  // Sort by component size desc for a denser top-left packing
  const order = compLayouts.map((_, i) => i)
    .sort((a, b) => compLayouts[b].comp.length - compLayouts[a].comp.length)

  let curX = -usableW / 2 + MARGIN
  let curY = -usableH / 2 + MARGIN
  let rowH = 0

  for (const idx of order) {
    const { comp, pos } = compLayouts[idx]
    const box = compBoxes[idx]

    // Wrap to a new row when the component no longer fits
    if (curX > -usableW / 2 + MARGIN && curX + box.w > usableW / 2) {
      curX = -usableW / 2 + MARGIN
      curY += rowH + MARGIN
      rowH = 0
    }

    const targetCX = curX + box.w / 2
    const targetCY = curY + box.h / 2

    for (const [id, p] of pos) {
      allPositions.set(id, {
        x: p.x - box.cx + targetCX,
        y: p.y - box.cy + targetCY,
      })
    }

    curX += box.w + MARGIN
    rowH = Math.max(rowH, box.h)
  }

  return allPositions
}
