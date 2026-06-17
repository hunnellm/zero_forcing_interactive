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
        <Typography paragraph>
          The <Typography color="primary" component="span">Step Back</Typography> button
          (⏮) undoes the last coloring step, restoring the previous coloring state.
          Multiple steps can be undone in sequence.
          The <Typography color="primary" component="span">Reset</Typography> button
          (↩) clears all colored nodes and the step history at once.
        </Typography>
      </Box>

      <Box>
        <Typography variant="h2" sx={{ fontSize: '135%' }}>
          Draw Graph Mode
        </Typography>

        <br />

        <Typography paragraph>
          Click the <Typography color="primary" component="span">pencil icon</Typography> (✏)
          in the toolbar to enter Draw Graph mode.
          In this mode:
        </Typography>
        <Typography component="ul" sx={{ pl: 3 }}>
          <li>Click anywhere on the canvas background to add a new isolated node.</li>
          <li>Click a node to select it as an edge source (it will be highlighted).</li>
          <li>Click a second node to draw an edge between the two nodes.</li>
          <li>Click the selected node again to deselect it.</li>
        </Typography>
        <Typography paragraph sx={{ mt: 1 }}>
          Click the pencil icon again to exit Draw mode and return to coloring interaction.
          The adjacency matrix is kept in sync automatically, so the new graph can be exported
          or further edited via the Matrix tab.
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
