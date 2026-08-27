import { AppBar, IconButton, Stack, Tooltip, Typography, useTheme } from '@mui/material'
import {
  Close as CloseDrawerIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  Code as TikzIcon,
  Edit as DrawIcon,
  Label as LabelIcon,
  Refresh as RedrawIcon,
  RestartAlt as ResetGraphIcon,
} from '@mui/icons-material'
import { useGraph } from './graph'
import { useApp } from '../context'
import { generateTikz } from '../lib/tikz'

export const Toolbar = () => {
  const theme = useTheme()
  const { analysisPanel } = useApp()
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

  const downloadTikz = () => {
    if (!graph) { return }
    const tikzContent = generateTikz(
      graph.nodes,
      graph.edges,
      graph.coloredNodes,
      graph.settings.color,
    )
    const blob = new Blob([tikzContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = 'graph.tex'
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AppBar position="static" sx={{ backgroundColor: theme.palette.background.paper, zIndex: 2 }}>
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

        <Tooltip title="Reset Graph" placement="bottom">
          <IconButton
            size="small"
            onClick={ graph.resetGraph }
            sx={{
              color: theme.palette.text.primary,
              transition: 'color 250ms',
              '&:hover': { color: theme.palette.primary.main }
            }}
          ><ResetGraphIcon /></IconButton>
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

        <Tooltip title="Download Graph as TikZ (.tex)" placement="bottom">
          <IconButton
            size="small"
            onClick={ downloadTikz }
            sx={{
              color: theme.palette.text.primary,
              transition: 'color 250ms',
              '&:hover': { color: theme.palette.primary.main }
            }}
          ><TikzIcon /></IconButton>
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

        <Tooltip title={ analysisPanel.drawerOpen ? 'Hide analysis panel' : 'Show analysis panel' } placement="bottom">
          <IconButton
            size="small"
            onClick={ analysisPanel.toggleDrawer }
            aria-label={ analysisPanel.drawerOpen ? 'Close analysis panel' : 'Open analysis panel' }
            aria-controls="analysis-panel"
            aria-expanded={ analysisPanel.drawerOpen }
            sx={{ color: analysisPanel.drawerOpen ? theme.palette.primary.main : theme.palette.text.primary }}
          >{ analysisPanel.drawerOpen ? <CloseDrawerIcon /> : <SettingsIcon /> }</IconButton>
        </Tooltip>
        </Stack>
      </Stack>
    </AppBar>
  )
}
