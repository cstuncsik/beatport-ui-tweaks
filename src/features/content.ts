import type { ContentFeature } from './types'
import { rememberLastPlayed } from './remember-last-played'
import { highlightPlayedItem } from './highlight-played-item'
import { keyboardPlayback } from './keyboard-playback'
import { camelotKey } from './camelot-key'
import { playlistFilter } from './playlist-filter'
import { updateNotices } from './update-notices'

// The behaviors that run in the isolated world. "Recently used playlists first" runs in the page
// world from its own entry, features/mru-playlists.ts, and watches the body class.
export const contentFeatures: ContentFeature[] = [
  rememberLastPlayed,
  highlightPlayedItem,
  keyboardPlayback,
  camelotKey,
  playlistFilter,
  updateNotices
]
