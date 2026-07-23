import { useEffect, useState } from 'react'
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
import { useApp } from '../../context'
import { MatrixEditor } from './matrix-editor'
import { SettingsForm } from './settings-form'
import { About } from './about'
import { Instructions } from './instructions'


const tabs = [
  {
    id: 'instructions',
    label: 'Instructions',
    Component: Instructions
  },
  {
    id: 'matrix',
    label: 'Generate Graph',
    Component: MatrixEditor
  },
  {
    id: 'settings',
    label: 'Settings',
    Component: SettingsForm
  },
  {
    id: 'about',
    label: 'About',
    Component: About
  },
]

function TabPanel(props) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={ value !== index }
      id={ `config-tabpanel-${ index }` }
      aria-labelledby={`config-tab-${ index }`}
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

//

export const Drawer = () => {
  const theme = useTheme()
  const { drawerOpen, closeDrawer } = useApp()
  const [currentTab, setCurrentTab] = useState(0)

  useEffect(() => {
    if (!drawerOpen) {
      return undefined
    }

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        closeDrawer()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeDrawer, drawerOpen])

  const handleClickTab = (event, newTab) => {
    setCurrentTab(newTab)
  }

  return (
    <>
      <Box
        onClick={ closeDrawer }
        aria-hidden="true"
        sx={{
          display: { xs: drawerOpen ? 'block' : 'none', md: 'none' },
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          backgroundColor: '#0006',
        }}
      />

      <CardContent
        component="aside"
        id="options-panel"
        aria-hidden={ !drawerOpen }
        aria-labelledby="options-panel-title"
        sx={{
          position: { xs: 'absolute', md: 'relative' },
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 3,
          boxSizing: 'border-box',
          backgroundColor: theme.palette.background.paper,
          borderLeft: drawerOpen ? `1px solid ${ theme.palette.divider }` : '1px solid transparent',
          width: { xs: 'min(24rem, calc(100vw - 2rem))', md: drawerOpen ? 380 : 0 },
          maxWidth: '100%',
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          height: '100%',
          overflow: 'hidden',
          boxShadow: { xs: drawerOpen ? 12 : 0, md: 0 },
          transform: {
            xs: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
            md: 'translateX(0)',
          },
          opacity: drawerOpen ? 1 : { xs: 0, md: 1 },
          pointerEvents: drawerOpen ? 'auto' : { xs: 'none', md: 'none' },
          transition: theme.transitions.create(['transform', 'width', 'opacity', 'border-color'], {
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
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
          <Typography id="options-panel-title" variant="h6" color="text.primary">
            Options
          </Typography>
          <IconButton
            size="small"
            onClick={ closeDrawer }
            aria-label="Close options panel"
          >
            <CloseDrawerIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Tabs
          aria-label="settings tabs"
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
                id={ `config-tab-${ index }` }
                aria-controls={ `config-tabpanel-${ index }` }
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
                <Component />
              </TabPanel>
            ))
          }
        </Box>
      </CardContent>
    </>
  )
}
