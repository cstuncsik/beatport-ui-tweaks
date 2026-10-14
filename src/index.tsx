import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './components/App'
import { FeatureProvider } from './store'
import { features } from './features'

const root = ReactDOM.createRoot(document.getElementById('app') as HTMLElement)
root.render(
  <React.StrictMode>
    <FeatureProvider features={features}>
      <App />
    </FeatureProvider>
  </React.StrictMode>
)
