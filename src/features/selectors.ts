// Beatport list markup the features share, the styled-components table of October 2026: its class
// names carry the component name followed by a build hash, so they are matched on the name part
export const rowClass = 'row'
export const rowActiveClass = 'bp-ui-tweak-last-played__active'
// Beatport's own marker on the row that plays
export const rowPlayingAttribute = 'data-active'
export const rowPlayingSelector = `.${rowClass}[${rowPlayingAttribute}="true"]`
export const playedItemBaseSelector = `.${rowClass} a[class*="TitleLink"]`
export const playButtonSelector = 'button[aria-label="Play"]'
