const express = require('express');
const path = require('node:path');
const defaultHeroModel = require('./models/heroModel');
const createFavoriteModel = require('./models/favoriteModel');
const createHeroService = require('./services/heroService');
const createHeroRoutes = require('./routes/heroRoutes');
const errorHandler = require('./middlewares/errorHandler');
const HttpError = require('./utils/HttpError');

function createApp({ heroModel = defaultHeroModel, favoriteModel = createFavoriteModel() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(createHeroRoutes(createHeroService(heroModel, favoriteModel)));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use((req, res, next) => next(new HttpError(404, 'Ruten blev ikke fundet.')));
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
