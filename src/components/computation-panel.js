import PropTypes from 'prop-types'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import {
  ExpandMore as ExpandMoreIcon,
  SkipNext as NextIcon,
  SkipPrevious as PreviousIcon,
} from '@mui/icons-material'
import { useGraph } from './graph'
import { ANALYSIS_CARD_KEYS } from './analysis-panel-state'
import { createAnalysisHeaderMeta } from './computation-panel-shared'
import { COMPUTE_STATUS, NUMBER_VARIANTS, SET_VARIANTS } from '../lib/forcing-analysis-shared'

const NUMBER_VARIANT_LABELS = {
  [NUMBER_VARIANTS.FAULT_TOLERANT]: 'fault-tolerant',
  [NUMBER_VARIANTS.PROPORTIONAL]: 'ProportionalZeroForcing',
  [NUMBER_VARIANTS.MAXIMUM_NULLITY]: 'maximum-nullity',
}

const SET_VARIANT_LABELS = {
  [SET_VARIANTS.STANDARD]: 'standard',
  [SET_VARIANTS.PSD]: 'psd',
}

const stopAccordionToggle = callback => event => {
  event.stopPropagation()
  callback()
}

const AnalysisAccordionHeader = ({
  title,
  variantLabel,
  headerMeta,
  computeLabel,
  onCompute,
  onCancel,
}) => (
  <Stack
    direction="row"
    spacing={ 1 }
    alignItems="center"
    justifyContent="space-between"
    flexWrap="wrap"
    sx={{ width: '100%', pr: 1 }}
  >
    <Stack spacing={ 0.75 } sx={{ minWidth: 0, flex: 1 }}>
      <Typography variant="subtitle2">{ title }</Typography>
      <Stack direction="row" spacing={ 0.75 } alignItems="center" flexWrap="wrap">
        <Chip size="small" variant="outlined" label={ variantLabel } />
        { headerMeta.showProgress && <CircularProgress size={ 14 } /> }
        <Chip size="small" color={ headerMeta.statusChip.color } label={ headerMeta.statusChip.label } />
        { headerMeta.showStale && <Chip size="small" color="warning" label="Stale" /> }
        { headerMeta.elapsedLabel && (
          <Typography variant="caption" color="text.secondary">
            { headerMeta.elapsedLabel }
          </Typography>
        ) }
      </Stack>
    </Stack>

    <Stack direction="row" spacing={ 1 } alignItems="center" onClick={ event => event.stopPropagation() }>
      {
        headerMeta.showCancel ? (
          <Button size="small" color="warning" onClick={ stopAccordionToggle(onCancel) }>
            Cancel
          </Button>
        ) : (
          <Button size="small" variant="outlined" onClick={ stopAccordionToggle(onCompute) }>
            { computeLabel }
          </Button>
        )
      }
    </Stack>
  </Stack>
)

AnalysisAccordionHeader.propTypes = {
  title: PropTypes.string.isRequired,
  variantLabel: PropTypes.string.isRequired,
  headerMeta: PropTypes.shape({
    elapsedLabel: PropTypes.string,
    showCancel: PropTypes.bool.isRequired,
    showProgress: PropTypes.bool.isRequired,
    showStale: PropTypes.bool.isRequired,
    statusChip: PropTypes.shape({
      color: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
  computeLabel: PropTypes.string.isRequired,
  onCompute: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}

export const ComputationPanel = ({ analysisPanel }) => {
  const { graph } = useGraph()
  const numberAnalysis = graph.analysis.number
  const setsAnalysis = graph.analysis.sets
  const displayedSets = setsAnalysis.result?.sets || []
  const activeSet = setsAnalysis.activeSet || []
  const numberHeaderMeta = createAnalysisHeaderMeta(numberAnalysis)
  const setsHeaderMeta = createAnalysisHeaderMeta(setsAnalysis)

  return (
    <Stack spacing={ 1.5 } sx={{ width: '100%' }}>
      <Accordion
        disableGutters
        square={ false }
        expanded={ analysisPanel.expandedCard === ANALYSIS_CARD_KEYS.VALUE }
        onChange={ () => analysisPanel.toggleExpandedCard(ANALYSIS_CARD_KEYS.VALUE) }
      >
        <AccordionSummary expandIcon={ <ExpandMoreIcon /> }>
          <AnalysisAccordionHeader
            title="Selected value"
            variantLabel={ NUMBER_VARIANT_LABELS[numberAnalysis.variant] }
            headerMeta={ numberHeaderMeta }
            computeLabel="Compute"
            onCompute={ numberAnalysis.compute }
            onCancel={ numberAnalysis.cancel }
          />
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Box
            ref={ node => analysisPanel.restoreScrollPosition(ANALYSIS_CARD_KEYS.VALUE, node) }
            onScroll={ analysisPanel.rememberScrollPosition(ANALYSIS_CARD_KEYS.VALUE) }
            sx={{ maxHeight: 320, overflowY: 'auto', pr: 0.5 }}
          >
            <Stack spacing={ 1.25 }>
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

              { numberAnalysis.status === COMPUTE_STATUS.ERROR && <Alert severity="error">{ numberAnalysis.error }</Alert> }
              { numberAnalysis.status === COMPUTE_STATUS.CANCELLED && <Alert severity="info">Computation cancelled.</Alert> }

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
        </AccordionDetails>
      </Accordion>

      <Accordion
        disableGutters
        square={ false }
        expanded={ analysisPanel.expandedCard === ANALYSIS_CARD_KEYS.MINIMUM_SETS }
        onChange={ () => analysisPanel.toggleExpandedCard(ANALYSIS_CARD_KEYS.MINIMUM_SETS) }
      >
        <AccordionSummary expandIcon={ <ExpandMoreIcon /> }>
          <AnalysisAccordionHeader
            title="Minimum forcing sets"
            variantLabel={ SET_VARIANT_LABELS[setsAnalysis.variant] }
            headerMeta={ setsHeaderMeta }
            computeLabel="Compute"
            onCompute={ setsAnalysis.compute }
            onCancel={ setsAnalysis.cancel }
          />
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Box
            ref={ node => analysisPanel.restoreScrollPosition(ANALYSIS_CARD_KEYS.MINIMUM_SETS, node) }
            onScroll={ analysisPanel.rememberScrollPosition(ANALYSIS_CARD_KEYS.MINIMUM_SETS) }
            sx={{ maxHeight: 360, overflowY: 'auto', pr: 0.5 }}
          >
            <Stack spacing={ 1.25 }>
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

              { setsAnalysis.status === COMPUTE_STATUS.ERROR && <Alert severity="error">{ setsAnalysis.error }</Alert> }
              { setsAnalysis.status === COMPUTE_STATUS.CANCELLED && <Alert severity="info">Computation cancelled.</Alert> }

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
                          <Stack direction="row" spacing={ 1 } alignItems="center" flexWrap="wrap">
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
        </AccordionDetails>
      </Accordion>
    </Stack>
  )
}

ComputationPanel.propTypes = {
  analysisPanel: PropTypes.shape({
    expandedCard: PropTypes.string,
    rememberScrollPosition: PropTypes.func.isRequired,
    restoreScrollPosition: PropTypes.func.isRequired,
    toggleExpandedCard: PropTypes.func.isRequired,
  }).isRequired,
}
