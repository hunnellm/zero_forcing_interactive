import { Box, Stack, Typography } from '@mui/material'

export const Instructions = () => {
  return (
    <Stack spacing={ 4 }>
    
      <Box>
        <Typography variant="h2" sx={{ fontSize: '135%' }}>
          Operation
        </Typography>

        <br />
        
        <Typography paragraph>
          Click nodes in the graph to color and uncolor them.
          Clicking while holding down CTRL / ⌘ will also color or uncolor
          all nodes adjacent to the clicked node.
        </Typography>
        <Typography paragraph>
          The <Typography color="primary" component="span">STEP</Typography> button
          invokes one application of the coloring rule.
          Checking to see if a zero forcing set has been found amounts to
          coloring the initial node set and clicking <Typography color="primary"
          component="span">STEP</Typography> to see whether it does indeed force
          the whole graph to become colored.
        </Typography>
      </Box>

      <Box>
        <Typography variant="h2" sx={{ fontSize: '135%' }}>
          More information
        </Typography>

        <br />
        
        <Typography paragraph>
          To read more about zero-forcing an this application, please consult the ABOUT tab.
          The MATRIX tab provides the ability to render different graphs by entering an adjacency
          matrix or graph6 string and clicking the GENERATE GRAPH button.
          For convenience, a few preset matrices are available to choose from.
          The SETTINGS tab gives some UI customization options.
          The INSTRUCTIONS tab, of course, is what you{`'`}re reading now.
        </Typography>
      </Box>

    </Stack>
  )
}
