import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import {
  Box,
  CardContent,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Typography,
  useTheme,
} from '@mui/material'
import { Close as CloseDrawerIcon } from '@mui/icons-material'
import { ComputationPanel } from '../computation-panel'
import { MatrixEditor } from './matrix-editor'
import { SettingsForm } from './settings-form'
import { About } from './about'
import { Instructions } from './instructions'

const tabs = [
  {
    id: 'analysis',
    label: 'Analysis',
    Component: ComputationPanel,
  },
  {
    id: 'instructions',
    label: 'Instructions',
    Component: Instructions,
  },
  {
    id: 'matrix',
    label: 'Generate Graph',
    Component: MatrixEditor,
  },
  {
    id: 'settings',
    label: 'Settings',
    Component: SettingsForm,
  },
  {
    id: 'about',
    label: 'About',
    Component: About,
  },
]

function TabPanel(props) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={ value !== index }
      id={ `analysis-tabpanel-${ index }` }
      aria-labelledby={ `analysis-tab-${ index }` }
      style={{ padding: '1rem' }}
      { ...other }
    >
      { value === index && children }
    </div>
  )
}

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
}

export const Drawer = ({ analysisPanel }) => {
  const theme = useTheme()
  const [currentTab, setCurrentTab] = useState(0)
  const [resizing, setResizing] = useState(false)

  useEffect(() => {
    if (!analysisPanel.drawerOpen) {
      return undefined
    }

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        analysisPanel.closeDrawer()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [analysisPanel])

  useEffect(() => {
    if (!resizing || analysisPanel.overlay) {
      return undefined
    }

    const handlePointerMove = event => {
      analysisPanel.setDrawerWidth(window.innerWidth - event.clientX)
    }
    const handlePointerUp = () => setResizing(false)

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)

    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [analysisPanel, resizing])

  const handleClickTab = (event, newTab) => {
    setCurrentTab(newTab)
  }

  const panelWidth = useMemo(() => (
    analysisPanel.overlay
      ? `min(${ analysisPanel.drawerWidth }px, calc(100vw - 2rem))`
      : `${ analysisPanel.drawerWidth }px`
  ), [analysisPanel.drawerWidth, analysisPanel.overlay])

  return (
    <>
      <Box
        onClick={ analysisPanel.closeDrawer }
        aria-hidden="true"
        sx={{
          display: analysisPanel.overlay && analysisPanel.drawerOpen ? 'block' : 'none',
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          backgroundColor: '#0006',
        }}
      />

      <CardContent
        component="aside"
        id="analysis-panel"
        aria-hidden={ !analysisPanel.drawerOpen }
        aria-labelledby="analysis-panel-title"
        sx={{
          position: analysisPanel.overlay ? 'absolute' : 'relative',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 3,
          boxSizing: 'border-box',
          backgroundColor: theme.palette.background.paper,
          borderLeft: analysisPanel.drawerOpen ? `1px solid ${ theme.palette.divider }` : '1px solid transparent',
          width: analysisPanel.drawerOpen ? panelWidth : 0,
          maxWidth: '100%',
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          height: '100%',
          overflow: 'hidden',
          boxShadow: analysisPanel.overlay && analysisPanel.drawerOpen ? 12 : 0,
          transform: analysisPanel.drawerOpen ? 'translateX(0)' : 'translateX(100%)',
          opacity: analysisPanel.drawerOpen ? 1 : 0,
          pointerEvents: analysisPanel.drawerOpen ? 'auto' : 'none',
          transition: theme.transitions.create(['transform', 'width', 'opacity', 'border-color'], {
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        {
          analysisPanel.drawerOpen && !analysisPanel.overlay && (
            <Box
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize analysis panel"
              onMouseDown={ event => {
                event.preventDefault()
                setResizing(true)
              } }
              sx={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: 10,
                transform: 'translateX(-50%)',
                cursor: 'col-resize',
                zIndex: 4,
              }}
            />
          )
        }

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: `1px solid ${ theme.palette.divider }`,
            flexShrink: 0,
          }}
        >
          <Typography id="analysis-panel-title" variant="h6" color="text.primary">
            Analysis & tools
          </Typography>
          <IconButton
            size="small"
            onClick={ analysisPanel.closeDrawer }
            aria-label="Close analysis panel"
          >
            <CloseDrawerIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Tabs
          aria-label="analysis tabs"
          value={ currentTab }
          onChange={ handleClickTab }
          variant="scrollable"
          sx={{
            flexShrink: 0,
            px: 1,
            borderBottom: `1px solid ${ theme.palette.divider }`,
          }}
        >
          {
            tabs.map((tab, index) => (
              <Tab
                id={ `analysis-tab-${ index }` }
                aria-controls={ `analysis-tabpanel-${ index }` }
                label={ tab.label }
                key={ `tab-label-${ tab.label }` }
              />
            ))
          }
        </Tabs>
        <Box sx={{ minHeight: 0, flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {
            tabs.map(({ Component, ...tab }, i) => (
              <TabPanel value={ currentTab } index={ i } key={ `tab-${ tab.label }` }>
                <Component analysisPanel={ analysisPanel } />
              </TabPanel>
            ))
          }
        </Box>
      </CardContent>
    </>
  )
}

Drawer.propTypes = {
  analysisPanel: PropTypes.shape({
    closeDrawer: PropTypes.func.isRequired,
    drawerOpen: PropTypes.bool.isRequired,
    drawerWidth: PropTypes.number.isRequired,
    overlay: PropTypes.bool.isRequired,
    setDrawerWidth: PropTypes.func.isRequired,
  }).isRequired,
}
