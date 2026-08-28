import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useLocalStorage } from '../../hooks'
import { Matrix } from 'ml-matrix'
import { addNodeToMatrix, addEdgeToMatrix, removeNodeFromMatrix, buildEdgeListFromMatrix } from '../../lib/matrix-utils'
import { encodeGraph6 } from '../../lib/graph6'
import { computeInitialLayout } from '../../lib/layout'
import {
  FORCING_MODES,
  clampParameter,
  initialWeights,
  runForcingStep,
} from '../../lib/forcing'
import {
  COMPUTE_OPERATIONS,
  COMPUTE_STATUS,
  MAX_DISPLAYED_MINIMUM_SETS,
  NUMBER_VARIANTS,
  SET_VARIANTS,
  clampActiveSetIndex,
  createCacheKey,
  createNumberVariantConfig,
  createOperationState,
  createSetsVariantConfig,
  isResultStale,
} from '../../lib/forcing-analysis-shared'

const initialGraph = []
const createAnalysisWorker = () => new Worker(new URL('../../lib/forcing-analysis-worker.js', import.meta.url))

// Normalised coordinate space used for layout computation; the ForceGraph
// camera adapts independently, so this only needs to be internally
// consistent. Shared between the initial layout pass and manual redraw so
// both produce identical balancing/placement.
const LAYOUT_WIDTH = 500
const LAYOUT_HEIGHT = 400

const GraphContext = createContext({})

export const useGraph = () => useContext(GraphContext)

