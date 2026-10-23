# Changelog

What changed in each version of Beatport UI Tweaks. Newest first, dates are release dates.

## 2.6.3 (2026-10-23)

- Fixed: works with the tracks table Beatport rolled out on October 22, 2026. It had broken every list feature: remember last played, the "Last played" button, highlight playing track, the A/Z keys and the Camelot column. Keys in the new table are abbreviated ("F Maj"), the Camelot code reads them too.
- Fixed: the outline stays on the track you paused or stopped. Beatport draws the same outline itself now, but only while the track plays.
- Fixed: the scroll to the remembered track on a reload. Beatport renders lists on the server now, so the scroll ran before the page had finished loading and got lost; it waits for the load now.

## 2.6.2 (2026-10-14)

- Fixed: "Highlight playing track" follows Beatport's own marker now, so a track Beatport starts by itself after the previous one ended is outlined too, in lists and playlists, and at load without a click.

## 2.6.1 (2026-10-14)

- Fixed: opening the popup no longer scrolls the page back to the last played track.
- Changed: each feature is its own module behind a registry; the background and content scripts shrank by 40 and 50 kB. No visible change.

## 2.6.0 (2026-10-11)

- Added: "Last played" button next to the pager of a tracks list. Finds the page the track you played last has moved to since, for the current per-page setting, and goes there. Part of "Remember last played", dimmed until something was played in the list.
- Fixed: "Remember last played" could re-mark the row after being switched off.

## 2.5.1 (2026-10-10)

- Changed: Camelot chips line up in one column at the end of the title cell, instead of following the key text.
- Fixed: a feature switched off in the popup puts the page back the way Beatport renders it, and on again applies it at once.

## 2.5.0 (2026-10-10)

- Added: filter box in the add-to-playlist dialog, narrows the list as you type and loads the remaining pages of your playlists.
- Fixed: typing in a text field (Beatport's search included) no longer triggers the A and Z playback keys.

## 2.4.0 (2026-10-10)

- Added: recently used playlists first in the add-to-playlist dialog, latest use on top.

## 2.3.0 (2026-10-10)

- Added: Alt+Shift+B opens the popup (change it under chrome://extensions/shortcuts).

## 2.2.0 (2026-10-10)

- Added: the Camelot code next to every key, in Camelot wheel colors, in lists, on track pages and in the player.

## 2.1.9 (2026-10-10)

- Changed: popup refreshed, dependencies upgraded, end-to-end tests with a daily check against the live site.

## 2.1.8 (2025-03-18)

- Changed: observers start on demand and stop when done.

## 2.1.7 (2025-03-15)

- Fixed: the played track is caught before Beatport's own scripts change the page.

## 2.1.6 (2025-03-09)

- Changed: fewer observer runs.

## 2.1.5 (2025-03-08)

- Fixed: selectors updated for Beatport's changed markup.

## 2.1.4 (2024-01-15)

- Fixed: selection of the currently played item.

## 2.1.3 (2023-08-19)

- Fixed: lookup of the replay button.

## 2.1.2 (2023-08-12)

- Fixed: search for the play button.

## 2.1.1 (2023-08-07)

- Fixed: a missing current element no longer breaks the page.

## 2.1.0 (2023-08-07)

- Added: keyboard playback, A plays the previous track, Z the next one.

## 2.0.1 (2023-07-16)

- Fixed: console logs removed.

## 2.0.0 (2023-07-16)

- Changed: the last played item is saved per genre or artist, for releases and tracks alike.

## 1.2.1 (2023-07-15)

- Fixed: the last played element is always found again.

## 1.2.0 (2023-07-14)

- Changed: aligned with Beatport's new UI.

## 1.1.0 (2022-11-10) and 1.0.0 (2022-11-06)

- Added: row highlighting, remembering and scrolling to the last played item.
