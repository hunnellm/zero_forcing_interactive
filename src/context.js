import { createContext, useCallback, useContext, useMemo } from 'react'
import PropTypes from 'prop-types'
import { useMediaQuery } from '@mui/material'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { useLocalStorage } from './hooks'
import { useAnalysisPanelState } from './components/analysis-panel-state'

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
    }}>
      <ThemeProvider theme={ theme }>
        { children }
      </ThemeProvider>
    </AppContext.Provider>
  )
}

AppProvider.propTypes = { children: PropTypes.node }
