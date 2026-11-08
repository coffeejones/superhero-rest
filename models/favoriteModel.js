const HttpError = require('../utils/HttpError');

function createFavoriteModel() {
  const favorites = [];

  return {
    list() {
      return favorites.map((favorite) => ({ ...favorite }));
    },

    add(id, note) {
      if (favorites.some((favorite) => favorite.id === id)) {
        throw new HttpError(409, 'Helten er allerede en favorit.');
      }
      const favorite = { id, note };
      favorites.push(favorite);
      return { ...favorite };
    },

    update(id, note) {
      const favorite = favorites.find((item) => item.id === id);
      if (!favorite) throw new HttpError(404, 'Favoritten blev ikke fundet.');
      favorite.note = note;
      return { ...favorite };
    },

    remove(id) {
      const index = favorites.findIndex((favorite) => favorite.id === id);
      if (index === -1) throw new HttpError(404, 'Favoritten blev ikke fundet.');
      favorites.splice(index, 1);
    },
  };
}

module.exports = createFavoriteModel;
