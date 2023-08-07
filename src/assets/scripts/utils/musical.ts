type KeySignatures = 'A' | 'A#' | 'B' | 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#'
type Modes = 'major' | 'minor'

export const convertKeySignatureToCamelot = (key: KeySignatures, mode: Modes): string => {
  const keySignatures = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']
  const camelotMajor = ['11B', '6B', '1B', '8B', '3B', '10B', '5B', '12B', '7B', '2B', '9B', '4B']
  const camelotMinor = ['8A', '3A', '10A', '5A', '12A', '7A', '2A', '9A', '4A', '11A', '6A', '1A']
  const idx = keySignatures.indexOf(key)

  return /major/i.test(mode) ? camelotMajor[idx] : camelotMinor[idx]
}
