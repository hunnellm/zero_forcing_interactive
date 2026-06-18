import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import loadable from '@loadable/component'
import { useTheme } from '@mui/material'
import { useGraph } from './context'
import { formatNodeLabel } from '../../lib/forcing'

const ForceGraph2D = loadable(() => import('./force-graph'))

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

  const handleBackgroundClick = useCallback(() => {
    if (!graph.drawMode) return
    graph.addNode()
  }, [graph.drawMode, graph.addNode])

  const nodeCanvasObject = useCallback(({ x, y, id }, context) => {
    if (graph.drawMode && drawSrcNode === id) {
      // Draw a distinct selection ring in draw mode
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
      const weight = graph.nodeWeights.get(id) || 0
      const labelText = formatNodeLabel(id, weight)
      context.font = '11px Sans-Serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      const textWidth = context.measureText(labelText).width + 8
      context.fillStyle = theme.palette.background.paper
      context.fillRect(x - (textWidth / 2), y + graph.settings.nodeSize + 3, textWidth, 14)
      context.fillStyle = theme.palette.text.primary
      context.fillText(labelText, x, y + graph.settings.nodeSize + 10)
    }
  }, [graph.coloredNodes, graph.nodeWeights, graph.settings, graph.drawMode, drawSrcNode, highlightedNodes, theme.palette])

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

  useEffect(() => {
    if (graph.manualRedrawActive && fgRef.current) {
      fgRef.current.d3ReheatSimulation()
    }
  }, [graph.manualRedrawActive])

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
      onEngineStop={ graph.manualRedrawActive ? graph.clearManualRedraw : undefined }
      linkColor={ () => theme.palette.grey[500] }
      linkWidth={ 2 }
      nodeLabel={ node => graph.settings.showLabels ? formatNodeLabel(node.id, graph.nodeWeights.get(node.id) || 0) : '' }
      autoPauseRedraw={ false }
      cooldownTicks={ (graph.settings.autoRedraw || graph.manualRedrawActive) ? Infinity : 0 }
    />
  )
}

Graph.propTypes = {
  nodes: PropTypes.array.isRequired,
  edges: PropTypes.array.isRequired,
  height: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
}
