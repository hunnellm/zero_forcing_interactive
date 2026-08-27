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
    presets: [
      ['@babel/preset-env', { modules: 'commonjs' }],
      ['@babel/preset-react', { runtime: 'automatic' }],
    ],
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

const panel = loadModule('./computation-panel-shared.js')
const shared = loadModule('../lib/forcing-analysis-shared.js')

const running = panel.createAnalysisHeaderMeta({
  status: shared.COMPUTE_STATUS.RUNNING,
  stale: true,
  elapsedMs: 1250,
})

assert.strictEqual(running.statusChip.label, 'Running', 'Running computations should surface a running chip in compact headers')
assert.strictEqual(running.showCancel, true, 'Running computations should keep the cancel action in the compact header')
assert.strictEqual(running.showProgress, true, 'Running computations should keep progress feedback in the compact header')
assert.strictEqual(running.showStale, true, 'Stale results should remain visible in compact headers')
assert.strictEqual(running.elapsedLabel, '1.3s', 'Elapsed runtime should remain visible in compact headers')

const cancelled = panel.createAnalysisHeaderMeta({
  status: shared.COMPUTE_STATUS.CANCELLED,
  stale: false,
  elapsedMs: 250,
})

assert.strictEqual(cancelled.statusChip.label, 'Cancelled', 'Cancelled computations should retain a cancelled chip in compact headers')
assert.strictEqual(cancelled.showCancel, false, 'Cancelled computations should not continue to show the cancel action')
assert.strictEqual(cancelled.elapsedLabel, '0.3s', 'Cancelled computations should still show the elapsed runtime when available')

const success = panel.createAnalysisHeaderMeta({
  status: shared.COMPUTE_STATUS.SUCCESS,
  stale: false,
  elapsedMs: 2000,
})

assert.strictEqual(success.statusChip.label, 'Success', 'Successful computations should surface a success chip in compact headers')
assert.strictEqual(success.elapsedLabel, '2.0s', 'Successful computations should continue to show the elapsed runtime')

console.log('computation panel tests passed')
