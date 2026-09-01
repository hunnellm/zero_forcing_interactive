const assert = require('assert')
const fs = require('fs')
const path = require('path')

// Regression test for the "blank page on load" bug: src/lib/api.js (and other
// modules) use async/await, which @babel/preset-env transpiles down to
// generator functions that need the `regeneratorRuntime` global at runtime.
// Without importing the polyfill, the whole bundle throws
// "regeneratorRuntime is not defined" before React ever mounts, so this
// import must remain the first statement in the entry point.
const sourceCode = fs.readFileSync(path.resolve(__dirname, './index.js'), 'utf8')
const firstImportLine = sourceCode.split('\n').find(line => line.trim().length > 0 && !line.trim().startsWith('//'))

assert.strictEqual(
  firstImportLine.trim(),
  "import 'regenerator-runtime/runtime'",
  'src/index.js must import the regenerator-runtime polyfill before any other module so async/await used elsewhere in the app does not crash the bundle on load',
)

const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'))
assert.ok(
  packageJson.dependencies['regenerator-runtime'],
  'regenerator-runtime must be an explicit dependency (not just a transitive one) since src/index.js imports it directly',
)

console.log('index entry point tests passed')
