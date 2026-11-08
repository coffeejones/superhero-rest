const HttpError = require('../utils/HttpError');

function createHeroService(heroModel, favoriteModel) {
  async function getHero(id) {
    const heroes = await heroModel.getAll();
    const hero = heroes.find((item) => item.id === id);
    if (!hero) throw new HttpError(404, 'Superhelten blev ikke fundet.');
    return hero;
  }

  return {
    getHeroes: () => heroModel.getAll(),
    getHero,

    async addFavorite(id, note) {
      await getHero(id);
      return favoriteModel.add(id, note);
    },

    getFavorites: () => favoriteModel.list(),
    updateFavorite: (id, note) => favoriteModel.update(id, note),
    deleteFavorite: (id) => favoriteModel.remove(id),
  };
}

module.exports = createHeroService;
