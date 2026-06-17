import { useState } from 'react'
import {
  Box, Button, IconButton, Menu, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography
} from '@mui/material'
import {
  RestartAlt as ResetIcon,
  KeyboardArrowDown as MenuOpenIcon,
} from '@mui/icons-material'
import { useGraph } from '../graph'
import { Matrix } from 'ml-matrix'
import matrices from '../../lib/matrices'
import { parseGraph6 } from '../../lib/graph6'

const matrixToInput = m => m.map(row => row.join()).join('\n')
const inputToMatrix = input => input
  .replace(/[^\S\r\n]/g, '')
  .split(/\n/)
  .map(row => row.split(',')
    .map(x => parseInt(x))
  )

const ITEM_HEIGHT = 48
const inputModes = {
  matrix: 'matrix',
  graph6: 'graph6',
}

export const MatrixEditor = () => {
  const { graph } = useGraph()
  const [textContent, setTextContent] = useState(matrixToInput(graph.adjacencyMatrix.data))
  const [graph6Content, setGraph6Content] = useState('')
  const [inputMode, setInputMode] = useState(inputModes.matrix)
  const [error, setError] = useState(null)
  const [showResetButton, setShowResetButton] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState(null)
  const menuOpen = Boolean(menuAnchorEl)

  const handleClickValidate = () => {
    setError(null)
    try {
      const inputArray = inputMode === inputModes.graph6
        ? parseGraph6(graph6Content)
        : inputToMatrix(textContent)
      const newMatrix = new Matrix(inputArray)
      if (!newMatrix.isSquare()) {
        throw new Error('Matrix must be square')
      }
      if (!newMatrix.isSymmetric()) {
        throw new Error('Matrix must be symmetric')
      }
      graph.setMatrix(inputArray)
      graph.uncolorAllNodes()
      setShowResetButton(false)
    } catch (error) {
      if (inputMode === inputModes.graph6) {
        setError(new Error(`Invalid graph6 input: ${ error.message }`))
        return
      }
      setError(error)
    }
  }

  const handleChangeInputMode = (event, newMode) => {
    if (!newMode) {
      return
    }
    setError(null)
    setInputMode(newMode)
  }

  const handleChangeText = event => {
    setShowResetButton(true)
    setTextContent(event.target.value)
  }

  const handleChangeGraph6Text = event => {
    setGraph6Content(event.target.value)
  }

  const handleClickResetMatrix = () => {
    setShowResetButton(false)
    setTextContent(matrixToInput(graph.adjacencyMatrix.data))
  }

  const handleSelectPresetMatrix = graphName => () => {
    setShowResetButton(true)
    handleCloseMenu()
    setTextContent(matrixToInput(matrices[graphName]))
  }

  const handleClickOpenMenu = event => setMenuAnchorEl(event.target)
  const handleCloseMenu = () => setMenuAnchorEl(null)

  return (
    <Stack spacing={ 2 } alignItems="stretch">
      <Stack direction="row" justifyContent="space-between" spacing={ 2 }>
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <Typography variant="h2" sx={{ flex: 1, fontSize: '135%' }}>Graph Input</Typography>
          <ToggleButtonGroup
            color="primary"
            value={ inputMode }
            exclusive
            onChange={ handleChangeInputMode }
            size="small"
          >
            <ToggleButton value={ inputModes.matrix }>Adjacency Matrix</ToggleButton>
            <ToggleButton value={ inputModes.graph6 }>graph6 String</ToggleButton>
          </ToggleButtonGroup>
          {
            inputMode === inputModes.matrix && (
              <>
                {
                  showResetButton && (
                    <Tooltip title="Reset matrix" placement="left">
                      <IconButton
                        color="primary"
                        onClick={ handleClickResetMatrix }
                      ><ResetIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  )
                }
                <Button
                  color="primary"
                  variant="outlined"
                  onClick={ handleClickOpenMenu }
                  endIcon={ <MenuOpenIcon /> }
                >Presets</Button>
                <Menu
                  value=""
                  onChange={ handleSelectPresetMatrix }
                  anchorEl={ menuAnchorEl }
                  open={ menuOpen }
                  onClose={ handleCloseMenu }
                  PaperProps={{
                    style: {
                      maxHeight: ITEM_HEIGHT * 8,
                      width: '20ch',
                    },
                  }}            
                >
                  {
                    Object.keys(matrices).map(name => (
                      <MenuItem
                        key={ `matrix-option-${ name }` }
                        onClick={ handleSelectPresetMatrix(name) }
                      >{ name }</MenuItem>
                    ))
                  }
                </Menu>
              </>
            )
          }
        </Box>
      </Stack>
      
      <Box>
        {
          inputMode === inputModes.matrix ? (
            <TextField
              multiline
              fullWidth
              rows={ Math.min(20, textContent.split('\n').length) }
              value={ textContent }
              onChange={ handleChangeText }
              inputProps={{ sx: { fontFamily: 'monospace', lineHeight: 1.5, fontSize: '75%' } }}
            />
          ) : (
            <TextField
              fullWidth
              value={ graph6Content }
              onChange={ handleChangeGraph6Text }
              placeholder="e.g. Dhc"
              helperText='Enter a graph6 string (for example, "Dhc" for a 5-cycle)'
              inputProps={{ sx: { fontFamily: 'monospace', lineHeight: 1.5, fontSize: '75%' } }}
            />
          )
        }
        <br />
        {
          error && <Typography color="pink">{ error.message }</Typography>
        }
        <br />
        <Button
          fullWidth
          variant="contained"
          onClick={ handleClickValidate }
        >Generate Graph</Button>
      </Box>
    </Stack>
  )
}
