// Finds the page a track sits on in the current Beatport list, through the catalog API the list is
// built from. What was measured is in docs/plans/go-to-last-played.md.

const apiBase = 'https://api.beatport.com/v4'
const defaultOrder = '-release_date,release_id'
const countCap = 10000
const dayPageSize = 150
// how far each side of the estimate the scan looks before giving up, in list pages
const maxVerifyPages = 40

export type ListParams = Record<string, string | number | boolean>
export type Found = { page: number } | { reason: 'unreachable' | 'not-found' }
type Track = { id: number; publish_date: string }
type Listing = { count: number; results: Track[] }

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

// The list's own query parameters, from the server-rendered page data when that is for this list,
// else rebuilt from the URL. Null for a list the search cannot handle: not a tracks list, sorted in
// another way than newest first, or filtered by release date, which the search uses itself.
export const listParams = (): ListParams | null => {
  const [, kind, , id, type] = location.pathname.split('/')
  const order = new URL(location.href).searchParams.get('order_by') ?? defaultOrder
  if (type !== 'tracks' || !['genre', 'artist', 'label'].includes(kind) || !order.startsWith('-release_date')) {
    return null
  }
  const rendered = pageData()
    ?.props?.pageProps?.dehydratedState?.queries?.find((query: { queryKey?: unknown[] }) => query.queryKey?.[0] === 'tracks')
    ?.queryKey?.[1]
  const params: ListParams = rendered?.[`${kind}_id`] === id ? { ...rendered } : { [`${kind}_id`]: id, order_by: defaultOrder, preorder: false }
  if (params.publish_date) {
    return null
  }
  delete params.page
  delete params.per_page
  delete params.publish_date
  params.include_facets = false
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

const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const dayAfter = (date: string) => {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return isoDate(next)
}

export const findTrackPage = async (id: string, params: ListParams, perPage: number, token: string): Promise<Found> => {
  const { publish_date: date } = await api<Track>(`/catalog/tracks/${id}/`, {}, token)
  // everything released after that day comes first in the list, then its day up to the track
  const after = await api<Listing>('/catalog/tracks/', { ...params, page: 1, per_page: 1, publish_date: `${dayAfter(date)}:${dayAfter(isoDate(new Date()))}` }, token)
  let position = after.count
  for (let page = 1; page <= 10; page++) {
    const day = await api<Listing>('/catalog/tracks/', { ...params, page, per_page: dayPageSize, publish_date: `${date}:${date}` }, token)
    const index = day.results.findIndex(track => String(track.id) === id)
    if (index >= 0) {
      position += (page - 1) * dayPageSize + index
      break
    }
    if (page * dayPageSize >= day.count) {
      break
    }
  }
  if (position >= countCap) {
    console.warn('Beatport UI Tweaks: "Last played" track is past the 10000-row cap', { id, date, newer: after.count, position })
    return { reason: 'unreachable' }
  }
  // The position is an estimate: the list sorts by release date, the count is by publish date, and the
  // two drift apart by pages this deep (seen 11 pages at position 5766). So the estimated page is a
  // starting point, not the answer; scan outward from it one page at a time until the track turns up.
  // ponytail: linear scan, up to maxVerifyPages fetches each side. If the drift ever outgrows that,
  // count by release date instead of publish date (needs the catalog API to filter on release date).
  const estimate = Math.max(1, Math.floor(position / perPage) + 1)
  const onPage = (listing: Listing) => listing.results.some(track => String(track.id) === id)
  const start = await api<Listing>('/catalog/tracks/', { ...params, page: estimate, per_page: perPage }, token)
  if (onPage(start)) {
    return { page: estimate }
  }
  const lastPage = Math.max(1, Math.ceil(Math.min(start.count, countCap) / perPage))
  for (let step = 1; step <= maxVerifyPages; step++) {
    const pages = [estimate - step, estimate + step].filter(page => page >= 1 && page <= lastPage)
    if (!pages.length) {
      break
    }
    for (const page of pages) {
      const listing = await api<Listing>('/catalog/tracks/', { ...params, page, per_page: perPage }, token)
      if (onPage(listing)) {
        return { page }
      }
    }
  }
  console.warn('Beatport UI Tweaks: "Last played" search did not reach the track', { id, date, newer: after.count, position, estimate, lastPage, perPage })
  return { reason: 'not-found' }
}
