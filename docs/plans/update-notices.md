# Update notices

Status: built 2026-10-24 on branch `feat-update-notification` from main at 2.6.3, ships as 2.7.0. Step 6
was dropped: a command-line loaded extension does not come back from `chrome.runtime.reload()`
(`ERR_BLOCKED_BY_CLIENT` afterwards, even without a version change), so an update can't be simulated
in the e2e harness; the tests write the state the handlers would. Steps 5 and the toast button work as
planned: `context.route` catches the worker's GitHub fetch, an alarm with `when: Date.now()` fires
within 0.1 s in an unpacked build, and `openPopup()` opens the popup in headless Chromium.

## Story

Users don't learn that the extension changed. Chrome updates store installs silently, the popup only
shows the version number, and the changelog lives on GitHub. Zip installs (Load unpacked from a GitHub
release) never update by themselves, and nothing tells them a new release is out.

Wanted: after an update, a short "what's new"; when a newer version is out, a notice that says what to do.

## Facts (checked 2026-10-24)

- Permissions today: `activeTab`, `storage`. An update that adds a permission with a warning disables
  the extension until the user accepts it. `notifications` warns ("Display notifications"), `alarms`
  does not.
- `runtime.onInstalled` gives `reason` (`install`, `update`, `chrome_update`, `shared_module_update`)
  and `previousVersion` on `update`. Reloading an unpacked build fires `update` with the same version.
- `runtime.onUpdateAvailable` fires only while the service worker runs when Chrome finds the update,
  otherwise Chrome installs it at once. `runtime.reload()` applies a pending update. The docs advise
  against `requestUpdateCheck()`, and repeated calls come back `throttled`.
- `management.getSelf()` needs no permission. `installType` is `development` for Load unpacked,
  `normal` for the store.
- The GitHub REST API allows CORS from any origin, so no host permission. Unauthenticated limit: 60
  requests per hour per IP. The store lags GitHub (2.6.0 vs 2.6.3 today), so store users are never told
  about GitHub releases.
- `action.openPopup()` is available to every extension since Chrome 127.
- A badge only shows on a pinned icon, and Chrome does not pin new installs.
- Parcel: `import changelogUrl from 'url:../CHANGELOG.md'` copies the file into `dist` under a hashed
  name with no new dependency, the popup fetches it. `bundle-text:` works too but auto-installs
  `@parcel/transformer-inline-string` into package.json, so not that one.
- `CHANGELOG.md` is plain text: `## X.Y.Z (date)` headings and `- ` bullets, no other markdown. CI
  already requires an entry per version.
- After an update, open Beatport tabs keep the old content script until a full load, and its `chrome.*`
  calls throw. Same today with Chrome's own updates.

## Decided 2026-10-24

1. Two notices: "updated" (what's new since the last version the user saw) and "available" (a newer
   version is out).
2. Store installs learn about "available" from `onUpdateAvailable` only, no active checks. The notice
   offers "Restart to update" (`runtime.reload()`) with a hint to reload open Beatport tabs.
3. Zip installs (`installType === 'development'`) check GitHub's latest release once a day with
   `chrome.alarms`. The notice links to the release page.
4. Surfaces: toolbar badge, a popup section, an in-page toast on beatport.com. No system
   notifications, no tab opened on update.
5. Notes come from the bundled `CHANGELOG.md`: every entry after the seen version up to the installed
   one, plus a link to the full changelog on GitHub.
6. Seen means the popup was opened or the toast closed. Either one clears the badge and the toast in
   every tab. The "updated" notes leave the popup after that visit, "available" stays in the popup
   until it is installed. Per device, in `storage.local`.
7. Registry toggle "Update notices", on by default, gates the toast only.
8. Fresh install: nothing.
9. Tabs left on the old version are not told to reload.

## Design

State in `storage.local` under `beatport-ui-update`:

```ts
type UpdateState = {
  seen: string // the notes up to this version were seen
  available?: { version: string; source: 'store' | 'github'; seen?: boolean }
}
```

The writer records the source, so the popup picks Restart or Download from the state rather than from
`installType`, and tests can render both. Versions compare with
`a.localeCompare(b, undefined, { numeric: true })`, manifest versions are dot-separated integers.

One pure function decides the notice for all three surfaces: `available` newer than the installed
version and not seen gives "available", `seen` older than the installed version gives "updated",
otherwise none.

Helpers in `src/assets/scripts/utils/updates.ts`: state read and write, `notice(state, installed)`,
`markSeen()` (sets `seen` to the installed version and `available.seen`), `changelogEntries(text,
after, upTo)` returning `{ version, date, items }[]`.

