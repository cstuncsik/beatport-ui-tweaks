import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { getFeatures } from './assets/scripts/utils/chrome'

export type Feature = {
  id: string
  label: string
  description: string
  enabled: boolean
}

export const defaultFeatures: Feature[] = [
  {
    id: 'bp-ui-tweak-remember-last-played',
    label: 'Remember last played',
    description: 'Scrolls back to the track you played last when you return to a list',
    enabled: true
  },
  {
    id: 'bp-ui-tweak-highlight-played-item',
    label: 'Highlight playing track',
    description: 'Outlines the row that is playing',
    enabled: true
  },
  {
    id: 'bp-ui-tweak-next-prev-play-keyboard',
    label: 'Keyboard playback',
    description: 'A plays the previous track, Z the next one',
    enabled: true
  },
  {
    id: 'bp-ui-tweak-camelot-key',
    label: 'Show Camelot key',
    description: 'Adds the Camelot code next to the key, for harmonic mixing',
    enabled: true
  },
  {
    id: 'bp-ui-tweak-mru-playlists',
    label: 'Recently used playlists first',
    description: 'Playlists you added tracks to lead the add-to-playlist list, latest first',
    enabled: true
  },
  {
    id: 'bp-ui-tweak-playlist-filter',
    label: 'Playlist filter box',
    description: 'A search box in the add-to-playlist dialog, narrows the list as you type',
    enabled: true
  }
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

const FeatureContext = createContext<ReturnType<typeof useFeatures>>({ toggleFeature, state: { loading: true } })

export const useFeatureContext = () => useContext(FeatureContext)

export const FeatureProvider = ({ children }: { children: ReactNode }) => (
  <FeatureContext.Provider value={useFeatures()}>{children}</FeatureContext.Provider>
)
