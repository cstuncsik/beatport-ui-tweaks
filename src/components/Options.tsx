import './Options.scss'
import { Option } from './Option'
import { Feature } from '../store'
import { useEffect } from 'react'

type OptionsProps = {
  features?: Feature[]
  toggleFeature: (id: string) => void
}

export const Options = ({ features, toggleFeature }: OptionsProps) => {
  useEffect(() => {
    chrome.storage.sync.set({ features })
  }, [features])
  return (
    <section>
      <h2>Options</h2>
      <ul className="options">
        {features?.map((feature: Feature) => (
          <Option key={feature.id} toggleFeature={toggleFeature} feature={feature} />
        ))}
      </ul>
    </section>
  )
}
