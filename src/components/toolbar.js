import PropTypes from 'prop-types'
import { AppBar, IconButton, Stack, Tooltip, Typography, useTheme } from '@mui/material'
import {
  Close as CloseDrawerIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  Edit as DrawIcon,
  Label as LabelIcon,
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
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          padding: '1.5rem 1rem',
          position: 'relative',
        }}
      >
        <Typography
          variant="h6"
          component="div"
          sx={{ color: theme.palette.text.primary, fontWeight: 700, letterSpacing: '0.05em' }}
        >
          Visualizing Variants of Zero Forcing Processes
        </Typography>

        <Typography
          variant="body2"
          sx={{
            fontFamily: 'monospace',
            color: theme.palette.text.secondary,
            letterSpacing: '0.05em',
            userSelect: 'all',
          }}
        >
          graph6: { graph.graph6String }
        </Typography>

        <Stack spacing={ 1 } direction="row" alignItems="center">
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

        <Tooltip title={ graph.settings.showLabels ? 'Hide Vertex Labels' : 'Show Vertex Labels' } placement="bottom">
          <IconButton
            size="small"
            onClick={ graph.settings.toggleShowLabels }
            sx={{
              color: graph.settings.showLabels ? theme.palette.primary.main : theme.palette.text.primary,
              transition: 'color 250ms',
              '&:hover': { color: theme.palette.primary.main }
            }}
          ><LabelIcon /></IconButton>
        </Tooltip>

        <Tooltip title="View Settings" placement="bottom">
          <IconButton
            size="small"
            onClick={ toggleDrawer }
            sx={{ color: drawerOpen ? theme.palette.primary.main : theme.palette.text.primary }}
          >{ drawerOpen ? <CloseDrawerIcon /> : <SettingsIcon /> }</IconButton>
        </Tooltip>
        </Stack>
      </Stack>
    </AppBar>
  )
}

Toolbar.propTypes = {
  toggleDrawer: PropTypes.func.isRequired,
  drawerOpen: PropTypes.bool.isRequired,
}
