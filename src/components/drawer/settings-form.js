import { useMemo } from 'react'
import { Box, FormControl, FormControlLabel, FormLabel, Slider, Stack, Switch, Typography, useTheme } from '@mui/material'
import { HexColorPicker } from 'react-colorful'
import { useGraph } from '../graph'
import { useApp } from '../../context'

export const SettingsForm = () => {
  const theme = useTheme()
  const { graph } = useGraph()
  const { MODES, mode, setMode } = useApp()

  const switchStyle = useMemo(() => ({
    width: 62,
    height: 34,
    '& .MuiSwitch-switchBase': {
      padding: 0,
      transform: 'translateX(6px)',
      '&.Mui-checked': {
        color: '#fff',
        transform: 'translateX(22px)',
        '& .MuiSwitch-thumb:before': {
          backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 24 24"><path fill="${encodeURIComponent(
            '#fff',
          )}" d="m 14.368073,22 c 1.82,0 3.53,-0.5 5,-1.35 -2.99,-1.73 -5,-4.95 -5,-8.65 0,-3.7 2.01,-6.92 5,-8.65 -1.47,-0.85 -3.18,-1.35 -5,-1.35 -5.5199999,0 -9.9999999,4.48 -9.9999999,10 0,5.52 4.48,10 9.9999999,10 z"/></svg>')`,
        },
        '& + .MuiSwitch-track': {
          opacity: 1,
          backgroundColor: theme.palette.background.default,
        },
      },
    },
    '& .MuiSwitch-thumb': {
      backgroundColor: theme.palette.primary.dark,
      width: 32,
      height: 32,
      '&:before': {
        content: "''",
        position: 'absolute',
        width: '100%',
        height: '100%',
        left: 0,
        top: 0,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
          '#fff',
        )}" d="M9.305 1.667V3.75h1.389V1.667h-1.39zm-4.707 1.95l-.982.982L5.09 6.072l.982-.982-1.473-1.473zm10.802 0L13.927 5.09l.982.982 1.473-1.473-.982-.982zM10 5.139a4.872 4.872 0 00-4.862 4.86A4.872 4.872 0 0010 14.862 4.872 4.872 0 0014.86 10 4.872 4.872 0 0010 5.139zm0 1.389A3.462 3.462 0 0113.471 10a3.462 3.462 0 01-3.473 3.472A3.462 3.462 0 016.527 10 3.462 3.462 0 0110 6.528zM1.665 9.305v1.39h2.083v-1.39H1.666zm14.583 0v1.39h2.084v-1.39h-2.084zM5.09 13.928L3.616 15.4l.982.982 1.473-1.473-.982-.982zm9.82 0l-.982.982 1.473 1.473.982-.982-1.473-1.473zM9.305 16.25v2.083h1.389V16.25h-1.39z"/></svg>')`,
      },
    },
    '& .MuiSwitch-track': {
      opacity: 1,
      backgroundColor: theme.palette.background.default,
      borderRadius: 20 / 2,
    },
  }), [mode])
  
  return (
    <Box>
      <Stack direction="column" spacing={ 4 }>

        <Typography variant="h2" sx={{ flex: 1, fontSize: '135%' }}>Application Settings</Typography>

        <FormControl sx={{ flexDirection: 'row', gap: '2rem' }}>
          <FormLabel sx={{ paddingTop: '4px' }}>Color Mode</FormLabel>
          <FormControlLabel
            control={
              <Switch
                checked={ mode === MODES.dark }
                onChange={ () => setMode(event.target.checked ? MODES.dark : MODES.light) }
                sx={ switchStyle }
              />
            }
            label={ mode[0].toUpperCase() + mode.slice(1).toLowerCase() }
          />
        </FormControl>

        <Typography variant="h2" sx={{ flex: 1, fontSize: '135%' }}>Graph Settings</Typography>

        <FormControl sx={{ flexDirection: 'row', gap: '2rem' }}>
          <FormLabel color="primary">Auto Redraw</FormLabel>
          <FormControlLabel
            control={
              <Switch
                checked={ graph.settings.autoRedraw }
                onChange={ graph.settings.toggleAutoRedraw }
              />
            }
            label={ graph.settings.autoRedraw ? 'On' : 'Off' }
          />
        </FormControl>

        <FormControl sx={{ flexDirection: 'row', gap: '2rem' }}>
          <FormLabel color="primary">Node Size</FormLabel>
          <Slider
            aria-label="Node size"
            track={ false }
            step={ 1 } marks min={ 1 } max={ 20 }
            valueLabelDisplay="on"
            getAriaValueText={ () => `${ graph.settings.nodeSize } px node radius` }
            value={ graph.settings.nodeSize }
            onChange={ (event, newValue) => graph.settings.setNodeSize(newValue) }
            sx={{ width: '100%', maxWidth: '300px' }}
          />
        </FormControl>

        <FormControl sx={{
          flexDirection: 'row',
          gap: '1rem',
          '& .MuiFormLabel-root': {
            width: '100px',
          },
          '& .react-colorful': {
            width: '100%',
            height: '150px',
            maxWidth: '400px',
          }
        }}>
          <FormLabel color="primary">Node Color</FormLabel>
          <HexColorPicker
            color={ graph.settings.color }
            onChange={ graph.settings.setColor }
          />
        </FormControl>

      </Stack>
    </Box>
  )
}