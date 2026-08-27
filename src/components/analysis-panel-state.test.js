const assert = require('assert')
const fs = require('fs')
const path = require('path')
const babel = require('@babel/core')

const moduleCache = new Map()

const loadModule = modulePath => {
  const resolved = path.resolve(__dirname, modulePath)
  if (moduleCache.has(resolved)) {
    return moduleCache.get(resolved)
  }

  const sourceCode = fs.readFileSync(resolved, 'utf8')
  const transformedCode = babel.transformSync(sourceCode, {
    presets: [['@babel/preset-env', { modules: 'commonjs' }]],
    babelrc: false,
    configFile: false,
    sourceType: 'module',
    filename: resolved,
  }).code

  const moduleObject = { exports: {} }
  moduleCache.set(resolved, moduleObject.exports)

  const localRequire = request => {
    if (!request.startsWith('.')) {
      return require(request)
    }

    const absoluteRequest = path.resolve(path.dirname(resolved), request)
    const requestPath = path.extname(request)
      ? request
      : (fs.existsSync(`${absoluteRequest}.js`) ? `${request}.js` : path.join(request, 'index.js'))
    return loadModule(path.relative(__dirname, path.resolve(path.dirname(resolved), requestPath)))
  }

  new Function('require', 'module', 'exports', transformedCode)(localRequire, moduleObject, moduleObject.exports)
  moduleCache.set(resolved, moduleObject.exports)
  return moduleObject.exports
}

const panelState = loadModule('./analysis-panel-state.js')

const createStorage = () => {
  const entries = new Map()
  return {
    getItem: key => entries.has(key) ? entries.get(key) : null,
    setItem: (key, value) => entries.set(key, value),
  }
}

const storage = createStorage()
panelState.writeAnalysisPanelPreference(storage, panelState.ANALYSIS_PANEL_STORAGE_KEYS.open, false)
panelState.writeAnalysisPanelPreference(storage, panelState.ANALYSIS_PANEL_STORAGE_KEYS.width, 412)

assert.strictEqual(
  panelState.readAnalysisPanelPreference(storage, panelState.ANALYSIS_PANEL_STORAGE_KEYS.open, true),
  false,
  'Drawer open state should round-trip through storage persistence',
)
assert.strictEqual(
  panelState.readAnalysisPanelPreference(storage, panelState.ANALYSIS_PANEL_STORAGE_KEYS.width, 320),
  412,
  'Drawer width should round-trip through storage persistence',
)
assert.strictEqual(
  panelState.clampAnalysisDrawerWidth(250, 1600),
  320,
  'Drawer width should respect the minimum desktop constraint',
)
assert.strictEqual(
  panelState.clampAnalysisDrawerWidth(900, 1000),
  450,
  'Drawer width should respect the 45vw desktop maximum',
)
assert.strictEqual(
  panelState.isAnalysisDrawerOverlay(899),
  true,
  'Narrow viewports should use overlay mode instead of shrinking the canvas',
)
assert.strictEqual(
  panelState.isAnalysisDrawerOverlay(900),
  false,
  'Desktop viewports should keep the drawer docked beside the canvas',
)
assert.strictEqual(
  panelState.getNextExpandedAnalysisCard(null, panelState.ANALYSIS_CARD_KEYS.VALUE),
  panelState.ANALYSIS_CARD_KEYS.VALUE,
  'Opening a card should expand the requested analysis section',
)
assert.strictEqual(
  panelState.getNextExpandedAnalysisCard(panelState.ANALYSIS_CARD_KEYS.VALUE, panelState.ANALYSIS_CARD_KEYS.MINIMUM_SETS),
  panelState.ANALYSIS_CARD_KEYS.MINIMUM_SETS,
  'Expanding one card should collapse the previously open section',
)
assert.strictEqual(
  panelState.getNextExpandedAnalysisCard(panelState.ANALYSIS_CARD_KEYS.MINIMUM_SETS, panelState.ANALYSIS_CARD_KEYS.MINIMUM_SETS),
  null,
  'Clicking the expanded card again should collapse it',
)

console.log('analysis panel state tests passed')
