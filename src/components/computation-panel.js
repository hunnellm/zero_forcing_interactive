import PropTypes from 'prop-types'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
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
import { ADVANCED_VARIANTS, COMPUTE_STATUS, NUMBER_VARIANTS, SET_VARIANTS } from '../lib/forcing-analysis-shared'

const NUMBER_VARIANT_LABELS = {
  [NUMBER_VARIANTS.FAULT_TOLERANT]: 'fault-tolerant',
  [NUMBER_VARIANTS.PROPORTIONAL]: 'ProportionalZeroForcing',
  [NUMBER_VARIANTS.MAXIMUM_NULLITY]: 'maximum-nullity',
}

const SET_VARIANT_LABELS = {
  [SET_VARIANTS.STANDARD]: 'standard',
  [SET_VARIANTS.PSD]: 'psd',
  [SET_VARIANTS.FAULT_TOLERANT]: 'fault-tolerant',
}

const LOOP_VARIANT_LABELS = {
  [ADVANCED_VARIANTS.LOOPED]: 'looped forcing',
  [ADVANCED_VARIANTS.MAXIMUM_LOOPED]: 'maximum looped forcing',
  [ADVANCED_VARIANTS.FORT]: 'loop forts',
  [ADVANCED_VARIANTS.BLOCKING_SETS]: 'loop blocking sets',
}

// Loop vertex selection only applies to variants that operate on a fixed
// loop configuration; "maximum looped forcing" searches over every possible
// configuration instead.
const REQUIRES_LOOP_SELECTION = new Set([
  ADVANCED_VARIANTS.LOOPED,
  ADVANCED_VARIANTS.FORT,
  ADVANCED_VARIANTS.BLOCKING_SETS,
])

