import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { getFeatures } from './assets/scripts/utils/chrome'
import type { FeatureMeta } from './features/types'

export type Feature = FeatureMeta

const toggleFeature = (id: string, features?: Feature[]): Feature[] | undefined =>
  features?.map(feature => ({
    ...feature,
    enabled: feature.id === id ? !feature.enabled : feature.enabled
  }))

// The popup state: the given list with the enabled flags from storage merged in
const useFeatures = (defaults: Feature[]) => {
  const [state, setState] = useState<{ features?: Feature[]; loading: boolean }>({ loading: true })

  const getInitialFeatures = async () => {
    setState({ loading: true })
    const features = await getFeatures(defaults)
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

const FeatureContext = createContext<ReturnType<typeof useFeatures>>({ toggleFeature, state: { loading: true } })

export const useFeatureContext = () => useContext(FeatureContext)

export const FeatureProvider = ({ features, children }: { features: Feature[]; children: ReactNode }) => (
  <FeatureContext.Provider value={useFeatures(features)}>{children}</FeatureContext.Provider>
)
