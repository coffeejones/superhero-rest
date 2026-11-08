const HttpError = require('../utils/HttpError');

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let status = 500;
  let message = 'Noget gik galt på serveren.';

  if (error.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request-body indeholder ugyldig JSON.';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    message = 'Request-body må højst fylde 10 KB.';
  } else if (['charset.unsupported', 'encoding.unsupported'].includes(error.type)) {
    status = 415;
    message = 'Request-body bruger en tegnkodning eller komprimering, der ikke understøttes.';
  } else if (error instanceof HttpError) {
    status = error.status;
    message = error.message;
  } else if (error.status === 400) {
    status = 400;
    message = 'Requesten kunne ikke læses. Kontrollér URL og request-body.';
  }

  if (status >= 500) console.error('Fejl:', error.message, error.cause?.message || '');
  res.status(status).json({ error: message });
}

module.exports = errorHandler;
