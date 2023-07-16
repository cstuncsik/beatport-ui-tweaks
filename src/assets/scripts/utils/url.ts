export const getGenreOrArtistAndTypeFromUrl = (): Record<string, string> => {
  const [, , genreOrArtist, , type] = location.pathname.split('/')
  return {
    genreOrArtist,
    type
  }
}
