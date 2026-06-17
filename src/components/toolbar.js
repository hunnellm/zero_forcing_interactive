import PropTypes from 'prop-types'
import { AppBar, IconButton, Stack, Tooltip, useTheme } from '@mui/material'
import {
  Close as CloseDrawerIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  Edit as DrawIcon,
  Refresh as RedrawIcon,
} from '@mui/icons-material'
import { useGraph } from './graph'

export const Toolbar = ({ drawerOpen, toggleDrawer }) => {
  const theme = useTheme()
  const { graph } = useGraph()

  const downloadCanvasPNG = () => {
    if (!graph) { return }
    const canvas = document.querySelector('.force-graph-container > canvas')
    if (!canvas) {
      return
    }
    const link = document.createElement('a')
    link.download = `graph - ${ new Date().toLocaleString()
      .replace(/\//g, '-')
      .replace(/:/g, '-')
      .replace(/,? /g, '_') }.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <AppBar sx={{ backgroundColor: theme.palette.background.paper, zIndex: 2 }}>
      <Stack
        spacing={ 1 }
        direction="row"
        alignItems="center"
        justifyContent="flex-end"
        sx={{
          padding: '1.5rem 1rem',
          position: 'relative',
        }}
      >
        <Tooltip title={ graph.drawMode ? 'Exit Draw Mode' : 'Draw Graph Mode' } placement="bottom">
          <IconButton
            size="small"
            onClick={ graph.toggleDrawMode }
            sx={{
              color: graph.drawMode ? theme.palette.primary.main : theme.palette.text.primary,
              transition: 'color 250ms',
              '&:hover': { color: theme.palette.primary.main }
            }}
          ><DrawIcon /></IconButton>
        </Tooltip>

        <Tooltip title="Redraw Graph" placement="bottom">
          <IconButton
            size="small"
            onClick={ graph.triggerManualRedraw }
            sx={{
              color: theme.palette.text.primary,
              transition: 'color 250ms',
              '&:hover': { color: theme.palette.primary.main }
            }}
          ><RedrawIcon /></IconButton>
        </Tooltip>

        <Tooltip title="Download Graph as PNG" placement="bottom">
          <IconButton
            size="small"
            onClick={ downloadCanvasPNG }
            sx={{
              color: theme.palette.text.primary,
              transition: 'color 250ms',
              '&:hover': { color: theme.palette.primary.main }
            }}
          ><DownloadIcon /></IconButton>
        </Tooltip>

        <Tooltip title="View Settings" placement="bottom">
          <IconButton
            size="small"
            onClick={ toggleDrawer }
            sx={{ color: drawerOpen ? theme.palette.primary.main : theme.palette.text.primary }}
          >{ drawerOpen ? <CloseDrawerIcon /> : <SettingsIcon /> }</IconButton>
        </Tooltip>
      </Stack>
    </AppBar>
  )
}

Toolbar.propTypes = {
  toggleDrawer: PropTypes.func.isRequired,
  drawerOpen: PropTypes.bool.isRequired,
}
