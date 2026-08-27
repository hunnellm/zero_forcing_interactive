import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export const ANALYSIS_PANEL_STORAGE_KEYS = {
  open: 'analysis-panel-open',
  width: 'analysis-panel-width',
  expandedCard: 'analysis-panel-expanded-card',
}

export const ANALYSIS_DRAWER_MIN_WIDTH = 320
export const ANALYSIS_DRAWER_DEFAULT_WIDTH = 380
export const ANALYSIS_DRAWER_MAX_WIDTH_RATIO = 0.45
export const ANALYSIS_DRAWER_OVERLAY_BREAKPOINT = 900

export const ANALYSIS_CARD_KEYS = {
  VALUE: 'value',
  MINIMUM_SETS: 'minimum-sets',
}

const getStorage = storage => storage || (typeof window !== 'undefined' ? window.localStorage : null)

export const readAnalysisPanelPreference = (storage, key, fallbackValue) => {
  try {
    const target = getStorage(storage)
    if (!target) {
      return fallbackValue
    }
    const value = target.getItem(key)
    return value === null ? fallbackValue : JSON.parse(value)
  } catch (error) {
    console.log(error)
    return fallbackValue
  }
}

export const writeAnalysisPanelPreference = (storage, key, value) => {
  try {
    const target = getStorage(storage)
    if (target) {
      target.setItem(key, JSON.stringify(value))
    }
  } catch (error) {
    console.log(error)
  }
  return value
}

export const clampAnalysisDrawerWidth = (value, viewportWidth = 0) => {
  const numericValue = Number(value)
  const fallbackMaxWidth = ANALYSIS_DRAWER_MIN_WIDTH
  const calculatedMaxWidth = Number.isFinite(viewportWidth) && viewportWidth > 0
    ? Math.max(ANALYSIS_DRAWER_MIN_WIDTH, Math.floor(viewportWidth * ANALYSIS_DRAWER_MAX_WIDTH_RATIO))
    : fallbackMaxWidth

  if (!Number.isFinite(numericValue)) {
    return Math.min(ANALYSIS_DRAWER_DEFAULT_WIDTH, calculatedMaxWidth)
  }

  return Math.min(Math.max(Math.round(numericValue), ANALYSIS_DRAWER_MIN_WIDTH), calculatedMaxWidth)
}

export const isAnalysisDrawerOverlay = viewportWidth => viewportWidth < ANALYSIS_DRAWER_OVERLAY_BREAKPOINT

export const getNextExpandedAnalysisCard = (expandedCard, cardKey) => (
  expandedCard === cardKey ? null : cardKey
)

export const useAnalysisPanelState = () => {
  const [viewportWidth, setViewportWidth] = useState(() => (
    typeof window === 'undefined' ? 0 : window.innerWidth
  ))
  const [drawerOpen, setDrawerOpen] = useState(() => (
    readAnalysisPanelPreference(null, ANALYSIS_PANEL_STORAGE_KEYS.open, true)
  ))
  const [storedDrawerWidth, setStoredDrawerWidth] = useState(() => (
    readAnalysisPanelPreference(null, ANALYSIS_PANEL_STORAGE_KEYS.width, ANALYSIS_DRAWER_DEFAULT_WIDTH)
  ))
  const [expandedCard, setExpandedCard] = useState(() => (
    readAnalysisPanelPreference(null, ANALYSIS_PANEL_STORAGE_KEYS.expandedCard, null)
  ))
  const scrollPositionsRef = useRef({})

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const handleResize = () => setViewportWidth(window.innerWidth)

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    writeAnalysisPanelPreference(null, ANALYSIS_PANEL_STORAGE_KEYS.open, drawerOpen)
  }, [drawerOpen])

  useEffect(() => {
    writeAnalysisPanelPreference(null, ANALYSIS_PANEL_STORAGE_KEYS.width, storedDrawerWidth)
  }, [storedDrawerWidth])

  useEffect(() => {
    writeAnalysisPanelPreference(null, ANALYSIS_PANEL_STORAGE_KEYS.expandedCard, expandedCard)
  }, [expandedCard])

  const drawerWidth = useMemo(
    () => clampAnalysisDrawerWidth(storedDrawerWidth, viewportWidth),
    [storedDrawerWidth, viewportWidth],
  )
  const overlay = useMemo(() => isAnalysisDrawerOverlay(viewportWidth), [viewportWidth])

  const openDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const toggleDrawer = useCallback(() => setDrawerOpen(open => !open), [])
  const setDrawerWidth = useCallback(width => {
    setStoredDrawerWidth(clampAnalysisDrawerWidth(width, viewportWidth))
  }, [viewportWidth])
  const toggleExpandedCard = useCallback(cardKey => {
    setExpandedCard(current => getNextExpandedAnalysisCard(current, cardKey))
  }, [])
  const rememberScrollPosition = useCallback(cardKey => event => {
    scrollPositionsRef.current[cardKey] = event.currentTarget.scrollTop
  }, [])
  const restoreScrollPosition = useCallback((cardKey, node) => {
    if (node && Number.isFinite(scrollPositionsRef.current[cardKey])) {
      node.scrollTop = scrollPositionsRef.current[cardKey]
    }
  }, [])

  return {
    drawerOpen,
    drawerWidth,
    overlay,
    viewportWidth,
    expandedCard,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    setDrawerWidth,
    toggleExpandedCard,
    rememberScrollPosition,
    restoreScrollPosition,
  }
}
