const request = require('supertest');
const { performance } = require('node:perf_hooks');
const createApp = require('../app');
const createFavoriteModel = require('../models/favoriteModel');

const heroes = Array.from({ length: 20 }, (_, index) => ({
  id: index + 1,
  name: `Hero ${index + 1}`,
  fullName: `Person ${index + 1}`,
  strength: 50,
  image: `https://example.com/${index + 1}.jpg`,
}));

function setup(options = {}) {
  const heroModel = { getAll: jest.fn().mockResolvedValue(heroes) };
  return { app: createApp({ heroModel, ...options }), heroModel };
}

// Kontrolleret lokal test med testdata, ikke en garanti for belastning i produktion.
function reportTimings(label, timings) {
  const sorted = [...timings].sort((left, right) => left - right);
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
  console.info(`${label}: ${timings.length} requests, p95 ${p95.toFixed(1)} ms`);
}

describe('Samtidighed og instansgrænser', () => {
  test('20 samtidige POST bevarer alle unikke favoritter', async () => {
    const { app } = setup();
    const timings = [];
    const responses = await Promise.all(heroes.map(async (hero) => {
      const started = performance.now();
      const response = await request(app)
        .post('/favorites')
        .send({ id: hero.id, note: `Favorit ${hero.id}` });
      timings.push(performance.now() - started);
      return response;
    }));
    reportTimings('20 samtidige POST i én app', timings);

    expect(responses.map((response) => response.status)).toEqual(Array(20).fill(201));
    const response = await request(app).get('/favorites').expect(200);
    expect(response.body).toHaveLength(20);
    expect(new Set(response.body.map((favorite) => favorite.id)).size).toBe(20);
  });

  test('samtidig oprettelse af samme helt giver præcis én favorit', async () => {
    let release;
    let allStarted;
    let started = 0;
    const barrier = new Promise((resolve) => { release = resolve; });
    const allRequestsStarted = new Promise((resolve) => { allStarted = resolve; });
    const heroModel = { getAll: jest.fn(async () => {
      started += 1;
      if (started === 10) allStarted();
      await barrier;
      return heroes;
    }) };
    const { app } = setup({ heroModel });
    const pending = Array.from({ length: 10 }, (_, index) => request(app)
      .post('/favorites')
      .send({ id: 1, note: `Favorit ${index}` })
      .then((response) => response));

    await allRequestsStarted;
    release();
    const responses = await Promise.all(pending);
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(9);
    expect((await request(app).get('/favorites')).body).toHaveLength(1);
  });

  test('to apps med samme array-model bevarer 20 samtidige oprettelser', async () => {
    const favoriteModel = createFavoriteModel();
    const first = setup({ favoriteModel }).app;
    const second = setup({ favoriteModel }).app;
    const timings = [];
    const responses = await Promise.all(heroes.map(async (hero, index) => {
      const started = performance.now();
      const response = await request(index % 2 ? first : second)
        .post('/favorites')
        .send({ id: hero.id, note: `Favorit ${hero.id}` });
      timings.push(performance.now() - started);
      return response;
    }));
    reportTimings('20 samtidige POST fordelt på to apps med delt model', timings);

    expect(responses.every((response) => response.status === 201)).toBe(true);
    const one = await request(first).get('/favorites').expect(200);
    const two = await request(second).get('/favorites').expect(200);
    expect(one.body).toHaveLength(20);
    expect(two.body).toEqual(one.body);
  });

  test('to uafhængige apps har hver deres lokale favoritter', async () => {
    const first = setup().app;
    const second = setup().app;
    await request(first).post('/favorites').send({ id: 1, note: 'Kun i første app' }).expect(201);
    await request(first).get('/favorites').expect(200, [{ id: 1, note: 'Kun i første app' }]);
    await request(second).get('/favorites').expect(200, []);
  });

  test('et ventende eksternt API-kald blokerer ikke lokale HTTP-requests', async () => {
    let release;
    let markStarted;
    const barrier = new Promise((resolve) => { release = resolve; });
    const started = new Promise((resolve) => { markStarted = resolve; });
    const heroModel = { getAll: jest.fn(async () => {
      markStarted();
      await barrier;
      return heroes;
    }) };
    const { app } = setup({ heroModel });
    let upstreamFinished = false;
    const pending = request(app).get('/superheroes').then((response) => {
      upstreamFinished = true;
      return response;
    });

    await started;
    try {
      const localStarted = performance.now();
      await request(app).get('/favorites').expect(200, []);
      console.info(`GET /favorites mens upstream venter: ${(performance.now() - localStarted).toFixed(1)} ms`);
      expect(upstreamFinished).toBe(false);
    } finally {
      release();
    }
    expect((await pending).status).toBe(200);
  });
});
