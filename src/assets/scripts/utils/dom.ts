export const getOffset = (el: HTMLElement | null, parent: HTMLElement): Record<string, number> => {
  const elRect = el?.getBoundingClientRect()
  let ret = {}
  if (elRect) {
    let x = 0
    let y = 0
    while (el && el !== parent && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
      x += el.offsetLeft - el.scrollLeft
      y += el.offsetTop - el.scrollTop
      el = el.offsetParent as HTMLElement
    }
    ret = { top: y, left: x, bottom: y + elRect.height, right: x + elRect.width }
  }
  return ret
}

export function isElementVisible(el?: HTMLElement | null): boolean {
  if (!el) {
    return false
  }
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
}

export const waitUntilElementIsVisible = (
  selector: string,
  timeout = 2000
): Promise<{ element: HTMLElement | null; width: number; height: number }> => {
  let rafID: number
  const started: number = Date.now()
  return new Promise(resolve => {
    function checker() {
      const elapsed = Date.now() - started
      const el = document.querySelector<HTMLElement>(selector)
      if (!isElementVisible(el)) {
        if (elapsed > timeout) {
          window.cancelAnimationFrame(rafID)
          resolve({ element: null, width: 0, height: 0 })
        } else {
          rafID = window.requestAnimationFrame(checker)
        }
      } else {
        window.cancelAnimationFrame(rafID)
        resolve({ element: el, width: el?.offsetWidth ?? 0, height: el?.offsetHeight ?? 0 })
      }
    }
    checker()
  })
}

export const toggleBodyFeatureClassNames = (id: string, enabled: boolean) => {
  const body = document.body
  if (enabled) {
    body.classList.add(id)
  } else {
    body.classList.remove(id)
  }
}

export const findSiblingElementsByClasses = (
  currentElement: Element | null,
  classNames: string[]
): {
  prevElement: Element | null
  nextElement: Element | null
} => {
  let prevElement = null
  let nextElement = null

  if (!currentElement) {
    return { prevElement, nextElement }
  }

  const siblings = Array.from(currentElement.parentNode?.children ?? [])
  const currentIndex = siblings.indexOf(currentElement)

  for (let i = currentIndex - 1; i >= 0; i--) {
    const element = siblings[i]
    if (classNames.every(className => element.classList.contains(className))) {
      prevElement = element
      break
    }
  }

  for (let i = currentIndex + 1; i < siblings.length; i++) {
    const element = siblings[i]
    if (classNames.every(className => element.classList.contains(className))) {
      nextElement = element
      break
    }
  }

  return { prevElement, nextElement }
}
