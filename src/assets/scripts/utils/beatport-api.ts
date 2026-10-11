// Finds the page a track sits on in the current Beatport list, through the catalog API the list is
// built from. What was measured is in docs/plans/go-to-last-played.md.

const apiBase = 'https://api.beatport.com/v4'
const defaultOrder = '-release_date,release_id'
const countCap = 10000
const dayPageSize = 150

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
    return { reason: 'unreachable' }
  }
  // the list sorts by release date but filters by publish date, and the two differ for some tracks,
  // so the page is checked before anyone navigates
  const estimate = Math.floor(position / perPage) + 1
  for (const page of [estimate, estimate + 1, estimate - 1, estimate + 2, estimate - 2].filter(page => page >= 1)) {
    const listing = await api<Listing>('/catalog/tracks/', { ...params, page, per_page: perPage }, token)
    if (listing.results.some(track => String(track.id) === id)) {
      return { page }
    }
  }
  return { reason: 'not-found' }
}
