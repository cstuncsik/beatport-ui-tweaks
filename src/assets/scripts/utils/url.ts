export const getGenreOrArtistFromUrl = () => location.pathname.replace(/\/(genre|artist)\/(.*?)\/.*?$/, '$2')
