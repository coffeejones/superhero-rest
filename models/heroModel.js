const axios = require('axios');
const HttpError = require('../utils/HttpError');

const apiUrl = 'https://akabab.github.io/superhero-api/api/all.json';

async function getAll() {
  let data;

  try {
    const response = await axios.get(apiUrl, { timeout: 5000 });
    data = response.data;
  } catch (error) {
    const timedOut = ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code);
    throw new HttpError(
      timedOut ? 504 : 502,
      timedOut ? 'SuperHero API svarede ikke inden for fem sekunder.' : 'SuperHero API kunne ikke kontaktes.',
      error,
    );
  }

  if (!Array.isArray(data)) {
    throw new HttpError(502, 'SuperHero API returnerede et ugyldigt svar.');
  }

  return data.map((hero) => {
    if (!hero || !Number.isSafeInteger(hero.id) || hero.id <= 0
      || typeof hero.name !== 'string' || typeof hero.biography?.fullName !== 'string'
      || !(hero.powerstats?.strength === null || Number.isFinite(hero.powerstats?.strength))
      || typeof hero.images?.md !== 'string') {
      throw new HttpError(502, 'SuperHero API returnerede ugyldige heltedata.');
    }

    return {
      id: hero.id,
      name: hero.name,
      fullName: hero.biography.fullName,
      strength: hero.powerstats.strength,
      image: hero.images.md,
    };
  });
}

module.exports = { getAll };
