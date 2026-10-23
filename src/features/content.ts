import type { ContentFeature } from './types'
import { rememberLastPlayed } from './remember-last-played'
import { keyboardPlayback } from './keyboard-playback'
import { camelotKey } from './camelot-key'
import { playlistFilter } from './playlist-filter'

// The behaviors that run in the isolated world. "Highlight playing track" is CSS only (content.scss
// outlines Beatport's own .row[data-active] under the body class), "Recently used playlists first" runs
// in the page world from its own entry, features/mru-playlists.ts, and watches the body class.
export const contentFeatures: ContentFeature[] = [rememberLastPlayed, keyboardPlayback, camelotKey, playlistFilter]
