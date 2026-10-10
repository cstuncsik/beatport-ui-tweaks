import React from 'react'
import './App.scss'
import { Options } from './Options'
import { useFeatureContext } from '../store'
import { Loading } from './Loading'

export const App = () => {
  const { state, toggleFeature } = useFeatureContext()
  return (
    <>
      <header>
        <h1>Beatport UI Tweaks</h1>
        <span className="version">v{chrome.runtime.getManifest().version}</span>
      </header>
      <main>
        {state.loading && <Loading />}
        {!state.loading && <Options features={state.features} toggleFeature={toggleFeature} />}
      </main>
    </>
  )
}
