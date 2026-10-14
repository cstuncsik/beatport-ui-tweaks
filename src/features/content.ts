import type { ContentFeature } from './types'
import { rememberLastPlayed } from './remember-last-played'
import { highlightPlaying } from './highlight-playing'
import { keyboardPlayback } from './keyboard-playback'
import { camelotKey } from './camelot-key'
import { playlistFilter } from './playlist-filter'

// The behaviors that run in the isolated world. "Recently used playlists first" is not here, it runs
// in the page world from its own entry, features/mru-playlists.ts, and watches the body class.
export const contentFeatures: ContentFeature[] = [rememberLastPlayed, highlightPlaying, keyboardPlayback, camelotKey, playlistFilter]