export const GraphProvider = ({ children }) => {
  // matrix will be the 2d array
  const [matrix, setMatrix] = useLocalStorage('adjacency-matrix', initialGraph)
  // adjacencyMatrix will be the instance of the Matrix object,
  // which provides all those calculation helpers.
  const adjacencyMatrix = useMemo(() => new Matrix(matrix), [matrix])
  const graph6String = useMemo(() => encodeGraph6(matrix), [matrix])
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
  const [needsFit, setNeedsFit] = useState(false)
  const [nodeWeights, setNodeWeights] = useState(() => initialWeights(initialGraph.length, new Set()))
  const [usedTransmissions, setUsedTransmissions] = useState(() => new Set())
  const [showLabels, setShowLabels] = useState(false)
  const [numberVariant, setNumberVariant] = useLocalStorage('forcing-number-variant', NUMBER_VARIANTS.FAULT_TOLERANT)
  const [setVariant, setSetVariant] = useLocalStorage('minimum-set-variant', SET_VARIANTS.STANDARD)
  const [numberComputation, setNumberComputation] = useState(() => createOperationState())
  const [setsComputation, setSetsComputation] = useState(() => createOperationState())
  const [activeMinimumSetIndex, setActiveMinimumSetIndex] = useState(0)
  const numberCacheRef = useRef(new Map())
  const setsCacheRef = useRef(new Map())
  const numberWorkerRef = useRef(null)
  const setsWorkerRef = useRef(null)
  const numberTimerRef = useRef(null)
  const setsTimerRef = useRef(null)
  
  useEffect(() => {
    setNodes(prev => {
      const prevMap = new Map(prev.map(n => [n.id, n]))
      const rawNodes = [...Array(adjacencyMatrix.rows).keys()].map(i => prevMap.get(i) || { id: i })
      const needsLayout = rawNodes.some(n => !Number.isFinite(n.x))
      if (needsLayout && rawNodes.length > 0) {
        // Use a normalised coordinate space; the ForceGraph camera adapts
        const positions = computeInitialLayout(rawNodes, buildEdgeListFromMatrix(adjacencyMatrix), LAYOUT_WIDTH, LAYOUT_HEIGHT)
        const laid = rawNodes.map(n => {
          const p = positions.get(n.id)
          return p ? { ...n, x: p.x, y: p.y } : n
        })
        setNeedsFit(true)
        return laid
      }
      return rawNodes
    })
    setEdges(buildEdgeListFromMatrix(adjacencyMatrix))
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
        nextWeights.set(i, coloredNodes.has(i) ? Math.max(1, currentWeight) : currentWeight)
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
          ? Math.max(1, nextWeights.get(i) || 0)
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
        ? Math.max(1, nextWeights.get(i) || 0)
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

  const numberVariantConfig = useMemo(() => createNumberVariantConfig({
    variant: numberVariant,
    alpha,
    beta,
  }), [numberVariant, alpha, beta])

  const setsVariantConfig = useMemo(() => createSetsVariantConfig(setVariant), [setVariant])

  const numberCacheKey = useMemo(() => createCacheKey({
    graph6String,
    operation: COMPUTE_OPERATIONS.NUMBER,
    ...numberVariantConfig,
  }), [graph6String, numberVariantConfig])

  const setsCacheKey = useMemo(() => createCacheKey({
    graph6String,
    operation: COMPUTE_OPERATIONS.SETS,
    ...setsVariantConfig,
  }), [graph6String, setsVariantConfig])

  const clearElapsedTimer = useCallback(timerRef => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const terminateWorker = useCallback(workerRef => {
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }
  }, [])

  const cancelNumberComputation = useCallback(() => {
    terminateWorker(numberWorkerRef)
    clearElapsedTimer(numberTimerRef)
    setNumberComputation(prev => ({
      ...prev,
      status: COMPUTE_STATUS.CANCELLED,
    }))
  }, [clearElapsedTimer, terminateWorker])

  const cancelSetsComputation = useCallback(() => {
    terminateWorker(setsWorkerRef)
    clearElapsedTimer(setsTimerRef)
    setSetsComputation(prev => ({
      ...prev,
      status: COMPUTE_STATUS.CANCELLED,
    }))
  }, [clearElapsedTimer, terminateWorker])

  const runNumberComputation = useCallback(() => {
    const cachedResult = numberCacheRef.current.get(numberCacheKey)
    if (cachedResult) {
      setNumberComputation({
        status: COMPUTE_STATUS.SUCCESS,
        result: cachedResult,
        resultKey: numberCacheKey,
        error: null,
        elapsedMs: 0,
      })
      return
    }

    terminateWorker(numberWorkerRef)
    clearElapsedTimer(numberTimerRef)

    const worker = createAnalysisWorker()
    const startedAt = Date.now()
    numberWorkerRef.current = worker

    setNumberComputation(prev => ({
      ...prev,
      status: COMPUTE_STATUS.RUNNING,
      error: null,
      elapsedMs: 0,
    }))

    numberTimerRef.current = window.setInterval(() => {
      setNumberComputation(prev => (
        prev.status === COMPUTE_STATUS.RUNNING
          ? { ...prev, elapsedMs: Date.now() - startedAt }
          : prev
      ))
    }, 100)

    worker.addEventListener('message', event => {
      terminateWorker(numberWorkerRef)
      clearElapsedTimer(numberTimerRef)
      const elapsedMs = Date.now() - startedAt

      if (event.data?.status === 'success') {
        numberCacheRef.current.set(numberCacheKey, event.data.result)
        setNumberComputation({
          status: COMPUTE_STATUS.SUCCESS,
          result: event.data.result,
          resultKey: numberCacheKey,
          error: null,
          elapsedMs,
        })
        return
      }

      setNumberComputation(prev => ({
        ...prev,
        status: COMPUTE_STATUS.ERROR,
        error: event.data?.error || 'Unable to compute the requested value.',
        elapsedMs,
      }))
    }, { once: true })

    worker.addEventListener('error', () => {
      terminateWorker(numberWorkerRef)
      clearElapsedTimer(numberTimerRef)
      setNumberComputation(prev => ({
        ...prev,
        status: COMPUTE_STATUS.ERROR,
        error: 'Unable to compute the requested value.',
      }))
    }, { once: true })

    worker.postMessage({
      operation: COMPUTE_OPERATIONS.NUMBER,
      payload: {
        adjacencyData: adjacencyMatrix.data,
        graph6String,
        ...numberVariantConfig,
      },
    })
  }, [
    adjacencyMatrix.data,
    clearElapsedTimer,
    graph6String,
    numberCacheKey,
    numberVariantConfig,
    terminateWorker,
  ])

  const runSetsComputation = useCallback(() => {
    const cachedResult = setsCacheRef.current.get(setsCacheKey)
    if (cachedResult) {
      setActiveMinimumSetIndex(0)
      setSetsComputation({
        status: COMPUTE_STATUS.SUCCESS,
        result: cachedResult,
        resultKey: setsCacheKey,
        error: null,
        elapsedMs: 0,
      })
      return
    }

    terminateWorker(setsWorkerRef)
    clearElapsedTimer(setsTimerRef)

    const worker = createAnalysisWorker()
    const startedAt = Date.now()
    setsWorkerRef.current = worker

    setSetsComputation(prev => ({
      ...prev,
      status: COMPUTE_STATUS.RUNNING,
      error: null,
      elapsedMs: 0,
    }))

    setsTimerRef.current = window.setInterval(() => {
      setSetsComputation(prev => (
        prev.status === COMPUTE_STATUS.RUNNING
          ? { ...prev, elapsedMs: Date.now() - startedAt }
          : prev
      ))
    }, 100)

    worker.addEventListener('message', event => {
      terminateWorker(setsWorkerRef)
      clearElapsedTimer(setsTimerRef)
      const elapsedMs = Date.now() - startedAt

      if (event.data?.status === 'success') {
        setsCacheRef.current.set(setsCacheKey, event.data.result)
        setActiveMinimumSetIndex(0)
        setSetsComputation({
          status: COMPUTE_STATUS.SUCCESS,
          result: event.data.result,
          resultKey: setsCacheKey,
          error: null,
          elapsedMs,
        })
        return
      }

      setSetsComputation(prev => ({
        ...prev,
        status: COMPUTE_STATUS.ERROR,
        error: event.data?.error || 'Unable to compute minimum forcing sets.',
        elapsedMs,
      }))
    }, { once: true })

    worker.addEventListener('error', () => {
      terminateWorker(setsWorkerRef)
      clearElapsedTimer(setsTimerRef)
      setSetsComputation(prev => ({
        ...prev,
        status: COMPUTE_STATUS.ERROR,
        error: 'Unable to compute minimum forcing sets.',
      }))
    }, { once: true })

    worker.postMessage({
      operation: COMPUTE_OPERATIONS.SETS,
      payload: {
        adjacencyData: adjacencyMatrix.data,
        cap: MAX_DISPLAYED_MINIMUM_SETS,
        ...setsVariantConfig,
      },
    })
  }, [
    adjacencyMatrix.data,
    clearElapsedTimer,
    setsCacheKey,
    setsVariantConfig,
    terminateWorker,
  ])

  useEffect(() => () => {
    terminateWorker(numberWorkerRef)
    terminateWorker(setsWorkerRef)
    clearElapsedTimer(numberTimerRef)
    clearElapsedTimer(setsTimerRef)
  }, [clearElapsedTimer, terminateWorker])

  const numberResultStale = useMemo(
    () => isResultStale(numberComputation.resultKey, numberCacheKey),
    [numberComputation.resultKey, numberCacheKey],
  )

  const setsResultStale = useMemo(
    () => isResultStale(setsComputation.resultKey, setsCacheKey),
    [setsComputation.resultKey, setsCacheKey],
  )

  const displayedMinimumSets = setsComputation.result?.sets || []
  const clampedActiveMinimumSetIndex = clampActiveSetIndex(activeMinimumSetIndex, displayedMinimumSets.length)

  useEffect(() => {
    if (clampedActiveMinimumSetIndex !== activeMinimumSetIndex) {
      setActiveMinimumSetIndex(clampedActiveMinimumSetIndex)
    }
  }, [activeMinimumSetIndex, clampedActiveMinimumSetIndex])

  const activeMinimumSet = useMemo(() => (
    setsResultStale ? [] : (displayedMinimumSets[clampedActiveMinimumSetIndex] || [])
  ), [clampedActiveMinimumSetIndex, displayedMinimumSets, setsResultStale])

  const stepToPreviousMinimumSet = useCallback(() => {
    setActiveMinimumSetIndex(prev => clampActiveSetIndex(prev - 1, displayedMinimumSets.length))
  }, [displayedMinimumSets.length])

  const stepToNextMinimumSet = useCallback(() => {
    setActiveMinimumSetIndex(prev => clampActiveSetIndex(prev + 1, displayedMinimumSets.length))
  }, [displayedMinimumSets.length])

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

  // Explicit "redraw" action. This intentionally reuses the exact same
  // layout algorithm/parameters (computeInitialLayout) used to place the
  // graph on first display, so a redraw always reproduces the same
  // deterministic balancing regardless of the Auto Redraw toggle. It works
  // whether Auto Redraw is on or off, and never depends on or mutates the
  // continuous physics-simulation state used for Auto Redraw.
  const triggerManualRedraw = useCallback(() => {
    setNodes(prev => {
      if (!prev.length) return prev
      const positions = computeInitialLayout(prev, buildEdgeListFromMatrix(adjacencyMatrix), LAYOUT_WIDTH, LAYOUT_HEIGHT)
      return prev.map(n => {
        const p = positions.get(n.id)
        return p ? { ...n, x: p.x, y: p.y, fx: undefined, fy: undefined } : n
      })
    })
    setNeedsFit(true)
  }, [adjacencyMatrix])

  const clearNeedsFit = useCallback(() => setNeedsFit(false), [])

  const resetGraph = useCallback(() => {
    setMatrix(initialGraph)
    setNodes([])
    setEdges([])
    setColorHistory([])
    setColoredNodes(new Set())
    setNodeWeights(initialWeights(0, new Set()))
    setUsedTransmissions(new Set())
    setDrawMode(false)
  }, [setMatrix])

  const addNode = useCallback((position = null) => {
    const nextId = matrix.length
    setMatrix(addNodeToMatrix(matrix))
    setColorHistory([])
    setColoredNodes(new Set())

    const hasPosition = position && Number.isFinite(position.x) && Number.isFinite(position.y)
    const x = hasPosition ? position.x : (Math.random() - 0.5) * 100
    const y = hasPosition ? position.y : (Math.random() - 0.5) * 100
    setNodes(prev => [
      ...prev,
      {
        id: nextId,
        x,
        y,
        fx: hasPosition ? x : undefined,
        fy: hasPosition ? y : undefined,
      },
    ])
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
        graph6String,
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
        triggerManualRedraw,
        needsFit,
        clearNeedsFit,
        resetGraph,
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
        analysis: {
          constants: {
            maxDisplayedMinimumSets: MAX_DISPLAYED_MINIMUM_SETS,
          },
          number: {
            variant: numberVariant,
            setVariant: setNumberVariant,
            status: numberComputation.status,
            elapsedMs: numberComputation.elapsedMs,
            result: numberComputation.result,
            error: numberComputation.error,
            stale: numberResultStale,
            compute: runNumberComputation,
            cancel: cancelNumberComputation,
          },
          sets: {
            variant: setVariant,
            setVariant: setSetVariant,
            status: setsComputation.status,
            elapsedMs: setsComputation.elapsedMs,
            result: setsComputation.result,
            error: setsComputation.error,
            stale: setsResultStale,
            activeIndex: clampedActiveMinimumSetIndex,
            activeSet: activeMinimumSet,
            setActiveIndex: setActiveMinimumSetIndex,
            previous: stepToPreviousMinimumSet,
            next: stepToNextMinimumSet,
            compute: runSetsComputation,
            cancel: cancelSetsComputation,
          },
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
