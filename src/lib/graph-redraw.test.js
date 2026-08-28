const assert = require('assert')
const fs = require('fs')
const path = require('path')
const babel = require('@babel/core')

const sourcePath = path.resolve(__dirname, './graph-redraw.js')
const sourceCode = fs.readFileSync(sourcePath, 'utf8')
const transformedCode = babel.transformSync(sourceCode, {
  presets: [['@babel/preset-env', { modules: 'commonjs' }]],
  sourceType: 'module',
}).code

const moduleObject = { exports: {} }
new Function('module', 'exports', transformedCode)(moduleObject, moduleObject.exports)
const { isContinuousRedrawEnabled } = moduleObject.exports

// --- isContinuousRedrawEnabled ---

// Auto Redraw off, not drawing -> simulation must stay frozen (regression:
// this must be false under every other state change, since "Auto Redraw:
// Off" should be an absolute guarantee, not one of several ORed conditions).
assert.strictEqual(
  isContinuousRedrawEnabled({ drawMode: false, autoRedraw: false }),
  false,
  'no continuous redraw when auto redraw is off and not drawing',
)

// Auto Redraw off, drawing -> still frozen
assert.strictEqual(
  isContinuousRedrawEnabled({ drawMode: true, autoRedraw: false }),
  false,
  'no continuous redraw when auto redraw is off, even while drawing',
)

// Auto Redraw on, drawing -> draw mode always freezes the simulation so
// manual placements are not perturbed by the physics engine
assert.strictEqual(
  isContinuousRedrawEnabled({ drawMode: true, autoRedraw: true }),
  false,
  'draw mode freezes the simulation even when auto redraw is on',
)

// Auto Redraw on, not drawing -> continuous redraw explicitly enabled
assert.strictEqual(
  isContinuousRedrawEnabled({ drawMode: false, autoRedraw: true }),
  true,
  'continuous redraw is enabled only when auto redraw is explicitly on and not drawing',
)

// Truthy/falsy autoRedraw values (e.g. undefined on first render) must not
// accidentally enable continuous redraw.
assert.strictEqual(
  isContinuousRedrawEnabled({ drawMode: false, autoRedraw: undefined }),
  false,
  'an undefined/falsy auto redraw value must not enable continuous redraw',
)

console.log('graph-redraw tests passed')
