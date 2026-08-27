import PropTypes from 'prop-types'
import { Alert, Box, Button, Chip, CircularProgress, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { SkipNext as NextIcon, SkipPrevious as PreviousIcon } from '@mui/icons-material'
import { useGraph } from './graph'
import { COMPUTE_STATUS, NUMBER_VARIANTS, SET_VARIANTS } from '../lib/forcing-analysis-shared'

const formatElapsed = elapsedMs => `${(elapsedMs / 1000).toFixed(1)}s`

const StatusRow = ({ status, elapsedMs, error, onCancel }) => {
  if (status === COMPUTE_STATUS.RUNNING) {
    return (
      <Stack direction="row" spacing={ 1 } alignItems="center" flexWrap="wrap">
        <CircularProgress size={ 18 } />
        <Typography variant="body2" color="text.secondary">
          Computing… {formatElapsed(elapsedMs)}
        </Typography>
        <Button size="small" onClick={ onCancel }>Cancel</Button>
      </Stack>
    )
  }

  if (status === COMPUTE_STATUS.ERROR) {
    return <Alert severity="error">{ error }</Alert>
  }

  if (status === COMPUTE_STATUS.CANCELLED) {
    return <Alert severity="info">Computation cancelled.</Alert>
  }

  return null
}

StatusRow.propTypes = {
  status: PropTypes.string.isRequired,
  elapsedMs: PropTypes.number.isRequired,
  error: PropTypes.string,
  onCancel: PropTypes.func.isRequired,
}

export const ComputationPanel = () => {
  const { graph } = useGraph()
  const numberAnalysis = graph.analysis.number
  const setsAnalysis = graph.analysis.sets
  const displayedSets = setsAnalysis.result?.sets || []
  const activeSet = setsAnalysis.activeSet || []

  return (
    <Stack spacing={ 1.5 } sx={{ width: '100%' }}>
      <Box sx={{
        border: theme => `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        px: 1.5,
        py: 1.25,
      }}>
        <Stack spacing={ 1.25 }>
          <Stack direction="row" spacing={ 1 } alignItems="center" flexWrap="wrap">
            <Typography variant="subtitle2">Compute selected value</Typography>
            { numberAnalysis.result && numberAnalysis.stale && <Chip size="small" color="warning" label="Stale" /> }
          </Stack>

          <ToggleButtonGroup
            color="primary"
            size="small"
            exclusive
            value={ numberAnalysis.variant }
            onChange={ (event, nextVariant) => {
              if (nextVariant) {
                numberAnalysis.setVariant(nextVariant)
              }
            } }
          >
            <ToggleButton value={ NUMBER_VARIANTS.FAULT_TOLERANT }>fault-tolerant</ToggleButton>
            <ToggleButton value={ NUMBER_VARIANTS.PROPORTIONAL }>ProportionalZeroForcing</ToggleButton>
            <ToggleButton value={ NUMBER_VARIANTS.MAXIMUM_NULLITY }>maximum-nullity</ToggleButton>
          </ToggleButtonGroup>

          {
            numberAnalysis.variant === NUMBER_VARIANTS.PROPORTIONAL && (
              <Typography variant="body2" color="text.secondary">
                Using α={ graph.forcing.alpha } and β={ graph.forcing.beta } from the transmission controls.
              </Typography>
            )
          }

          <Stack direction="row" spacing={ 1 } alignItems="center" flexWrap="wrap">
            <Button
              variant="outlined"
              size="small"
              onClick={ numberAnalysis.compute }
              disabled={ numberAnalysis.status === COMPUTE_STATUS.RUNNING }
            >
              Compute value
            </Button>
            { numberAnalysis.status === COMPUTE_STATUS.SUCCESS && (
              <Typography variant="body2" color="text.secondary">
                Finished in { formatElapsed(numberAnalysis.elapsedMs) }
              </Typography>
            ) }
          </Stack>

          <StatusRow
            status={ numberAnalysis.status }
            elapsedMs={ numberAnalysis.elapsedMs }
            error={ numberAnalysis.error }
            onCancel={ numberAnalysis.cancel }
          />

          {
            numberAnalysis.result && (
              <Stack spacing={ 0.5 }>
                <Typography variant="body1">
                  { numberAnalysis.result.label }: <strong>{ numberAnalysis.result.value }</strong>
                </Typography>
                {
                  numberAnalysis.stale && (
                    <Typography variant="body2" color="warning.main">
                      The displayed result was computed for a different graph or variant. Recompute to refresh it.
                    </Typography>
                  )
                }
              </Stack>
            )
          }
        </Stack>
      </Box>

      <Box sx={{
        border: theme => `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        px: 1.5,
        py: 1.25,
      }}>
        <Stack spacing={ 1.25 }>
          <Stack direction="row" spacing={ 1 } alignItems="center" flexWrap="wrap">
            <Typography variant="subtitle2">Compute minimum forcing sets up to graph automorphism</Typography>
            { setsAnalysis.result && setsAnalysis.stale && <Chip size="small" color="warning" label="Stale" /> }
          </Stack>

          <ToggleButtonGroup
            color="primary"
            size="small"
            exclusive
            value={ setsAnalysis.variant }
            onChange={ (event, nextVariant) => {
              if (nextVariant) {
                setsAnalysis.setVariant(nextVariant)
              }
            } }
          >
            <ToggleButton value={ SET_VARIANTS.STANDARD }>standard</ToggleButton>
            <ToggleButton value={ SET_VARIANTS.PSD }>psd</ToggleButton>
          </ToggleButtonGroup>

          <Stack direction="row" spacing={ 1 } alignItems="center" flexWrap="wrap">
            <Button
              variant="outlined"
              size="small"
              onClick={ setsAnalysis.compute }
              disabled={ setsAnalysis.status === COMPUTE_STATUS.RUNNING }
            >
              Compute minimum sets
            </Button>
            { setsAnalysis.status === COMPUTE_STATUS.SUCCESS && (
              <Typography variant="body2" color="text.secondary">
                Finished in { formatElapsed(setsAnalysis.elapsedMs) }
              </Typography>
            ) }
          </Stack>

          <StatusRow
            status={ setsAnalysis.status }
            elapsedMs={ setsAnalysis.elapsedMs }
            error={ setsAnalysis.error }
            onCancel={ setsAnalysis.cancel }
          />

          {
            setsAnalysis.result && (
              <Stack spacing={ 0.75 }>
                <Typography variant="body1">
                  Minimum set size: <strong>{ setsAnalysis.result.number }</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Showing { displayedSets.length } representative set{ displayedSets.length === 1 ? '' : 's' }.
                </Typography>
                {
                  setsAnalysis.result.truncated && (
                    <Alert severity="warning">
                      Showing only the first { graph.analysis.constants.maxDisplayedMinimumSets } representative sets for this graph and variant.
                    </Alert>
                  )
                }
                {
                  setsAnalysis.stale && (
                    <Typography variant="body2" color="warning.main">
                      The displayed sets were computed for a different graph or variant. Recompute to refresh them.
                    </Typography>
                  )
                }
                {
                  displayedSets.length > 0 && (
                    <>
                      <Stack direction="row" spacing={ 1 } alignItems="center">
                        <Button
                          size="small"
                          startIcon={ <PreviousIcon /> }
                          onClick={ setsAnalysis.previous }
                          disabled={ setsAnalysis.activeIndex <= 0 }
                        >
                          Previous
                        </Button>
                        <Typography variant="body2">
                          Set { setsAnalysis.activeIndex + 1 } of { displayedSets.length }
                        </Typography>
                        <Button
                          size="small"
                          endIcon={ <NextIcon /> }
                          onClick={ setsAnalysis.next }
                          disabled={ setsAnalysis.activeIndex >= displayedSets.length - 1 }
                        >
                          Next
                        </Button>
                      </Stack>
                      <Typography variant="body2">
                        Active set vertices: <strong>{ activeSet.length > 0 ? activeSet.join(', ') : '∅' }</strong>
                      </Typography>
                    </>
                  )
                }
              </Stack>
            )
          }
        </Stack>
      </Box>
    </Stack>
  )
}
