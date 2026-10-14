import { getFeatures } from './utils/chrome'
import { features } from '../../features'

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get-beatport-ui-features') {
    getFeatures(features).then(features => {
      sendResponse({ features })
    })
  }
  return true
})
