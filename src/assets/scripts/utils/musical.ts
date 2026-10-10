type KeySignatures = 'A' | 'A#' | 'B' | 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#'
type Modes = 'major' | 'minor'

export const convertKeySignatureToCamelot = (key: KeySignatures, mode: Modes): string => {
  const keySignatures = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']
  const camelotMajor = ['11B', '6B', '1B', '8B', '3B', '10B', '5B', '12B', '7B', '2B', '9B', '4B']
  const camelotMinor = ['8A', '3A', '10A', '5A', '12A', '7A', '2A', '9A', '4A', '11A', '6A', '1A']
  const idx = keySignatures.indexOf(key)

  return /major/i.test(mode) ? camelotMajor[idx] : camelotMinor[idx]
}

// Beatport writes flats ("Bb Minor"), the table above is in sharps
const flatsToSharps: Record<string, KeySignatures> = {
  Cb: 'B',
  Db: 'C#',
  Eb: 'D#',
  Fb: 'E',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#'
}

// "86 BPM - Bb Minor", "Key: D Minor", "A minor" -> "3A", "7A", "8A"; null when the text has no key
export const camelotFromKeyText = (text: string): string | null => {
  const match = /([A-G])([b#♭♯])?\s*(major|minor|Major|Minor)/.exec(text)
  if (!match) {
    return null
  }
  const [, letter, accidental = '', mode] = match
  const key = `${letter}${accidental.replace('♭', 'b').replace('♯', '#')}`
  return convertKeySignatureToCamelot(flatsToSharps[key] ?? (key as KeySignatures), mode.toLowerCase() as Modes) ?? null
}
