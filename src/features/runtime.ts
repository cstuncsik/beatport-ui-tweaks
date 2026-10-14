import type { ContentFeature, FeatureMeta } from './types'
import { toggleBodyFeatureClassNames } from '../assets/scripts/utils/dom'

// Runs the features on a beatport.com page. The body class per feature id is the contract: CSS, the
// main-world script and the live check rely on it. A flag is applied only when it changed, the popup
// re-sends every flag each time it opens. Ids nobody registered are ignored.
export const runContent = (features: ContentFeature[]) => {
  document.body.classList.add('bp-ui-tweaks-extension')
  features.forEach(feature => feature.start?.())

  const applied = new Map<string, boolean>()
  const apply = (id: string, enabled: boolean) => {
    if (applied.get(id) === enabled) {
      return
    }
    applied.set(id, enabled)
    toggleBodyFeatureClassNames(id, enabled)
    features.find(feature => feature.id === id)?.toggle?.(enabled)
  }

  chrome.runtime.onMessage.addListener(request => {
    const feature: FeatureMeta | undefined = request?.feature
    if (feature) {
      apply(feature.id, feature.enabled)
    }
  })

  chrome.runtime.sendMessage({ action: 'get-beatport-ui-features' }, response => {
    const stored: FeatureMeta[] | undefined = response?.features
    stored?.forEach(({ id, enabled }) => apply(id, enabled))
  })
}
