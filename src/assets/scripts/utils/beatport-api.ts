// Finds the page a track sits on in the current Beatport list, through the endpoint the site builds
// the list from (catalog/v1, since November 2026) with the site's own query, so its pages are the
// site's pages. History of what was measured is in docs/plans/go-to-last-played.md.

const apiBase = 'https://api.beatport.com'
const defaultOrder = '-release_date'
// the list endpoint stops at 10000 rows, however long the list is
const countCap = 10000

export type ListParams = Record<string, string | number | boolean>
export type Found = { page: number } | { reason: 'unreachable' | 'not-found' }
type ListItem = { track_id: number; release: { release_date: string } }
type Listing = { items: ListItem[]; total_pages: number; total_count: number }

const pageData = () => {
  try {
    return JSON.parse(document.getElementById('__NEXT_DATA__')?.textContent ?? 'null')
  } catch {
    return null
  }
}

// the session token when logged in, else the anonymous one Beatport renders into the page
export const accessToken = async (): Promise<string | null> => {
  try {
    const session = await (await fetch('/api/auth/session', { credentials: 'include' })).json()
    if (session?.token?.accessToken) {
      return session.token.accessToken
    }
  } catch {
    // logged out
  }
  return pageData()?.props?.pageProps?.anonSession?.access_token ?? null
}

// The list's own query, from the server-rendered page data when that is for this list, else rebuilt
// from the URL with the site's defaults. Null for a list the search cannot handle: not a tracks list,
// or sorted in another way than newest first, which the binary search relies on.
export const listParams = (): ListParams | null => {
  const [, kind, , id, type] = location.pathname.split('/')
  const order = new URL(location.href).searchParams.get('order_by') ?? defaultOrder
  if (type !== 'tracks' || !['genre', 'artist', 'label'].includes(kind) || order !== defaultOrder) {
    return null
  }
  const rendered = pageData()
    ?.props?.pageProps?.dehydratedState?.queries?.find((query: { queryKey?: unknown[] }) => query.queryKey?.[0] === 'tracks')
    ?.queryKey?.[1]
  const params: ListParams = rendered?.[`${kind}_id`] === id ? { ...rendered } : { [`${kind}_id`]: id, order_by: defaultOrder, price_category: '!preorder' }
  delete params.page
  delete params.page_size
  delete params.per_page
  return params
}

const api = async <T>(path: string, params: ListParams, token: string): Promise<T> => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '') {
      query.set(key, String(value))
    }
  })
  const response = await fetch(`${apiBase}${path}?${query}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) {
    throw new Error(`Beatport API ${response.status} for ${path}`)
  }
  return response.json()
}

const listPage = (params: ListParams, page: number, perPage: number, token: string) =>
  api<Listing>('/catalog/v1/tracks/', { ...params, page, page_size: perPage }, token)

// Whether the endpoint, asked with the list's query, returns the rows the page shows. Beatport changes
// its list endpoint and query now and then, and from then on the search would land on wrong pages;
// this catches it before navigating.
// ponytail: 90% of the rows is the bar, tracks added since the page loaded shift a few rows
export const listMatchesPage = async (params: ListParams, page: number, perPage: number, shownIds: string[], token: string) => {
  if (!shownIds.length) {
    return true
  }
  const listed = new Set((await listPage(params, page, perPage, token)).items.map(item => String(item.track_id)))
  return shownIds.filter(id => listed.has(id)).length >= shownIds.length * 0.9
}

// The list sorts newest release day first and a day's tracks by id, so a binary search over its pages
// finds the track's page in about log2(pages) calls.
export const findTrackPage = async (id: string, params: ListParams, perPage: number, token: string): Promise<Found> => {
  const { new_release_date: date } = await api<{ new_release_date: string }>(`/v4/catalog/tracks/${id}/`, {}, token)
  const target = Number(id)
  const comesBefore = (item: ListItem) => {
    const day = item.release.release_date.slice(0, 10)
    return day === date ? target < item.track_id : date > day
  }
  let page = 1
  let listing = await listPage(params, page, perPage, token)
  let low = 1
  let high = listing.total_pages
  while (listing.items.length) {
    const { items } = listing
    if (items.some(item => item.track_id === target)) {
      return { page }
    }
    if (comesBefore(items[0])) {
      high = page - 1
    } else if (!comesBefore(items[items.length - 1])) {
      low = page + 1
    } else {
      break // sorts inside this page but is not on it: gone from the list
    }
    if (low > high) {
      break
    }
    page = Math.floor((low + high) / 2)
    listing = await listPage(params, page, perPage, token)
  }
  if (low > listing.total_pages && listing.total_count >= countCap) {
    console.warn('Beatport UI Tweaks: "Last played" track is past the 10000-row cap', { id, date })
    return { reason: 'unreachable' }
  }
  console.warn('Beatport UI Tweaks: "Last played" search did not find the track', { id, date, page, perPage })
  return { reason: 'not-found' }
}
