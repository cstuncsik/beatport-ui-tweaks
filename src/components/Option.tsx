import { useEffect } from 'react'
import './Option.scss'
import { Feature } from '../store'

type OptionProps = {
  feature: Feature
  toggleFeature: (id: string) => void
}

export const Option = ({ feature, toggleFeature }: OptionProps) => {
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { feature })
      }
    })
  }, [feature])
  return (
    <li>
      <label htmlFor={feature.id} className="option">
        <input type="checkbox" id={feature.id} onChange={() => toggleFeature(feature.id)} checked={feature.enabled} />
        <span>{feature.label}</span>
      </label>
    </li>
  )
}
