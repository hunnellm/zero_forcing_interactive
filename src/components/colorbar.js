import { useMemo } from 'react'
import { Box, Button, IconButton, Stack, Tooltip, Typography, useTheme } from '@mui/material'
import {
  CheckCircle as CheckIcon,
  Circle as CircleIcon,
  Undo as ResetIcon,
  SkipPrevious as StepBackIcon,
  SkipNext as StepIcon,
} from '@mui/icons-material'
import { useGraph } from './graph'
import { useApp } from '../context'

export const Colorbar = () => {
  const theme = useTheme()
  const { compact } = useApp()
  const { colorStep, stepBack, canStepBack, graph } = useGraph()

  const conditionalStyles = useMemo(() => compact ? ({
      bottom: 0,
      left: 0,
      width: '100%',
      borderRadius: 0,
    }) : ({
      bottom: '2rem',
      left: '2rem',
      width: 'calc(100% - 4rem)',
      borderRadius: theme.shape.borderRadius / 2,  
    }), [compact])

  if (graph.drawMode) {
    return (
      <Box sx={{
        position: 'absolute',
        boxSizing: 'border-box',
        backgroundColor: theme.palette.background.paper,
        transition: 'filter 250ms',
        filter: 'opacity(0.8)',
        '&:hover': { filter: 'opacity(1.0)' },
        padding: theme.spacing(2),
        zIndex: 9,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        ...conditionalStyles,
      }}>
        <Typography color="text.secondary" variant="body2">
          Draw mode: click the canvas to add a node · click a node then another to add an edge
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{
      position: 'absolute',
      boxSizing: 'border-box',
      backgroundColor: theme.palette.background.paper,
      transition: 'filter 250ms',
      filter: 'opacity(0.8)',
      '&:hover': {
        filter: 'opacity(1.0)',
      },
      padding: theme.spacing(2),
      zIndex: 9,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      ...conditionalStyles,
    }}>
      <Stack spacing={ 1 } direction="row" alignItems="center">
        <Box sx={{ width: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {
            graph.coloredNodes.size === graph.nodes.length ? (
              <Tooltip title="All Nodes are Colored!" placement="bottom">
                <CheckIcon sx={{ color: theme.palette.text.primary }} fontSize="medium" />
              </Tooltip>
            ) : <CircleIcon sx={{ color: theme.palette.text.secondary }} fontSize="small" />
          }
        </Box>
        <Typography component={ Stack } justifyContent="center" color="text.primary">
          { graph.coloredNodes.size } of { graph.nodes.length } colored nodes
        </Typography>
      </Stack>
      <Stack spacing={ 2 } direction="row">
        <Tooltip title="Reset Coloring" placement="top">
          <Stack justifyContent="center">
            <IconButton
              color="primary"
              size="small"
              onClick={ graph.uncolorAllNodes }
              disabled={ graph.coloredNodes.size === 0 }
            ><ResetIcon fontSize="small" /></IconButton>
          </Stack>
        </Tooltip>
        <Tooltip title="Step Back" placement="top">
          <Stack justifyContent="center">
            <IconButton
              color="primary"
              size="small"
              onClick={ stepBack }
              disabled={ !canStepBack }
            ><StepBackIcon fontSize="small" /></IconButton>
          </Stack>
        </Tooltip>
        <Tooltip title="Apply Coloring Rule" placement="top">
          <Button
            variant="contained"
            color="primary"
            endIcon={ <StepIcon /> }
            onClick={ colorStep }
            sx={{ padding: '1rem' }}
          >Step</Button>
        </Tooltip>
      </Stack>
    </Box>
  )
}
