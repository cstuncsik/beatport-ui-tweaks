import React, { useEffect } from 'react'
import './Options.scss'
import { Option } from './Option'
import { Feature } from '../store'
import { featuresStorageKey } from '../assets/scripts/utils/chrome'

type OptionsProps = {
  features?: Feature[]
  toggleFeature: (id: string) => void
}

export const Options = ({ features, toggleFeature }: OptionsProps) => {
  useEffect(() => {
    chrome.storage.sync.set({ [featuresStorageKey]: features })
  }, [features])
  return (
    <ul className="options">
      {features?.map((feature: Feature) => (
        <Option key={feature.id} toggleFeature={toggleFeature} feature={feature} />
      ))}
    </ul>
  )
}