Background (`src/assets/scripts/background.ts`):
- `onInstalled`: `install` sets `seen` to the installed version. `update` sets `seen` to
  `previousVersion` when there is no state yet (first rollout: a store user on 2.6.0 sees 2.6.1 to
  2.7.0), keeps an existing `seen` (two updates without a visit show both), and drops `available` when
  it is not newer than the installed version. `chrome_update` and same-version reloads change nothing.
- `onUpdateAvailable({ version })`: `available = { version, source: 'store' }`.
- Zip installs only: alarm `github-release` with `delayInMinutes: 1, periodInMinutes: 1440`, created on
  install, update and startup when missing (alarms can be cleared on a browser restart). It fetches
  `https://api.github.com/repos/cstuncsik/beatport-ui-tweaks/releases/latest`, strips the `v` from
  `tag_name` and sets `available = { version, source: 'github' }` when that is newer. Errors are logged
  and ignored.
- Badge from the state on `onInstalled`, `onStartup` and `storage.onChanged` (it fires for the
  worker's own writes too): `NEW` for "updated", `↑` for "available", empty otherwise. Green `#01ff95`,
  text `#141414`.
- Message `open-popup` from the toast: `chrome.action.openPopup()`, on failure open the changelog on
  GitHub with `chrome.tabs.create`.

Popup: an `UpdateNotice` component above the options in `App.tsx`. It reads the state, fetches the
bundled changelog (`url:` import, with `declare module 'url:*'` next to `scss.d.ts`) and renders the
entries (version heading, bullets, capped height with its own scroll) and the full changelog link. For
"available" it shows the version with "Restart to update" (store) or "Download" (the GitHub release
page). It calls `markSeen()` after reading and renders nothing without a notice.

Toast: registry entry `bp-ui-tweak-update-notices`, label "Update notices", description "A note on
Beatport when the extension updated or an update is ready", and `src/features/update-notices.ts`. Its
`start()` reads the state and, when there is a notice, appends a fixed box to the body: the extension
icon, "Beatport UI Tweaks updated to 2.7.0" or "Beatport UI Tweaks 2.7.1 is available", a "What's new"
or "Details" button (sends `open-popup`; the popup marks seen once it has read the notes) and a ×
(marks seen). The box removes itself on
`storage.onChanged` once seen, and CSS hides it unless the body has the feature class, like the other
features. Styles in `content.scss`, Beatport's palette, bottom right above the player; the placement
is checked by eye on the real site (the live check uploads traces only when it fails).

## Steps

1. `utils/updates.ts`: state, notice, version compare, `markSeen`, changelog parsing.
2. Background listeners, badge, alarm for zip installs, `open-popup`, `alarms` in the manifest. Test:
   a state with `seen` below the build version gives the badge `NEW` (`chrome.action.getBadgeText`),
   `available` from GitHub gives `↑`.
3. Popup section. Tests: `seen` two versions back lists both entries and nothing older, and the badge
   is empty after the popup opened; `available` from the store shows Restart, from GitHub shows Download
   with the release URL; no notice renders nothing.
4. Toast feature and styles. Tests on the stub list page: the toast shows for each notice, × clears the
   badge and removes the toast in a second tab, the toggle off hides it.
5. GitHub check end to end: route `api.github.com` with `context.route`, fire the alarm from the worker
   (`chrome.alarms.create('github-release', { when: Date.now() })`), expect `↑`.
6. Update path end to end, if it holds up: load a copy of `dist` with a lower manifest version, write
   the real version back, call `chrome.runtime.reload()` from the worker, expect `NEW` and the entries.
   Dropped if flaky, step 2 covers the state the handler writes.
7. Version 2.7.0, CHANGELOG entry, README feature line, live check dispatched, toast placement checked
   by eye on the real site.

## Out of scope

- Telling stale tabs to reload.
- A welcome on first install.
- Active store checks (`requestUpdateCheck`).
- System notifications, a tab opened on update.

## Risks

- `openPopup()` runs from a message handler, without a user gesture. Works in headless Chromium; in a
  window that isn't focused it rejects and the changelog tab stands in.
- The store "available" notice will be rare: the service worker idles within seconds and Chrome
  installs the update instead.
- The toast sits on Beatport's page, so its position can clash with their player. One class to adjust.
- Store listing: no change, store installs make no network calls. Zip installs call api.github.com
  once a day.
