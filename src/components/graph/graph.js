import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useTheme } from '@mui/material'
import ForceGraph2D from './force-graph'
import { useGraph } from './context'
import { FORCING_MODES, formatNodeLabel } from '../../lib/forcing'
import { isContinuousRedrawEnabled } from '../../lib/graph-redraw'

export const Graph = ({ nodes, edges, height, width }) => {
  const theme = useTheme()
  const { graph } = useGraph()
  const fgRef = useRef()
  const [highlightedNodes, setHighlightedNodes] = useState(new Set())
  // In draw mode: the first selected node for edge creation (or null)
  const [drawSrcNode, setDrawSrcNode] = useState(null)
  // Track last click for double-click detection in draw mode
  const lastClickRef = useRef({ nodeId: null, time: 0 })

  // Clear draw selection when leaving draw mode
  useEffect(() => {
    if (!graph.drawMode) {
      setDrawSrcNode(null)
    }
  }, [graph.drawMode])

  const updateHighlight = () => {
    setHighlightedNodes(highlightedNodes)
  }

  const fitToScreen = useCallback((duration = 0, padding = 20) => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(duration, padding)
    }
  }, [])

  // Fit all nodes into view after (re)layout is computed. This effect is the
  // single, shared code path for both the initial layout pass and manual
  // redraw (graph.triggerManualRedraw), so both fit the camera identically.
  useEffect(() => {
    if (graph.needsFit && fgRef.current) {
      // Defer one frame so ForceGraph has processed the new node positions
      requestAnimationFrame(() => {
        fitToScreen(0, 20)
        graph.clearNeedsFit()
      })
    }
  }, [graph.needsFit, graph.clearNeedsFit, fitToScreen])

  // Whether the physics simulation is allowed to run continuously. This is
  // the single source of truth for "Auto Redraw" -- nothing else in this
  // component may re-enable continuous ticking when it evaluates to false.
  const continuousRedrawEnabled = isContinuousRedrawEnabled({
    drawMode: graph.drawMode,
    autoRedraw: graph.settings.autoRedraw,
  })

  const requestReheat = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.d3ReheatSimulation()
      return
    }
    requestAnimationFrame(() => {
      if (fgRef.current) {
        fgRef.current.d3ReheatSimulation()
      }
    })
  }, [])

  const extractBackgroundClickCoords = useCallback((event) => {
    const rawEvent = event?.srcEvent || event
    if (!rawEvent) {
      return null
    }

    if (Number.isFinite(rawEvent.offsetX) && Number.isFinite(rawEvent.offsetY)) {
      return { x: rawEvent.offsetX, y: rawEvent.offsetY }
    }

    const touch = rawEvent.touches?.[0] || rawEvent.changedTouches?.[0]
    const clientX = Number.isFinite(rawEvent.clientX) ? rawEvent.clientX : touch?.clientX
    const clientY = Number.isFinite(rawEvent.clientY) ? rawEvent.clientY : touch?.clientY
    const target = rawEvent.currentTarget || rawEvent.target

    if (Number.isFinite(clientX) && Number.isFinite(clientY) && target?.getBoundingClientRect) {
      const rect = target.getBoundingClientRect()
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      }
    }

    return null
  }, [])

  const handleHoverNode = node => {
    highlightedNodes.clear()
    if (node) {
      highlightedNodes.add(node.id)
      graph.neighbors(node.id)
        .forEach(i => highlightedNodes.add(i))
    }
    updateHighlight()
  }

  const paintRing = useCallback((node, ctx, color) => {
    ctx.beginPath()
    ctx.arc(node.x, node.y, graph.settings.nodeSize + 1.5, 0, 2 * Math.PI, false)
    ctx.strokeStyle = color || `${ graph.settings.color }66`
    ctx.lineWidth = 3
    ctx.stroke()
  }, [graph.settings])

  const handleClickNode = useCallback((node, event) => {
    if (graph.drawMode) {
      const now = Date.now()
      const isDoubleClick =
        lastClickRef.current.nodeId === node.id &&
        now - lastClickRef.current.time < 300
      lastClickRef.current = { nodeId: node.id, time: now }

      if (isDoubleClick) {
        lastClickRef.current = { nodeId: null, time: 0 }
        setDrawSrcNode(null)
        graph.removeNode(node.id)
        return
      }

      if (drawSrcNode === null) {
        // Select this node as edge source
        setDrawSrcNode(node.id)
      } else if (drawSrcNode === node.id) {
        // Click same node — deselect
        setDrawSrcNode(null)
      } else {
        // Create edge between drawSrcNode and clicked node
        graph.addEdge(drawSrcNode, node.id)
        setDrawSrcNode(null)
      }
      return
    }
    if (event.ctrlKey) {
      graph.toggleNeighborhoodColor(node.id)
      return
    }
    graph.toggleNodeColor(node.id)
  }, [graph.coloredNodes, graph.drawMode, graph.addEdge, graph.removeNode, drawSrcNode])

  const handleBackgroundClick = useCallback((event) => {
    if (!graph.drawMode) return
    const clickCoords = extractBackgroundClickCoords(event)
    const pos = fgRef.current
      ? fgRef.current.screen2GraphCoords(clickCoords?.x, clickCoords?.y)
      : null
    graph.addNode(pos)
  }, [extractBackgroundClickCoords, graph.drawMode, graph.addNode])

  const getNodeLabelText = useCallback(id => {
    const hideWeight = graph.forcing.mode === FORCING_MODES.ZERO || graph.forcing.mode === FORCING_MODES.PSD
    if (hideWeight) return `${id}`
    const weight = graph.nodeWeights.get(id) || 0
    return formatNodeLabel(id, weight)
  }, [graph.forcing.mode, graph.nodeWeights])

  const analysisHighlightedNodes = useMemo(
    () => new Set(graph.analysis.sets.activeSet),
    [graph.analysis.sets.activeSet],
  )

  const nodeCanvasObject = useCallback(({ x, y, id }, context) => {
    if (graph.drawMode && drawSrcNode === id) {
      // Draw a distinct selection ring in draw mode
      paintRing({ x, y }, context, theme.palette.secondary.main)
    } else if (analysisHighlightedNodes.has(id)) {
      paintRing({ x, y }, context, theme.palette.secondary.main)
    } else if (highlightedNodes.has(id)) {
      paintRing({ x, y }, context)
    }
    context.fillStyle = graph.coloredNodes.has(id)
      ? graph.settings.color
      : '#fff'
    context.beginPath()
    context.arc(x, y, graph.settings.nodeSize, 0, 2 * Math.PI, false)
    context.lineWidth = 1
    context.strokeStyle = theme.palette.grey[800]
    context.stroke()
    context.fill()
    if (graph.settings.showLabels) {
  const labelText = getNodeLabelText(id)
  context.font = '11px Sans-Serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  
  const textWidth = context.measureText(labelText).width + 8

  // Save previous canvas state so changes don't bleed into other nodes
  context.save() 
  
  // Set desired opacity for the label (e.g., 0.5 for 50% opacity)
  context.globalAlpha = 0.5 

  // Draw background box
  context.fillStyle = theme.palette.background.paper
  context.fillRect(x - (textWidth / 2), y + graph.settings.nodeSize + 3, textWidth, 14)

  // Draw label text
  context.fillStyle = theme.palette.text.primary
  context.fillText(labelText, x, y + graph.settings.nodeSize + 10)

  // Restore canvas alpha state back to 1.0 for the next items
  context.restore() 
}
  }, [analysisHighlightedNodes, graph.coloredNodes, graph.settings, graph.drawMode, drawSrcNode, highlightedNodes, theme.palette, getNodeLabelText])

  const nodePaint = ({ x, y }, color, context) => {
    context.fillStyle = color
    context.beginPath()
    context.arc(x, y, graph.settings.nodeSize, 0, 2 * Math.PI, false)
    context.fill()
  }

  useEffect(() => {
    if (!fgRef.current) {
      return
    }
    const handleKeyPress = event => {
      if (event.keyCode === 70) {
        fgRef.current.zoomToFit(250)
      }
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [fgRef.current])

  // Reheat simulation whenever nodes or edges change in draw mode so newly
  // added nodes animate into a visible position.
  useEffect(() => {
    if (graph.drawMode) {
      requestReheat()
    }
  }, [graph.drawMode, nodes, edges, requestReheat])

  const graphData = useMemo(() => ({ nodes, links: edges }), [nodes, edges])

  return (
    <ForceGraph2D
      ref={ fgRef }
      height={ height }
      width={ width }
      graphData={ graphData }
      enablePointerInteraction={ true }
      nodePointerAreaPaint={ nodePaint }
      nodeCanvasObject={ nodeCanvasObject }
      onNodeClick={ handleClickNode }
      onNodeHover={ graph.drawMode ? undefined : handleHoverNode }
      onNodeDrag={ graph.drawMode ? undefined : handleHoverNode }
      onBackgroundClick={ handleBackgroundClick }
      linkColor={ () => theme.palette.grey[500] }
      linkWidth={ 2 }
      nodeLabel={ node => graph.settings.showLabels ? getNodeLabelText(node.id) : '' }
      autoPauseRedraw={ false }
      cooldownTicks={ continuousRedrawEnabled ? Infinity : 0 }
    />
  )
}

Graph.propTypes = {
  nodes: PropTypes.array.isRequired,
  edges: PropTypes.array.isRequired,
  height: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
}
