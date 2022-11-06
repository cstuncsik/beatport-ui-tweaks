import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { getFeatures } from './assets/scripts/utils/chrome'

export type Feature = {
  id: string
  label: string
  enabled: boolean
}

export const defaultFeatures: Feature[] = [
  { id: 'bp-ui-tweak-remember-last-played', label: 'Remember last played', enabled: true },
  { id: 'bp-ui-tweak-dense-layout', label: 'Dense layout', enabled: true },
  { id: 'bp-ui-tweak-highlight-list-element', label: 'Highlight list element', enabled: true },
  { id: 'bp-ui-tweak-sticky-list-headers', label: 'Sticky list headers', enabled: true }
]

const toggleFeature = (id: string, features?: Feature[]): Feature[] | undefined =>
  features?.map(feature => ({
    ...feature,
    enabled: feature.id === id ? !feature.enabled : feature.enabled
  }))

const useFeatures = () => {
  const [state, setState] = useState<{ features?: Feature[]; loading: boolean }>({ loading: true })

  const getInitialFeatures = async () => {
    setState({ loading: true })
    const features = await getFeatures()
    setState({ features, loading: false })
  }

  useEffect(() => {
    getInitialFeatures()
  }, [])

  return {
    state,
    toggleFeature: (id: string) => setState(state => ({ ...state, features: toggleFeature(id, state.features) }))
  }
}

const FeatureContext = createContext<ReturnType<typeof useFeatures> | null>(null)

export const useFeatureContext = () => useContext(FeatureContext)!

export const FeatureProvider = ({ children }: { children: ReactNode }) => (
  <FeatureContext.Provider value={useFeatures()}>{children}</FeatureContext.Provider>
)