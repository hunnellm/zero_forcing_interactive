import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { useLocalStorage } from '../../hooks'
import { Matrix } from 'ml-matrix'
import { addNodeToMatrix, addEdgeToMatrix, removeNodeFromMatrix } from '../../lib/matrix-utils'
import {
  FORCING_MODES,
  clampParameter,
  initialWeights,
  runForcingStep,
} from '../../lib/forcing'

const initialGraph = [
  [0, 1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 0, 0],
  [0, 1, 0, 1, 0, 0, 0, 0, 0],
  [0, 0, 1, 0, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 1, 0, 0],
  [0, 0, 0, 0, 0, 1, 0, 1, 0],
  [0, 0, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1, 0],
]

const GraphContext = createContext({})

export const useGraph = () => useContext(GraphContext)

export const GraphProvider = ({ children }) => {
  // matrix will be the 2d array
  const [matrix, setMatrix] = useLocalStorage('adjacency-matrix', initialGraph)
  // adjacencyMatrix will be the instance of the Matrix object,
  // which provides all those calculation helpers.
  const adjacencyMatrix = useMemo(() => new Matrix(matrix), [matrix])
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [coloredNodes, setColoredNodes] = useState(new Set())
  const [colorHistory, setColorHistory] = useState([])
  const [color, setColor] = useLocalStorage('node-color', '#a14f92')
  const [nodeSize, setNodeSize] = useLocalStorage('node-size', 4)
  const [autoRedraw, setAutoRedraw] = useLocalStorage('auto-redraw', false)
  const [forcingMode, setForcingMode] = useLocalStorage('forcing-mode', FORCING_MODES.ZERO)
  const [alpha, setAlphaState] = useLocalStorage('transmission-alpha', 0.5)
  const [beta, setBetaState] = useLocalStorage('transmission-beta', 0.5)
  const [drawMode, setDrawMode] = useState(false)
  const [manualRedrawActive, setManualRedrawActive] = useState(false)
  const [nodeWeights, setNodeWeights] = useState(() => initialWeights(initialGraph.length, new Set()))
  const [usedTransmissions, setUsedTransmissions] = useState(() => new Set())
  const [showLabels, setShowLabels] = useState(false)
  
  useEffect(() => {
    setNodes(prev => {
      const prevMap = new Map(prev.map(n => [n.id, n]))
      return [...Array(adjacencyMatrix.rows).keys()].map(i => prevMap.get(i) || { id: i })
    })
    let _edges = []
    adjacencyMatrix.data.forEach((row, i) => {
      for (let j = 0; j < i; j += 1) {
        if (row[j] === 1) {
          _edges.push({ source: i, target: j })
        }
      }
    })
    setEdges(_edges)
  }, [adjacencyMatrix])

  useEffect(() => {
    setNodeWeights(prevWeights => {
      const nextWeights = new Map()
      for (let i = 0; i < adjacencyMatrix.rows; i += 1) {
        const defaultWeight = coloredNodes.has(i) ? 1 : 0
        nextWeights.set(i, prevWeights.has(i) ? prevWeights.get(i) : defaultWeight)
      }
      return nextWeights
    })
  }, [adjacencyMatrix, coloredNodes])

  useEffect(() => {
    setColorHistory([])
    setUsedTransmissions(new Set())
    if (forcingMode !== FORCING_MODES.TRANSMISSION) {
      setNodeWeights(initialWeights(adjacencyMatrix.rows, coloredNodes))
      setShowLabels(false)
      return
    }

    setShowLabels(true)
    setNodeWeights(prevWeights => {
      const nextWeights = new Map()
      for (let i = 0; i < adjacencyMatrix.rows; i += 1) {
        const currentWeight = prevWeights.get(i) || 0
        nextWeights.set(i, coloredNodes.has(i) ? Math.max( currentWeight) : currentWeight)
      }
      return nextWeights
    })
  }, [forcingMode])

  const toggleNodeColor = useCallback(i => {
    if (coloredNodes.has(i)) {
      uncolorNode(i)
    } else {
      colorNode(i)
    }
  }, [coloredNodes])

  const toggleNeighborhoodColor = useCallback(id => {
    const _coloredNodes = new Set([...coloredNodes])
    if (_coloredNodes.has(id)) {
      [...neighbors(id)].forEach(i => {
        _coloredNodes.delete(i)
      })
      setColoredNodes(new Set(_coloredNodes))
      setNodeWeights(prevWeights => {
        const nextWeights = new Map(prevWeights)
        ;[...neighbors(id)].forEach(i => nextWeights.set(i, 0))
        return nextWeights
      })
      return
    }
    const nextColoredNodes = new Set([...coloredNodes, id, ...neighbors(id)])
    setColoredNodes(nextColoredNodes)
    setNodeWeights(prevWeights => {
      const nextWeights = new Map(prevWeights)
      ;[...nextColoredNodes].forEach(i => {
        nextWeights.set(i, forcingMode === FORCING_MODES.TRANSMISSION
          ? Math.max( nextWeights.get(i) || 0)
          : 1)
      })
      return nextWeights
    })
  }, [coloredNodes, neighbors, forcingMode])

  const colorNode = useCallback(i => {
    setColoredNodes(new Set([...coloredNodes, i]))
    setNodeWeights(prevWeights => {
      const nextWeights = new Map(prevWeights)
      nextWeights.set(i, forcingMode === FORCING_MODES.TRANSMISSION
        ? Math.max( nextWeights.get(i) || 0)
        : 1)
      return nextWeights
    })
  }, [coloredNodes, forcingMode])

  const uncolorNode = useCallback(i => {
    let _coloredNodes = new Set([...coloredNodes])
    if (_coloredNodes.has(i)) {
      _coloredNodes.delete(i)
    }
    setColoredNodes(_coloredNodes)
    setNodeWeights(prevWeights => {
      const nextWeights = new Map(prevWeights)
      nextWeights.set(i, 0)
      return nextWeights
    })
  }, [coloredNodes])

  const uncolorAllNodes = () => {
    setColorHistory([])
    setColoredNodes(new Set())
    setNodeWeights(initialWeights(adjacencyMatrix.rows, new Set()))
    setUsedTransmissions(new Set())
  }

  const neighbors = useCallback(i => {
    let neighbors = new Set([i])
    adjacencyMatrix.data[i].forEach((entry, j) => {
      if (entry === 1) {
        neighbors.add(j)
      }
    })
    return neighbors
  }, [adjacencyMatrix])

  const setTransmissionAlpha = useCallback(value => {
    setAlphaState(clampParameter(value, 0.5))
  }, [])

  const setTransmissionBeta = useCallback(value => {
    setBetaState(clampParameter(value, 0.5))
  }, [])

  const setMode = useCallback(mode => {
    setForcingMode(mode)
  }, [])

  const colorStep = useCallback(() => {
    setColorHistory(prev => [...prev, {
      coloredNodes: new Set(coloredNodes),
      nodeWeights: new Map(nodeWeights),
      usedTransmissions: new Set(usedTransmissions),
    }])
    const stepResult = runForcingStep({
      mode: forcingMode,
      adjacencyData: adjacencyMatrix.data,
      coloredNodes,
      nodeWeights,
      alpha,
      beta,
      usedTransmissions,
    })
    setColoredNodes(stepResult.coloredNodes)
    setNodeWeights(stepResult.nodeWeights)
    if (stepResult.usedTransmissions) {
      setUsedTransmissions(stepResult.usedTransmissions)
    }
  }, [adjacencyMatrix, coloredNodes, nodeWeights, usedTransmissions, forcingMode, alpha, beta])

  const stepBack = useCallback(() => {
    if (colorHistory.length === 0) return
    const prev = colorHistory[colorHistory.length - 1]
    setColorHistory(h => h.slice(0, -1))
    setColoredNodes(new Set(prev.coloredNodes))
    setNodeWeights(new Map(prev.nodeWeights))
    setUsedTransmissions(new Set(prev.usedTransmissions || []))
  }, [colorHistory])

  const toggleDrawMode = useCallback(() => setDrawMode(d => !d), [])

  const toggleAutoRedraw = useCallback(() => setAutoRedraw(v => !v), [])

  const toggleShowLabels = useCallback(() => setShowLabels(v => !v), [])

  const triggerManualRedraw = useCallback(() => setManualRedrawActive(true), [])

  const clearManualRedraw = useCallback(() => setManualRedrawActive(false), [])

  const addNode = useCallback(() => {
    setMatrix(addNodeToMatrix(matrix))
    setColorHistory([])
    setColoredNodes(new Set())
  }, [matrix])

  const removeNode = useCallback(nodeId => {
    setMatrix(removeNodeFromMatrix(matrix, nodeId))
    setColorHistory([])
    setColoredNodes(new Set())
  }, [matrix])

  const addEdge = useCallback((srcId, tgtId) => {
    setMatrix(addEdgeToMatrix(matrix, srcId, tgtId))
  }, [matrix])

  return (
    <GraphContext.Provider value={{
      graph: {
        nodes,
        edges,
        adjacencyMatrix,
        setMatrix,
        colorNode,
        coloredNodes,
        nodeWeights,
        toggleNodeColor,
        toggleNeighborhoodColor,
        uncolorAllNodes,
        neighbors,
        addNode,
        addEdge,
        removeNode,
        drawMode,
        toggleDrawMode,
        manualRedrawActive,
        triggerManualRedraw,
        clearManualRedraw,
        forcing: {
          modes: FORCING_MODES,
          mode: forcingMode,
          setMode,
          alpha,
          beta,
          setAlpha: setTransmissionAlpha,
          setBeta: setTransmissionBeta,
        },
        settings: {
          color,
          setColor,
          nodeSize,
          setNodeSize,
          autoRedraw,
          toggleAutoRedraw,
          showLabels,
          toggleShowLabels,
        },
      },
      colorStep,
      stepBack,
      canStepBack: colorHistory.length > 0,
      matrix,
      setMatrix,
    }}>
      { children }
    </GraphContext.Provider>
  )
}

GraphProvider.propTypes = { children: PropTypes.node }
