# Go to the last played track of a category

Status: plan, 2026-10-11. Branch `go-to-last-played` from main at 2.5.1.

## Story

Browsing `https://www.beatport.com/genre/drum-bass/1/tracks?page=8&per_page=150`, a track on page 8 was
played. A week later the list has grown at the front, the track sits pages further back, and the only way
to it is clicking through the pager until "Remember last played" finds the row and scrolls to it.

Wanted: one action that lands on the page the track is on now, for the current per_page.

## What Beatport exposes (probed 2026-10-11 with a real browser, no login)

- The list is the API query `GET https://api.beatport.com/v4/catalog/tracks/` with the parameters in
  `__NEXT_DATA__.props.pageProps.dehydratedState.queries[?].queryKey[1]`:
  `{ page, per_page, order_by: "-release_date,release_id", preorder: false, genre_id, include_facets,
  bpm, publish_date, sub_genre_id, artist_id, label_id, key_id }`. Filters and sort of the page are in there.
- Default sort is newest first. `count` is capped at 10000, so page 67 at 150 per page is the end of
  what paging can reach anyway.
- An anonymous API token is server-rendered into `__NEXT_DATA__.props.pageProps.anonSession.access_token`
  (expires in hours). Logged in, `fetch('/api/auth/session')` returns `token.accessToken` (as the MRU
  feature already uses).
- The API accepts a `publish_date=YYYY-MM-DD:YYYY-MM-DD` range filter. Counting the tracks published
  after the target's date puts its position within a few rows, not exactly: the list sorts by
  `release_date`, the filter is `publish_date`, and the two differ for some tracks (measured 17 rows off
  at position 1090). The same-day query (`publish_date=D:D`) gives the index within the day.
- Not usable: `/_next/data/<buildId>/...json` and `POST /api/auth/refresh-anon-token` answer with the
  Cloudflare challenge even from inside the page. Full page navigations are the only way to render a page.
- `GET /v4/catalog/tracks/<id>/` returns `publish_date` for the stored track id.

## Design

Content script, no new permissions (fetch to api.beatport.com from the page's origin works, the popup
only sends a message). Feature toggle like the others, `bp-ui-tweak-go-to-last-played`.

Search, all before any navigation, 3 to 6 API calls, about one second:

1. Stored track id for the current `genreOrArtist/type` (existing `beatport-last-played`). None: say so.
2. Token: `/api/auth/session` when logged in, else `anonSession.access_token` from the `__NEXT_DATA__`
   script tag in the DOM.
3. `GET /v4/catalog/tracks/<id>/` for `publish_date`.
4. List parameters of the page from `__NEXT_DATA__` (or rebuilt from the URL on SPA navigations). Sort
   not "newest first": skip to the fallback below.
5. Estimate: `count` of `publish_date=<date+1>:<today>` plus the index of the id in the same-day query
   (`publish_date=<date>:<date>`, paged, per_page 150) gives the position, page = floor(position / per_page) + 1.
   Position beyond 10000: unreachable, say so.
6. Verify with the API before navigating: fetch the list query for the estimated page, then page+1,
   page-1, page+2, page-2, stop at the first that contains the id. Nothing found: fallback below.
7. Navigate to the current URL with `page=<found>` (per_page and filters untouched). "Remember last
   played" then scrolls to the row as today.

Fallback when the API route fails (no token, 401, changed response): navigate to the page recorded at play
time (see storage), the row is there or further back, and tell the user.

Storage: extend the value stored at play time from the id string to
`{ id, page, per_page, index }` (page and per_page from the URL, index = row position on the page).
Readers accept the old string form. Gives the fallback a starting page, and a position estimate when the
API is unavailable: `(page - 1) * per_page + index` converted to the current per_page.

Decided 2026-10-11: no separate toggle, the "Remember last played" feature covers it, and the button
sits on the page, not in the popup. "Last played" pill next to Beatport's pager, left of "Previous", in
both pager rows (above and below the list): same 36px pill as the per-page options, the extension icon
on the left, green outline, tooltip starting with "Beatport UI Tweaks". Always shown while the feature
is on, dimmed with "nothing played in this list yet" when there is no stored track for the list.
Click: track on the page scrolls to it, otherwise "Searching…" and the navigation, "Not found", "Too far
back" or "Only for newest first" for a few seconds when it cannot. Mockups of the three placements that
were compared: a (after the per-page options), b (next to the pager, chosen), c (floating).

## Steps

1. Storage shape with page, per_page, index at play time, readers accept both forms. Test: stored value.
2. `utils/beatport-api.ts`: token lookup, track detail, count, list page fetch, all plain `fetch`.
3. Search function in content.ts with the estimate, verification and fallback. Test: stubbed
   `api.beatport.com` routes with a fixed catalog, assert the navigated URL for a track on page 3 with
   per_page 150, for a changed per_page, for a sort that is not newest first, and for the API failing.
4. Popup button and message round trip. Test: popup click, tab navigates.
5. Live check on the drum-bass list with the logged-in DevTools Chrome, then README and version bump.

## Open points

- Button in the popup, on the page next to the pager, or both.
- The 10000 cap: a track older than that is out of reach, the message should say to use the search.
- SPA navigations between categories keep the first page's `__NEXT_DATA__`; parameters are rebuilt
  from the URL in that case, so unusual filters may be missed. Rare, falls back to the stored page.
