import { Box, Divider, Stack, Typography } from '@mui/material'

export const About = () => {
  return (
    <Stack spacing={ 4 }>
      <Box>
        <Typography variant="h2" sx={{ fontSize: '135%' }}>
          What is this?
        </Typography>

        <br />

        <Typography paragraph>
          This application is intended to help those new to zero forcing to visualize the process. More features will be added as time and tokens are available.
        </Typography>
      </Box>

      <Box>
        <Typography variant="h2" sx={{ fontSize: '135%' }}>
          Some Background
        </Typography>

        <br />

        <Typography paragraph>
          <strong>Zero forcing</strong> is an iterative graph coloring process, during
          which a coloring rule is applied. Our coloring rule says that, given
          a set of filled vertices, any filled vertex with a single unfilled
          neighbor causes that neighbor to become filled. This is called a force.
        </Typography>
        <Typography paragraph>
          The application supports classical zero forcing, PSD zero forcing, and
          a transmission forcing variant with weighted updates controlled by
          user-selected transmission parameters α and β.
        </Typography>
        <Typography paragraph>
          A <strong>zero forcing set</strong> is a set of initially colored vertices which,
          after applying the coloring rule until no more forces are possible, every vertex of the graph is filled.
          Of particular interest, is identifying <strong>minimal</strong> and <strong>minimum</strong> zero forcing sets.
        </Typography>
      </Box>

      <Divider />

      
    </Stack>
  )
}
