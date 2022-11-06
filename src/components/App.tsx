import './App.scss'
import { Options } from './Options'
import { useFeatureContext } from '../store'
import { Loading } from './Loading'

export const App = () => {
  const { state, toggleFeature } = useFeatureContext()
  return (
    <div className="wrapper">
      <header>
        <h1>Beatport UI Tweaks</h1>
      </header>
      <main>
        {state.loading && <Loading />}
        {!state.loading && <Options features={state.features} toggleFeature={toggleFeature} />}
      </main>
    </div>
  )
}
