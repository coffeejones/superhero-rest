const Joi = require('joi');
const HttpError = require('../utils/HttpError');

const note = Joi.string().trim().min(2).max(500).required().messages({
  'any.required': 'Note skal udfyldes.',
  'string.base': 'Note skal være tekst.',
  'string.empty': 'Note skal udfyldes.',
  'string.min': 'Note skal indeholde mindst 2 tegn.',
  'string.max': 'Note må højst indeholde 500 tegn.',
});
const id = Joi.number().integer().positive().max(Number.MAX_SAFE_INTEGER).strict().required().messages({
  'any.required': 'ID skal udfyldes.',
  'number.base': 'ID skal være et tal.',
  'number.integer': 'ID skal være et heltal.',
  'number.positive': 'ID skal være positivt.',
  'number.max': 'ID er for stort.',
  'number.unsafe': 'ID er for stort.',
});

const createSchema = Joi.object({ id, note }).required();
const updateSchema = Joi.object({ note }).required();

function validateBody(schema) {
  return (req, res, next) => {
    if (!req.is('application/json')) {
      return next(new HttpError(415, 'Brug Content-Type: application/json.'));
    }
    const { error, value } = schema.validate(req.body, {
      messages: { 'object.unknown': 'Feltet {{#label}} er ikke tilladt.', 'any.required': 'JSON-body skal udfyldes.' },
    });
    if (error) return next(new HttpError(400, error.details[0].message));
    req.body = value;
    next();
  };
}

function validateId(req, res, next) {
  const idValue = Number(req.params.id);
  if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(idValue)) {
    return next(new HttpError(400, 'ID skal være et positivt, sikkert heltal.'));
  }
  req.heroId = idValue;
  next();
}

module.exports = {
  validateFavorite: validateBody(createSchema),
  validateNote: validateBody(updateSchema),
  validateId,
};
