import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { useMediaQuery } from '@mui/material'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { useLocalStorage } from './hooks'
import { useAnalysisPanelState } from './components/analysis-panel-state'
import { checkBackendAvailable } from './lib/api'

const AppContext = createContext({})

const MODES = {
  light: 'light',
  dark: 'dark',
}

const lightTheme = {
  palette: {
    primary: {
      main: '#773755',
    },
    secondary: {
      main: '#468',
    },
    background: {
      default: '#ddd',
      paper: '#eee',
    },
    text: {
      primary: '#333',
      secondary: '#666',
    },
  },
}

const darkTheme = {
  palette: {
    primary: {
      main: '#874765',
    },
    secondary: {
      main: '#468',
    },
    background: {
      default: '#666',
      paper: '#222',
    },
    text: {
      primary: '#fff',
      secondary: '#666',
    },
  },
}

export const useApp = () => useContext(AppContext)

export const AppProvider = ({ children }) => {
  const compact = useMediaQuery('(max-width: 600px)')
  const [mode, setMode] = useLocalStorage('mode', MODES.light)
  const analysisPanel = useAnalysisPanelState()

  // Selected loop configuration for the looped zero forcing backend (see
  // src/lib/api.js and graph/context.js). A vertex index appears in this set
  // when it carries a loop in the currently selected configuration.
  const [loopedVertices, setLoopedVertices] = useState(() => new Set())
  // null = not yet checked, true/false = last known reachability of the
  // enhanced zero forcing backend (see server.js).
  const [backendAvailable, setBackendAvailable] = useState(null)

  const toggleLoopedVertex = useCallback(i => {
    setLoopedVertices(prev => {
      const next = new Set(prev)
      if (next.has(i)) {
        next.delete(i)
      } else {
        next.add(i)
      }
      return next
    })
  }, [])

  const clearLoopedVertices = useCallback(() => setLoopedVertices(new Set()), [])

  useEffect(() => {
    const controller = new AbortController()
    checkBackendAvailable(controller.signal)
      .then(available => setBackendAvailable(available))
      .catch(() => setBackendAvailable(false))
    return () => controller.abort()
  }, [])

  const otherMode = useMemo(() => mode === MODES.light ? MODES.dark : MODES.light, [mode])

  const toggleMode = useCallback(() => setMode(otherMode), [otherMode])

  const theme = useMemo(() => createTheme({
    palette: { mode },
    ...(mode === MODES.light ? lightTheme : darkTheme),
  }), [mode])

  return (
    <AppContext.Provider value={{
      compact,
      MODES, mode, setMode, toggleMode, otherMode,
      analysisPanel,
      backendAvailable,
      loopConfiguration: {
        loopedVertices,
        setLoopedVertices,
        toggleLoopedVertex,
        clearLoopedVertices,
      },
    }}>
      <ThemeProvider theme={ theme }>
        { children }
      </ThemeProvider>
    </AppContext.Provider>
  )
}

AppProvider.propTypes = { children: PropTypes.node }