const formatVertexSet = vertices => (vertices.length > 0 ? vertices.join(', ') : '∅')

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
  const loopAnalysis = graph.analysis.loop
  const displayedSets = setsAnalysis.result?.sets || []
  const activeSet = setsAnalysis.activeSet || []
  const numberHeaderMeta = createAnalysisHeaderMeta(numberAnalysis)
  const setsHeaderMeta = createAnalysisHeaderMeta(setsAnalysis)
  const loopHeaderMeta = createAnalysisHeaderMeta(loopAnalysis)
  const vertexCount = graph.adjacencyMatrix.rows
  const loopSelectionRequired = REQUIRES_LOOP_SELECTION.has(loopAnalysis.variant)

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
                <ToggleButton value={ SET_VARIANTS.FAULT_TOLERANT }>fault-tolerant</ToggleButton>
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

      <Accordion
        disableGutters
        square={ false }
        expanded={ analysisPanel.expandedCard === ANALYSIS_CARD_KEYS.LOOP }
        onChange={ () => analysisPanel.toggleExpandedCard(ANALYSIS_CARD_KEYS.LOOP) }
      >
        <AccordionSummary expandIcon={ <ExpandMoreIcon /> }>
          <AnalysisAccordionHeader
            title="Looped forcing & fort analysis"
            variantLabel={ LOOP_VARIANT_LABELS[loopAnalysis.variant] }
            headerMeta={ loopHeaderMeta }
            computeLabel="Compute"
            onCompute={ loopAnalysis.compute }
            onCancel={ loopAnalysis.cancel }
          />
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Box
            ref={ node => analysisPanel.restoreScrollPosition(ANALYSIS_CARD_KEYS.LOOP, node) }
            onScroll={ analysisPanel.rememberScrollPosition(ANALYSIS_CARD_KEYS.LOOP) }
            sx={{ maxHeight: 360, overflowY: 'auto', pr: 0.5 }}
          >
            <Stack spacing={ 1.25 }>
              {
                loopAnalysis.backendAvailable === false && (
                  <Alert severity="warning">
                    The enhanced zero forcing backend is unavailable. Start it with <code>npm run server</code> to
                    enable looped forcing, maximum looped forcing, and fort/blocking-set analysis.
                  </Alert>
                )
              }

              <ToggleButtonGroup
                color="primary"
                size="small"
                exclusive
                value={ loopAnalysis.variant }
                onChange={ (event, nextVariant) => {
                  if (nextVariant) {
                    loopAnalysis.setVariant(nextVariant)
                  }
                } }
              >
                <ToggleButton value={ ADVANCED_VARIANTS.LOOPED }>looped forcing</ToggleButton>
                <ToggleButton value={ ADVANCED_VARIANTS.MAXIMUM_LOOPED }>maximum looped</ToggleButton>
                <ToggleButton value={ ADVANCED_VARIANTS.FORT }>loop forts</ToggleButton>
                <ToggleButton value={ ADVANCED_VARIANTS.BLOCKING_SETS }>blocking sets</ToggleButton>
              </ToggleButtonGroup>

              {
                loopSelectionRequired && vertexCount > 0 && (
                  <Stack spacing={ 0.5 }>
                    <Typography variant="body2" color="text.secondary">
                      Looped vertices (vertices that carry a loop in this configuration):
                    </Typography>
                    <Stack direction="row" flexWrap="wrap">
                      {
                        [...Array(vertexCount).keys()].map(i => (
                          <FormControlLabel
                            key={ i }
                            control={
                              <Checkbox
                                size="small"
                                checked={ loopAnalysis.loopedVertices.has(i) }
                                onChange={ () => loopAnalysis.toggleLoopedVertex(i) }
                              />
                            }
                            label={ `${ i }` }
                          />
                        ))
                      }
                    </Stack>
                  </Stack>
                )
              }

              { loopAnalysis.status === COMPUTE_STATUS.ERROR && <Alert severity="error">{ loopAnalysis.error }</Alert> }
              { loopAnalysis.status === COMPUTE_STATUS.CANCELLED && <Alert severity="info">Computation cancelled.</Alert> }

              {
                loopAnalysis.result && loopAnalysis.variant === ADVANCED_VARIANTS.LOOPED && (
                  <Stack spacing={ 0.5 }>
                    <Typography variant="body1">
                      Looped zero forcing number: <strong>{ loopAnalysis.result.number }</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      { loopAnalysis.result.sets.length } minimum set{ loopAnalysis.result.sets.length === 1 ? '' : 's' }: {
                        loopAnalysis.result.sets.map(set => `{${ formatVertexSet(set) }}`).join(', ')
                      }
                    </Typography>
                  </Stack>
                )
              }

              {
                loopAnalysis.result && loopAnalysis.variant === ADVANCED_VARIANTS.MAXIMUM_LOOPED && (
                  <Stack spacing={ 0.5 }>
                    <Typography variant="body1">
                      Maximum looped zero forcing number: <strong>{ loopAnalysis.result.number }</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Achieved by { loopAnalysis.result.configurations.length } loop configuration{ loopAnalysis.result.configurations.length === 1 ? '' : 's' }, including {
                        loopAnalysis.result.configurations.slice(0, 5).map(cfg => `{${ formatVertexSet(cfg.loopedVertices) }}`).join(', ')
                      }.
                    </Typography>
                  </Stack>
                )
              }

              {
                loopAnalysis.result && loopAnalysis.variant === ADVANCED_VARIANTS.FORT && (
                  <Stack spacing={ 0.5 }>
                    <Typography variant="body1">
                      { loopAnalysis.result.minimalForts.length } minimal loop fort{ loopAnalysis.result.minimalForts.length === 1 ? '' : 's' } of { loopAnalysis.result.forts.length } total.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      { loopAnalysis.result.minimalForts.map(fort => `{${ formatVertexSet(fort) }}`).join(', ') || 'None found.' }
                    </Typography>
                  </Stack>
                )
              }

              {
                loopAnalysis.result && loopAnalysis.variant === ADVANCED_VARIANTS.BLOCKING_SETS && (
                  <Stack spacing={ 0.5 }>
                    <Typography variant="body1">
                      Loop blocking number: <strong>{ loopAnalysis.result.number }</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      { loopAnalysis.result.sets.map(set => `{${ formatVertexSet(set) }}`).join(', ') || 'None found.' }
                    </Typography>
                  </Stack>
                )
              }

              {
                loopAnalysis.stale && (
                  <Typography variant="body2" color="warning.main">
                    The displayed result was computed for a different graph, variant, or loop configuration. Recompute to refresh it.
                  </Typography>
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
