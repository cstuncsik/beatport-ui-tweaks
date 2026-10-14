# Feature registry

Status: done 2026-10-14 on branch `feature-registry` from main at 2.6.0, shipped as 2.6.1 (PR #8). Bundles after: content 69 kB, background 8 kB, both without React (118 kB and 58 kB before). Step 1 of the paid-features
work: paid features will be registry entries from another package, so core needs a registry first.
No behavior change except two fixes noted below.

## Today

- `src/store.tsx` holds the feature list (`defaultFeatures`) next to the popup's React context.
  `utils/chrome.ts` imports it for `getFeatures`, so the background and content bundles carry React
  (content 97 kB, background 57 kB).
- `src/assets/scripts/content.ts` (402 lines) has five features inline: remember last played with the
  "Last played" button, highlight playing track, keyboard playback, Camelot key, playlist filter. They
  share constants, one click listener, one keyup listener, a `featureToggles` map and
  `syncFeatureObservers()`. `mru-playlists.ts` is the sixth, a main-world script with its own entry.
- `e2e/fixtures.ts` repeats the six ids by hand.
- Every popup open re-sends every feature's state to the tab (`Option` effect on mount), and the
  message listener runs `featureToggles` on each, so opening the popup re-runs "remember last played"
  and scrolls the page to the stored track. Latent since the toggle-restore commit.

## Target

```
src/features/
  types.ts                 FeatureMeta { id, label, description, enabled, pro? }
                           ContentFeature { id, start?(), toggle?(enabled) }
  index.ts                 features: FeatureMeta[]   pure data: popup, background, tests
  runtime.ts               runContent(features: ContentFeature[])
  content.ts               contentFeatures: ContentFeature[]   the five below, in popup order
  selectors.ts             row, play button, title link, current and active classes
  remember-last-played.ts  storage on play, scroll and mark on load, the "Last played" button
  highlight-playing.ts
  keyboard-playback.ts
  camelot-key.ts
  playlist-filter.ts
  mru-playlists.ts         main-world entry, moved from assets/scripts (manifest path follows)
src/assets/scripts/content.ts   three lines: import runtime and list, run
src/store.tsx                   popup state only, imports metadata from features/index
```

- A behavior module exports one `ContentFeature`. `start()` runs once when the content script starts
  (listeners that check the body class themselves). `toggle(enabled)` runs when the stored flag
  arrives at start and whenever it flips later, after the runtime has set the body class, so observer
  features pass the sync function `observeWhileEnabled` returns as their `toggle`. Features that only
  need the body class (keyboard, CSS-driven highlight) have no `toggle`.
- The body class per feature id stays the contract: CSS, the main-world script and the live check
  rely on it. `bp-ui-tweaks-extension` on the body stays too.
- `runtime.ts`: add the root class, call every `start`, listen for `{ feature: { id, enabled } }`
  messages, ask the background for the stored flags, and apply a flag by setting the class and calling
  `toggle` only when the flag actually changed (fixes the popup-open re-scroll). The first flags from
  the background always count as changes, the applied map starts empty; only later messages are
  deduped. Unknown ids are ignored, so a pro package can register more without touching core.
- `index.ts` must stay free of DOM and `chrome.*` references: the popup bundle and the e2e fixtures
  import it. Behavior modules import their id from it. `mru-playlists.ts` may import it for its id and
  nothing else from the registry, it runs in the page world without `chrome.*`.
- Three entry points take the list, not one. The popup renders it (`FeatureProvider` gets `features`
  as a prop), the background merges stored flags with it (`getFeatures(defaults)`), the content
  runtime runs the behaviors (`runContent(list)`). Core's three entries pass core's lists; a pro
  package ships its own three entry files passing merged lists. This also breaks today's import
  cycle `store.tsx` → `utils/chrome.ts` → `store.tsx`, which is what drags React into the background
  and content bundles. `utils/chrome.ts` stops importing from `store.tsx`.
- `store.tsx` keeps `export type Feature = FeatureMeta` so the popup components stay untouched.
- The shared click listener splits in two (remember stores the played track, highlight restarts its
  observer), each in its feature's `start`. Order does not matter.
- Metadata gets the optional `pro` flag now, unused until the license step, so the type does not
  change twice.
- Styles stay in one `content.scss`; a split per feature can wait for the pro package.

## Steps

1. `types.ts`, `index.ts` with the six entries moved from `store.tsx`. `getFeatures(defaults)` takes
   the list and `utils/chrome.ts` drops its import of `store.tsx`; `FeatureProvider` takes the list as
   a prop and `index.tsx` passes core's; the background passes core's to `getFeatures`;
   `e2e/fixtures.ts` builds `featureIds` from it. Build, popup test, background bundle no longer
   contains React (today 58 kB with React, content 118 kB).
2. `selectors.ts`, `runtime.ts`, `content.ts` with the five modules extracted one by one from the old
   content script, old file reduced to the three-line entry. After each extraction: `pnpm build && pnpm test`.
3. Move `mru-playlists.ts`, update the manifest path. Build, MRU test.
4. Runtime dedupes unchanged flags. Test, in the remember test after the load scroll: scroll to the
   top, send all flags again (what the popup does on open), assert the page stays at the top and the
   marked row count stays one.
5. Highlight at load: with `toggle(true)` now running when the flags arrive, the playing row is
   highlighted without a click. Assert it in the highlight test.
6. Bundle sizes and the three-line entry noted in the PR. Live check dispatched on the branch.
7. Version 2.6.1: a refactor plus two fixes is a patch, the pro docs saying 2.7.0 for this step are
   corrected. README untouched.

## Out of scope

- License module, Pro section, `licensed` gate: step 2 of the paid work.
- Monorepo split, per-feature styles, moving the popup components.

## Risks

- Timing: "remember last played" starts its observer when the flags arrive instead of at script start.
  Rows render later than that on the real site, the observer still catches them, the live check proves it.
- The popup imports `features/index.ts` through `store.tsx`; a careless import of a behavior module
  there would pull DOM code and the icon into the popup bundle. The e2e fixture import guards it: a
  DOM reference in `index.ts` fails the test run under Node.
