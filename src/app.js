import { useRef } from 'react'
import { Box, useTheme } from '@mui/material'
import ReactResizeDetector from 'react-resize-detector';
import { useApp } from './context'
import { Graph, useGraph } from './components/graph'
import { Toolbar } from './components/toolbar'
import { Colorbar } from './components/colorbar'
import { Drawer } from './components/drawer'

const MIN_DIMENSION = 50

const sanitizeGraphDimension = (value, viewportBound) => {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(viewportBound) || viewportBound <= 0) {
    return 0
  }
  return Math.min(Math.floor(value), Math.floor(viewportBound))
}

export const App = () => {
  const theme = useTheme()
  const { graph } = useGraph()
  const { drawerOpen, toggleDrawer } = useApp()
  const lastGoodSize = useRef(null)

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      backgroundColor: theme.palette.background.default,
    }}>
      <Toolbar drawerOpen={ drawerOpen } toggleDrawer={ toggleDrawer } />

      <Box sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <Box sx={{
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
                  // Guard against transient/invalid detector values and cap to viewport bounds.
                  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0
                  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0
                  const safeWidth = sanitizeGraphDimension(width, viewportWidth)
                  const safeHeight = sanitizeGraphDimension(height, viewportHeight)
                  const hasValidSize = safeWidth >= MIN_DIMENSION && safeHeight >= MIN_DIMENSION

                  if (hasValidSize) {
                    lastGoodSize.current = { width: safeWidth, height: safeHeight }
                  }

                  const renderSize = lastGoodSize.current

                  if (!renderSize) {
                    return null
                  }

                  return (
                    <Graph
                      key={ drawerOpen ? 'graph-drawer-open' : 'graph-drawer-closed' }
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
