import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './components/App'
import { FeatureProvider } from './store'

const root = ReactDOM.createRoot(document.getElementById('app') as HTMLElement)
root.render(
  <React.StrictMode>
    <FeatureProvider>
      <App />
    </FeatureProvider>
  </React.StrictMode>
)
