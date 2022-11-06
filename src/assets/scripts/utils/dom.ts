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
