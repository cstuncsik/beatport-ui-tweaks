import { getFeatures } from './utils/chrome'

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get-beatport-ui-features') {
    getFeatures().then(features => {
      sendResponse({ features })
    })
  }
  return true
})
