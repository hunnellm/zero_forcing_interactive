export const FORCING_MODES = {
  ZERO: 'zero',
  PSD: 'psd',
  TRANSMISSION: 'transmission',
}

const buildNeighborMap = adjacencyData => adjacencyData.map((row, i) => {
  const neighbors = new Set()
  row.forEach((entry, j) => {
    if (entry === 1 && i !== j) {
      neighbors.add(j)
    }
  })
  return neighbors
})

const getUncoloredNeighbors = (node, coloredNodes, neighborMap) => (
  [...neighborMap[node]].filter(neighbor => !coloredNodes.has(neighbor))
)

const getUncoloredComponents = (neighborMap, coloredNodes) => {
  const uncoloredNodes = [...neighborMap.keys()].filter(node => !coloredNodes.has(node))
  const visited = new Set()
  const components = []

  uncoloredNodes.forEach(start => {
    if (visited.has(start)) return
    const stack = [start]
    const component = new Set()
    visited.add(start)

    while (stack.length > 0) {
      const current = stack.pop()
      component.add(current)
      neighborMap[current].forEach(neighbor => {
        if (coloredNodes.has(neighbor) || visited.has(neighbor)) return
        visited.add(neighbor)
        stack.push(neighbor)
      })
    }

    components.push(component)
  })

  return components
}

const getZeroForces = (coloredNodes, neighborMap) => {
  const forces = new Set()
  coloredNodes.forEach(node => {
    const uncoloredNeighbors = getUncoloredNeighbors(node, coloredNodes, neighborMap)
    if (uncoloredNeighbors.length === 1) {
      forces.add(uncoloredNeighbors[0])
    }
  })
  return forces
}

const getPsdForces = (coloredNodes, neighborMap) => {
  const forces = new Set()
  const components = getUncoloredComponents(neighborMap, coloredNodes)

  coloredNodes.forEach(node => {
    components.forEach(component => {
      const componentNeighbors = [...neighborMap[node]].filter(neighbor => component.has(neighbor))
      if (componentNeighbors.length === 1) {
        forces.add(componentNeighbors[0])
      }
    })
  })

  return forces
}

const getTransmissionReceivers = (coloredNodes, neighborMap) => {
  const receivers = new Map()

  coloredNodes.forEach(node => {
    const uncoloredNeighbors = getUncoloredNeighbors(node, coloredNodes, neighborMap)
    if (uncoloredNeighbors.length !== 1) return
    const receiver = uncoloredNeighbors[0]
    if (!receivers.has(receiver)) {
      receivers.set(receiver, [])
    }
    receivers.get(receiver).push(node)
  })

  return receivers
}

export const clampParameter = (value, fallback) => {
  const numericValue = Number(value)
  if (Number.isNaN(numericValue)) return fallback
  return Math.min(1, Math.max(0, numericValue))
}

export const initialWeights = (nodeCount, coloredNodes = new Set()) => {
  const weights = new Map()
  for (let i = 0; i < nodeCount; i += 1) {
    weights.set(i, coloredNodes.has(i) ? 1 : 0)
  }
  return weights
}

export const formatNodeLabel = (id, weight = 0) => `${ id } (w=${ weight.toFixed(2) })`

export const runForcingStep = ({
  mode,
  adjacencyData,
  coloredNodes,
  nodeWeights,
  alpha,
  beta,
}) => {
  const neighborMap = buildNeighborMap(adjacencyData)

  if (mode === FORCING_MODES.PSD) {
    const nextColoredNodes = new Set([...coloredNodes, ...getPsdForces(coloredNodes, neighborMap)])
    return {
      coloredNodes: nextColoredNodes,
      nodeWeights: initialWeights(adjacencyData.length, nextColoredNodes),
    }
  }

  if (mode === FORCING_MODES.TRANSMISSION) {
    const nextWeights = new Map(nodeWeights)
    const nextColoredNodes = new Set(coloredNodes)
    const receivers = getTransmissionReceivers(coloredNodes, neighborMap)

    receivers.forEach((transmitters, receiver) => {
      const transmittedWeight = transmitters.reduce(
        (sum, transmitter) => sum + (alpha * (nodeWeights.get(transmitter) || 0)),
        0,
      )
      const updatedWeight = (nextWeights.get(receiver) || 0) + transmittedWeight
      nextWeights.set(receiver, updatedWeight)
      if (updatedWeight > beta) {
        nextColoredNodes.add(receiver)
      }
    })

    return {
      coloredNodes: nextColoredNodes,
      nodeWeights: nextWeights,
    }
  }

  const nextColoredNodes = new Set([...coloredNodes, ...getZeroForces(coloredNodes, neighborMap)])
  return {
    coloredNodes: nextColoredNodes,
    nodeWeights: initialWeights(adjacencyData.length, nextColoredNodes),
  }
}
