import React, { useEffect } from 'react'
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
        <span className="option__text">
          <span className="option__label">{feature.label}</span>
          <span className="option__description">{feature.description}</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          id={feature.id}
          onChange={() => toggleFeature(feature.id)}
          checked={feature.enabled}
        />
      </label>
    </li>
  )
}
