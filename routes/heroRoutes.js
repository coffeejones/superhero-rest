const express = require('express');
const createHeroController = require('../controllers/heroController');
const { validateFavorite, validateNote, validateId } = require('../validators/favoriteValidator');

function createHeroRoutes(service) {
  const router = express.Router();
  const controller = createHeroController(service);

  router.get('/superheroes', controller.getHeroes);
  router.get('/superheroes/:id', validateId, controller.getHero);
  router.get('/favorites', controller.getFavorites);
  router.post('/favorites', validateFavorite, controller.addFavorite);
  router.put('/favorites/:id', validateId, validateNote, controller.updateFavorite);
  router.delete('/favorites/:id', validateId, controller.deleteFavorite);

  return router;
}

module.exports = createHeroRoutes;
