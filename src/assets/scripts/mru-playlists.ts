// Recently used playlists first in the "add to playlist" picker.
// Beatport loads the picker with axios over XMLHttpRequest, 50 playlists per page in creation order,
// and the API has no sort parameter. So this script runs in the page's own world (manifest "world":
// "MAIN"), patches XMLHttpRequest and rewrites the list responses before React sees them: playlists
// the user added tracks to go first, latest use first, and are dropped from the page they belong to.
// No chrome.* API in this world: the feature flag is the body class content.ts sets, state is localStorage.

export {}

const featureClass = 'bp-ui-tweak-mru-playlists'
const storageKey = 'bp-ui-tweak-mru-playlists'
const listUrl = /\/v4\/my\/playlists\/\?/
const playlistUrl = /\/v4\/my\/playlists\/(\d+)\/(tracks\/bulk\/)?$/

type Playlist = { id: number; track_count: number }
type ListResponse = { page?: string; results?: Playlist[] }
type State = { ids: number[]; cache: Record<number, Playlist> }
type Patched = XMLHttpRequest & { bpMethod?: string; bpUrl?: string }

// every playlist a list response carried this session: the picker rendered it, so the shape is right
const seen = new Map<number, Playlist>()

const enabled = () => document.body?.classList.contains(featureClass) ?? false

const load = (): State => {
  try {
    return { ids: [], cache: {}, ...JSON.parse(localStorage.getItem(storageKey) ?? '{}') }
  } catch {
    return { ids: [], cache: {} }
  }
}

const save = (state: State) => localStorage.setItem(storageKey, JSON.stringify(state))

const rewriteList = (url: string, text: string): string => {
  const data: ListResponse = JSON.parse(text)
  if (!Array.isArray(data.results)) {
    return text
  }
  data.results.forEach(playlist => seen.set(playlist.id, playlist))
  if (!enabled()) {
    return text
  }
  const state = load()
  // a stored copy is refreshed whenever its playlist scrolls by, so name and count catch up
  data.results.forEach(playlist => {
    if (playlist.id in state.cache) {
      state.cache[playlist.id] = playlist
    }
  })
  save(state)
  const recent = new Set(state.ids)
  data.results = data.results.filter(playlist => !recent.has(playlist.id))
  if ((new URL(url, location.origin).searchParams.get('page') ?? '1') === '1') {
    data.results.unshift(...state.ids.map(id => state.cache[id]).filter(Boolean))
  }
  return JSON.stringify(data)
}

const markUsed = (id: number, addedTracks: number) => {
  const state = load()
  // not in any list yet, e.g. just created in the picker: creation order already puts it first
  const playlist = state.cache[id] ?? seen.get(id)
  if (!playlist) {
    return
  }
  state.ids = [id, ...state.ids.filter(other => other !== id)]
  state.cache[id] = { ...playlist, track_count: playlist.track_count + addedTracks }
  save(state)
}

// ponytail: deleting on another device leaves a ghost entry, adding to it fails until it is deleted here too
const forget = (id: number) => {
  const state = load()
  state.ids = state.ids.filter(other => other !== id)
  delete state.cache[id]
  save(state)
}

const addedTracks = (body: unknown): number => {
  try {
    return JSON.parse(String(body)).track_ids.length
  } catch {
    return 0
  }
}

const open = XMLHttpRequest.prototype.open as (this: XMLHttpRequest, ...args: unknown[]) => void
const { send } = XMLHttpRequest.prototype
const responseText = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText')!.get!

XMLHttpRequest.prototype.open = function (this: Patched, ...args: unknown[]) {
  this.bpMethod = String(args[0]).toUpperCase()
  this.bpUrl = String(args[1])
  open.apply(this, args)
}

XMLHttpRequest.prototype.send = function (this: Patched, body?: Document | XMLHttpRequestBodyInit | null) {
  const { bpMethod: method = '', bpUrl: url = '' } = this
  if (method === 'GET' && listUrl.test(url)) {
    let rewritten: string | undefined
    Object.defineProperty(this, 'responseText', {
      configurable: true,
      get: () => {
        const text = responseText.call(this) as string
        if (this.readyState !== 4 || this.status !== 200) {
          return text
        }
        try {
          rewritten ??= rewriteList(url, text)
        } catch {
          rewritten = text
        }
        return rewritten
      }
    })
  }
  const [, id, tracks] = url.match(playlistUrl) ?? []
  if (id && ((method === 'POST' && tracks) || (method === 'DELETE' && !tracks))) {
    this.addEventListener('load', () => {
      if (this.status < 200 || this.status >= 300 || !enabled()) {
        return
      }
      if (method === 'DELETE') {
        forget(Number(id))
      } else {
        markUsed(Number(id), addedTracks(body))
      }
    })
  }
  send.call(this, body)
}
