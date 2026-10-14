import type { FeatureMeta } from './types'

// Pure data: the popup, the background and the e2e fixtures import this file, keep it free of DOM
// and chrome.* references. The order is the popup order.
export const ids = {
  rememberLastPlayed: 'bp-ui-tweak-remember-last-played',
  highlightPlaying: 'bp-ui-tweak-highlight-played-item',
  keyboardPlayback: 'bp-ui-tweak-next-prev-play-keyboard',
  camelotKey: 'bp-ui-tweak-camelot-key',
  mruPlaylists: 'bp-ui-tweak-mru-playlists',
  playlistFilter: 'bp-ui-tweak-playlist-filter'
} as const

export const features: FeatureMeta[] = [
  {
    id: ids.rememberLastPlayed,
    label: 'Remember last played',
    description: 'Scrolls back to the track you played last when you return to a list, the "Last played" button finds the page it moved to',
    enabled: true
  },
  {
    id: ids.highlightPlaying,
    label: 'Highlight playing track',
    description: 'Outlines the row that is playing',
    enabled: true
  },
  {
    id: ids.keyboardPlayback,
    label: 'Keyboard playback',
    description: 'A plays the previous track, Z the next one',
    enabled: true
  },
  {
    id: ids.camelotKey,
    label: 'Show Camelot key',
    description: 'Adds the Camelot code of the key, for harmonic mixing',
    enabled: true
  },
  {
    id: ids.mruPlaylists,
    label: 'Recently used playlists first',
    description: 'Playlists you added tracks to lead the add-to-playlist list, latest first',
    enabled: true
  },
  {
    id: ids.playlistFilter,
    label: 'Playlist filter box',
    description: 'A search box in the add-to-playlist dialog, narrows the list as you type',
    enabled: true
  }
]
