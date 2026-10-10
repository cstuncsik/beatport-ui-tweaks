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
type Fiber = { memoizedProps?: { client?: unknown }; return?: Fiber | null }
type InfiniteData = { pages: ListResponse[]; pageParams: unknown[] }
type QueryClient = {
  getQueryCache: () => unknown
  setQueryData: (key: unknown[], updater: (data?: InfiniteData) => InfiniteData | undefined) => unknown
}

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

// recently used playlists lead the first page, latest use first, and leave the page they belong to
const arrange = (results: Playlist[], firstPage: boolean, state: State): Playlist[] => {
  const recent = new Set(state.ids)
  const rest = results.filter(playlist => !recent.has(playlist.id))
  return firstPage ? [...state.ids.map(id => state.cache[id]).filter(Boolean), ...rest] : rest
}

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
  data.results = arrange(data.results, (new URL(url, location.origin).searchParams.get('page') ?? '1') === '1', state)
  return JSON.stringify(data)
}

// Beatport's React Query client, reached through React's fiber tree from a node inside the app.
// ponytail: React internals, if they change this returns null and the picker catches up when
// Beatport's own refetch after the add has finished (several seconds with many pages loaded)
const queryClient = (): QueryClient | null => {
  for (const selector of ['[class*="AddToPlaylistModal_wrapper"]', '#bp-player', '.row']) {
    const node = document.querySelector(selector) as unknown as Record<string, Fiber | undefined> | null
    const key = node && Object.keys(node).find(name => name.startsWith('__reactFiber$'))
    let fiber = key ? node[key] : null
    while (fiber) {
      const client = fiber.memoizedProps?.client as Partial<QueryClient> | undefined
      if (typeof client?.setQueryData === 'function' && typeof client.getQueryCache === 'function') {
        return client as QueryClient
      }
      fiber = fiber.return
    }
  }
  return null
}

// After an add Beatport refetches every loaded page of the picker one by one and shows the old
// order until all of them are back, so the cached pages get the new order right away.
const refreshPickerCache = (state: State) =>
  queryClient()?.setQueryData(['my-playlists-infinite'], data =>
    data && {
      ...data,
      pages: data.pages.map((page, index) => ({ ...page, results: arrange(page.results ?? [], index === 0, state) }))
    })

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
  refreshPickerCache(state)
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
