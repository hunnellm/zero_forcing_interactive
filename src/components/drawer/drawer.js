import { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CardContent, Drawer as MuiDrawer,
  Tab, Tabs, useTheme,
} from '@mui/material'
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
  const { compact, drawerOpen, toggleDrawer } = useApp()
  const [currentTab, setCurrentTab] = useState(0)

  const handleClickTab = (event, newTab) => {
    setCurrentTab(newTab)
  }

  return (
    <MuiDrawer
      open={ drawerOpen }
      onClose={ toggleDrawer }
      anchor="top"
      sx={{ zIndex: 1 }}
      PaperProps={{
        style: {
          backgroundColor: theme.palette.background.paper,
          paddingTop: theme.spacing(9),
          margin: compact ? 0 : '0 1rem',
        }
      }}
    >
      <CardContent>
        <Tabs
          aria-label="settings tabs"
          value={ currentTab }
          onChange={ handleClickTab }
          variant="scrollable"
        >
          {
            tabs.map(tab => <Tab label={ tab.label } key={ `tab-label-${ tab.label }` } /> )
          }
        </Tabs>
        <br />
        {
          tabs.map(({ Component, ...tab }, i) => (
            <TabPanel value={ currentTab } index={ i } key={ `tab-${ tab.label }` }>
              <Component />
            </TabPanel>
          ))
        }
      </CardContent>
    </MuiDrawer>
  )
}
