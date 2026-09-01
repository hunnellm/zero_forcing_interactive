// Must be the first import: @babel/preset-env transpiles the async/await
// used throughout src/lib/api.js down to generator functions, which rely on
// the `regeneratorRuntime` global at runtime. Without this polyfill the
// entire bundle throws on load ("regeneratorRuntime is not defined") before
// React ever mounts, leaving a blank page.
import 'regenerator-runtime/runtime'
import { App } from './app'
import { createRoot } from 'react-dom/client'
import { AppProvider } from './context'
import { GraphProvider } from './components/graph'
import  './index.scss'
import ReactGA from 'react-ga4'

ReactGA.initialize([
  {
    trackingId: 'G-ZXC48NE5CE',
  },
])

const container = document.getElementById('root')
const root = createRoot(container)

const ProvisionedApp = () => {
  return (
    <AppProvider>
      <GraphProvider>
        <App />
      </GraphProvider>
    </AppProvider>
  )
}
root.render(<ProvisionedApp />)
