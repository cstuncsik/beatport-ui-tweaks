import { ids } from './index'
import type { ContentFeature } from './types'
import { observeWhileEnabled } from '../assets/scripts/utils/dom'
import { camelotFromKeyText } from '../assets/scripts/utils/musical'

// Camelot key: the element that shows a musical key gets data-bp-camelot="10A", the chip itself is
// rendered by content.scss from that attribute, so React never sees an extra DOM node. In list
// tables the attribute goes on the title cell of the row instead, so the codes line up in one column.
const id = ids.camelotKey
const camelotAttribute = 'data-bp-camelot'

// the info column wraps the title and artist lines, so the chip, centered on it and pinned to its right
// edge, sits in the middle of the row and lines up into one column down the list
const listChipTargetSelector = '[class*="InfoColumn"]'

const chipTarget = (keyElement: Element): Element => keyElement.closest('.row')?.querySelector(listChipTargetSelector) ?? keyElement

const camelotKeyElements = (): Element[] => [
  // list tables on genre, chart, release and track pages: BPM and key columns, "128" and "F Maj", annotated rows are skipped
  ...[...document.querySelectorAll('.row [class*="MetaDataColumn"]')].filter(div => !chipTarget(div).hasAttribute(camelotAttribute)),
  // track detail meta: <div>Key:</div><span>D Minor</span>
  ...[...document.querySelectorAll('[class*="metaItem"] > *')]
    .filter(label => label.textContent?.trim() === 'Key:')
    .map(label => label.nextElementSibling),
  // player bar: "A minor", changes with the track so it is re-read every pass
  ...document.querySelectorAll('#bp-player p')
].filter((element): element is Element => !!element)

const annotateCamelotKeys = () => {
  camelotKeyElements().forEach(element => {
    const code = camelotFromKeyText(element.textContent ?? '')
    const target = chipTarget(element)
    if (code) {
      if (target.getAttribute(camelotAttribute) !== code) {
        target.setAttribute(camelotAttribute, code)
      }
    } else if (target === element) {
      // a row's BPM column has no key either, that must not strip the chip its key column put on the title cell
      target.removeAttribute(camelotAttribute)
    }
  })
}

const stripCamelotKeys = () =>
  document.querySelectorAll(`[${camelotAttribute}]`).forEach(element => element.removeAttribute(camelotAttribute))

const syncCamelotObserver = observeWhileEnabled(id, annotateCamelotKeys, stripCamelotKeys)

export const camelotKey: ContentFeature = {
  id,
  toggle: () => syncCamelotObserver()
}
