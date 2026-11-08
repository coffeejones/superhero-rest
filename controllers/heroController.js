function createHeroController(service) {
  return {
    async getHeroes(req, res) {
      res.json(await service.getHeroes());
    },

    async getHero(req, res) {
      res.json(await service.getHero(req.heroId));
    },

    async addFavorite(req, res) {
      const favorite = await service.addFavorite(req.body.id, req.body.note);
      res.status(201).location(`/favorites/${favorite.id}`).json(favorite);
    },

    getFavorites(req, res) {
      res.json(service.getFavorites());
    },

    updateFavorite(req, res) {
      res.json(service.updateFavorite(req.heroId, req.body.note));
    },

    deleteFavorite(req, res) {
      service.deleteFavorite(req.heroId);
      res.status(204).end();
    },
  };
}

module.exports = createHeroController;
