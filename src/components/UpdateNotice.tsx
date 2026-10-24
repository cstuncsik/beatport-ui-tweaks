import React, { useEffect, useState } from 'react'
import './UpdateNotice.scss'
import {
  ChangelogEntry,
  UpdateState,
  changelogEntries,
  changelogUrl,
  getUpdateState,
  installedVersion,
  markSeen,
  newer,
  releaseUrl
} from '../assets/scripts/utils/updates'

// Parcel copies the changelog into the extension and turns this into its URL
const bundledChangelog = new URL('../../CHANGELOG.md', import.meta.url).href

// What's new since the version the user saw last, and a newer version while one is out. Opening the
// popup counts as seen: the badge and the toast on beatport.com go, the notes stay until it closes.
export const UpdateNotice = () => {
  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [available, setAvailable] = useState<UpdateState['available']>()

  useEffect(() => {
    const load = async () => {
      const state = await getUpdateState()
      const installed = installedVersion()
      if (state?.available && newer(state.available.version, installed)) {
        setAvailable(state.available)
      }
      if (state && newer(installed, state.seen)) {
        const text = await (await fetch(bundledChangelog)).text()
        setEntries(changelogEntries(text, state.seen, installed))
      }
      await markSeen()
    }
    load()
  }, [])

  if (!available && !entries.length) {
    return null
  }
  return (
    <section className="update-notice">
      {available && (
        <div className="update-notice__available">
          <p className="update-notice__title">Version {available.version} is available</p>
          {available.source === 'store' ? (
            <>
              <button type="button" className="update-notice__action" onClick={() => chrome.runtime.reload()}>
                Restart to update
              </button>
              <p className="update-notice__hint">Reload open Beatport tabs afterwards.</p>
            </>
          ) : (
            <a className="update-notice__action" href={releaseUrl(available.version)} target="_blank" rel="noreferrer">
              Download
            </a>
          )}
        </div>
      )}
      {entries.length > 0 && (
        <div className="update-notice__updated">
          <p className="update-notice__title">What&apos;s new</p>
          <div className="update-notice__entries">
            {entries.map(entry => (
              <div key={entry.version} className="update-notice__entry">
                <h2>
                  {entry.version} <span>{entry.date}</span>
                </h2>
                <ul>
                  {entry.items.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <a className="update-notice__link" href={changelogUrl} target="_blank" rel="noreferrer">
            Full changelog
          </a>
        </div>
      )}
    </section>
  )
}
