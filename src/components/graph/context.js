import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { useLocalStorage } from '../../hooks'
import { Matrix } from 'ml-matrix'
import { addNodeToMatrix, addEdgeToMatrix } from '../../lib/matrix-utils'

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
  const [drawMode, setDrawMode] = useState(false)
  
  useEffect(() => {
    setNodes([...Array(adjacencyMatrix.rows).keys()].map(i => ({ id: i })))
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
      [...neighbors(id)].forEach(i => _coloredNodes.delete(i))
      setColoredNodes(new Set(_coloredNodes))
      return
    }
    setColoredNodes(new Set([...coloredNodes, id, ...neighbors(id)]))
  }, [coloredNodes])

  const colorNode = useCallback(i => {
    setColoredNodes(new Set([...coloredNodes, i]))
  }, [coloredNodes])

  const uncolorNode = useCallback(i => {
    let _coloredNodes = new Set([...coloredNodes])
    if (_coloredNodes.has(i)) {
      _coloredNodes.delete(i)
    }
    setColoredNodes(_coloredNodes)
  }, [coloredNodes])

  const uncolorAllNodes = () => {
    setColorHistory([])
    setColoredNodes(new Set())
  }

  const neighbors = useCallback(i => {
    let neighbors = new Set([i])
    adjacencyMatrix.data[i].forEach((entry, j) => {
      if (entry === 1) {
        neighbors.add(j)
      }
    })
    return neighbors
  }, [coloredNodes])

  const colorStep = useCallback(() => {
    setColorHistory(prev => [...prev, new Set(coloredNodes)])
    const nextColoredNodes = new Set();
    [...coloredNodes].forEach(i => {
      const uncoloredNeighbors = [...neighbors(i)].filter(i =>  !coloredNodes.has(i))
      if (uncoloredNeighbors.length === 1) {
        nextColoredNodes.add(uncoloredNeighbors[0])
      }
    })
    setColoredNodes(new Set([...coloredNodes, ...nextColoredNodes]))
  }, [coloredNodes])

  const stepBack = useCallback(() => {
    if (colorHistory.length === 0) return
    const prev = colorHistory[colorHistory.length - 1]
    setColorHistory(h => h.slice(0, -1))
    setColoredNodes(new Set(prev))
  }, [colorHistory])

  const toggleDrawMode = useCallback(() => setDrawMode(d => !d), [])

  const addNode = useCallback(() => {
    setMatrix(addNodeToMatrix(matrix))
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
        toggleNodeColor,
        toggleNeighborhoodColor,
        uncolorAllNodes,
        neighbors,
        addNode,
        addEdge,
        drawMode,
        toggleDrawMode,
        settings: {
          color,
          setColor,
          nodeSize,
          setNodeSize,
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
