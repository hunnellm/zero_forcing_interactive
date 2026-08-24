import { useRef } from 'react'
import { Box, useTheme } from '@mui/material'
import ReactResizeDetector from 'react-resize-detector';
import { useApp } from './context'
import { Graph, useGraph } from './components/graph'
import { Toolbar } from './components/toolbar'
import { Colorbar } from './components/colorbar'
import { Drawer } from './components/drawer'

const MIN_DIMENSION = 50

const sanitizeGraphDimension = (value, containerBound) => {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(containerBound) || containerBound <= 0) {
    return 0
  }
  return Math.min(Math.floor(value), Math.floor(containerBound))
}

export const App = () => {
  const theme = useTheme()
  const { graph } = useGraph()
  const { drawerOpen, toggleDrawer } = useApp()
  const lastGoodSize = useRef(null)
  const containerRef = useRef(null)

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      backgroundColor: theme.palette.background.default,
      overflow: 'hidden',
    }}>
      <Toolbar drawerOpen={ drawerOpen } toggleDrawer={ toggleDrawer } />

      <Box sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <Box ref={ containerRef } sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          position: 'relative',
        }}>
          <Box sx={{
            width: '100%',
            height: '100%',
            '& > div': {
              width: '100%',
              height: '100%',
            },
          }}>
            <ReactResizeDetector handleWidth handleHeight>
              {
                ({ width, height }) => {
                  // Use the container's actual client size as the bound so the fallback
                  // never exceeds the available middle area (keeping top/bottom controls visible).
                  const el = containerRef.current
                  const containerWidth = el ? el.clientWidth : MIN_DIMENSION
                  const containerHeight = el ? el.clientHeight : MIN_DIMENSION
                  const widthBound = Math.max(MIN_DIMENSION, Math.floor(containerWidth))
                  const heightBound = Math.max(MIN_DIMENSION, Math.floor(containerHeight))
                  const safeWidth = sanitizeGraphDimension(width, widthBound)
                  const safeHeight = sanitizeGraphDimension(height, heightBound)
                  const hasValidSize = safeWidth >= MIN_DIMENSION && safeHeight >= MIN_DIMENSION

                  if (hasValidSize) {
                    lastGoodSize.current = { width: safeWidth, height: safeHeight }
                  }

                  const renderSize = lastGoodSize.current || {
                    width: widthBound,
                    height: heightBound,
                  }

                  return (
                    <Graph
                      width={ renderSize.width }
                      height={ renderSize.height }
                      nodes={ graph.nodes }
                      edges={ graph.edges }
                    />
                  )
                }
              }
            </ReactResizeDetector>
          </Box>

          <Colorbar />
        </Box>

        <Drawer />
      </Box>

    </Box>
  )
}
