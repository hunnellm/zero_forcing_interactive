import { Box, useTheme } from '@mui/material'
import ReactResizeDetector from 'react-resize-detector';
import { useApp } from './context'
import { Graph, useGraph } from './components/graph'
import { Toolbar } from './components/toolbar'
import { Colorbar } from './components/colorbar'
import { Drawer } from './components/drawer'

export const App = () => {
  const theme = useTheme()
  const { graph } = useGraph()
  const { drawerOpen, toggleDrawer } = useApp()

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
                ({ width, height }) => (
                  <Graph
                    width={ width ?? 0 }
                    height={ height ?? 0 }
                    nodes={ graph.nodes }
                    edges={ graph.edges }
                  />
                )
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
