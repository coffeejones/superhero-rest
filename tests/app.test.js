const request = require('supertest');
const createApp = require('../app');
const HttpError = require('../utils/HttpError');

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

describe('SuperHero REST API', () => {
  test('GET /superheroes returnerer de fem krævede felter', async () => {
    const { app, heroModel } = setup();
    const response = await request(app).get('/superheroes').expect(200);

    expect(response.body).toEqual(heroes);
    expect(Object.keys(response.body[0]).sort()).toEqual(
      ['id', 'name', 'fullName', 'strength', 'image'].sort(),
    );
    expect(heroModel.getAll).toHaveBeenCalledTimes(1);
  });

  test('GET /superheroes/:id finder helten ud fra data', async () => {
    const { app } = setup();
    const response = await request(app).get('/superheroes/2').expect(200);
    expect(response.body).toEqual(heroes[1]);
  });

  test('en ukendt helt giver 404 både ved opslag og ved oprettelse af favorit', async () => {
    const { app } = setup();
    await request(app).get('/superheroes/999').expect(404);
    const response = await request(app)
      .post('/favorites')
      .send({ id: 999, note: 'Findes ikke' })
      .expect(404);

    expect(response.body.error).toEqual(expect.any(String));
    expect((await request(app).get('/favorites')).body).toEqual([]);
  });

  test('favorittens livscyklus: opret, læs, rediger note og slet', async () => {
    const { app } = setup();
    await request(app).get('/favorites').expect(200, []);
    const created = await request(app)
      .post('/favorites')
      .send({ id: 1, note: '  Min yndlingshelt!  ' })
      .expect(201);

    expect(created.body).toEqual({ id: 1, note: 'Min yndlingshelt!' });
    expect(created.headers.location).toBe('/favorites/1');
    await request(app).get('/favorites').expect(200, [created.body]);

    const updated = await request(app)
      .put('/favorites/1')
      .send({ note: '  En ny note  ' })
      .expect(200);
    expect(updated.body).toEqual({ id: 1, note: 'En ny note' });
    await request(app).get('/favorites').expect(200, [updated.body]);

    const deleted = await request(app).delete('/favorites/1').expect(204);
    expect(deleted.text).toBe('');
    await request(app).get('/favorites').expect(200, []);
  });

  test('en helt kan kun være favorit én gang', async () => {
    const { app } = setup();
    await request(app).post('/favorites').send({ id: 1, note: 'Første note' }).expect(201);
    await request(app).post('/favorites').send({ id: 1, note: 'Anden note' }).expect(409);
    await request(app).get('/favorites').expect(200, [{ id: 1, note: 'Første note' }]);
  });

  test.each([
    ['id mangler', { note: 'Min helt' }],
    ['note mangler', { id: 1 }],
    ['note er tom', { id: 1, note: '' }],
    ['note består af mellemrum', { id: 1, note: '   ' }],
    ['note er for kort', { id: 1, note: 'a' }],
    ['note er for lang', { id: 1, note: 'a'.repeat(501) }],
    ['note er ikke tekst', { id: 1, note: 123 }],
    ['id er tekst', { id: '1', note: 'Min helt' }],
    ['id er et decimaltal', { id: 1.5, note: 'Min helt' }],
    ['id er nul', { id: 0, note: 'Min helt' }],
    ['id er negativt', { id: -1, note: 'Min helt' }],
    ['id er for stort', { id: Number.MAX_SAFE_INTEGER + 1, note: 'Min helt' }],
    ['et ukendt felt medsendes', { id: 1, note: 'Min helt', admin: true }],
    ['body er et array', [{ id: 1, note: 'Min helt' }]],
    ['body er null', null],
  ])('POST afviser ugyldigt input: %s', async (_, body) => {
    const { app, heroModel } = setup();
    const response = await request(app).post('/favorites').set('Content-Type', 'application/json').send(body === null ? 'null' : body).expect(400);

    expect(response.body.error).toEqual(expect.any(String));
    expect(heroModel.getAll).not.toHaveBeenCalled();
    await request(app).get('/favorites').expect(200, []);
  });

  test.each([{}, { note: '' }, { note: 'a' }, { note: 'a'.repeat(501) }, { note: 'Gyldig', id: 2 }])(
    'PUT afviser en ugyldig note/body: %j',
    async (body) => {
      const { app } = setup();
      await request(app).post('/favorites').send({ id: 1, note: 'Oprindelig note' });
      await request(app).put('/favorites/1').send(body).expect(400);
      await request(app).get('/favorites').expect(200, [{ id: 1, note: 'Oprindelig note' }]);
    },
  );

  test.each(['abc', '0', '-1', '1.5', '1e2', '01', '9007199254740992']) (
    'alle endpoints med path-id afviser %s',
    async (id) => {
      const { app, heroModel } = setup();
      await request(app).get(`/superheroes/${id}`).expect(400);
      await request(app).delete(`/favorites/${id}`).expect(400);
      await request(app).put(`/favorites/${id}`).send({ note: 'Ny note' }).expect(400);
      expect(heroModel.getAll).not.toHaveBeenCalled();
    },
  );

  test('redigering og sletning af en ukendt favorit giver 404', async () => {
    const { app } = setup();
    await request(app).put('/favorites/1').send({ note: 'Ny note' }).expect(404);
    await request(app).delete('/favorites/1').expect(404);
  });

  test('fejlformateret JSON giver 400', async () => {
    const { app } = setup();
    const response = await request(app)
      .post('/favorites')
      .set('Content-Type', 'application/json')
      .send('{"id":1,')
      .expect(400);
    expect(response.body.error).toEqual(expect.any(String));
  });

  test('for stor JSON-body giver 413', async () => {
    const { app } = setup();
    await request(app)
      .post('/favorites')
      .send({ id: 1, note: 'a'.repeat(11 * 1024) })
      .expect(413);
  });

  test('ugyldig URL-kodning giver 400 uden interne detaljer', async () => {
    const { app, heroModel } = setup();
    const response = await request(app).get('/superheroes/%zz').expect(400);
    expect(response.body.error).toEqual(expect.any(String));
    expect(response.text).not.toContain('URIError');
    expect(heroModel.getAll).not.toHaveBeenCalled();
  });

  test('korrupt gzip-body giver 400, og appen kan stadig svare', async () => {
    const { app, heroModel } = setup();
    const response = await request(app).post('/favorites')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip')
      .send('broken')
      .expect(400);
    expect(response.body.error).toEqual(expect.any(String));
    expect(response.text).not.toContain('incorrect header check');
    expect(heroModel.getAll).not.toHaveBeenCalled();
    await request(app).get('/favorites').expect(200, []);
  });

  test.each(['post', 'put'])('%s kræver application/json', async (method) => {
    const { app } = setup();
    const url = method === 'post' ? '/favorites' : '/favorites/1';
    await request(app)[method](url)
      .set('Content-Type', 'text/plain')
      .send('id=1&note=Min helt')
      .expect(415);
  });

  test.each([
    ['Content-Type', 'application/json; charset=ukendt'],
    ['Content-Encoding', 'ukendt'],
  ])('en ukendt %s giver 415', async (header, value) => {
    const { app } = setup();
    await request(app).post('/favorites')
      .set('Content-Type', 'application/json')
      .set(header, value)
      .send('{"id":1,"note":"Min helt"}')
      .expect(415);
  });

  test('ukendte ruter giver JSON med 404', async () => {
    const { app } = setup();
    const response = await request(app).get('/findes-ikke').expect(404);
    expect(response.body.error).toEqual(expect.any(String));
  });

  test('en uventet intern fejl logges, men afslører ikke detaljer i svaret', async () => {
    const secret = 'Database-password=hemmeligt';
    const heroModel = { getAll: jest.fn().mockRejectedValue(new Error(secret)) };
    const logger = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { app } = setup({ heroModel });
      const response = await request(app).get('/superheroes').expect(500);
      expect(response.body.error).toEqual(expect.any(String));
      expect(JSON.stringify(response.body)).not.toContain(secret);
      expect(logger).toHaveBeenCalled();
    } finally {
      logger.mockRestore();
    }
  });

  test('upstream-fejl bevarer status, og lokale favoritter kan stadig læses og ændres', async () => {
    const { app, heroModel } = setup();
    await request(app).post('/favorites').send({ id: 1, note: 'Min helt' }).expect(201);
    const logger = jest.spyOn(console, 'error').mockImplementation(() => {});
    heroModel.getAll.mockRejectedValue(new HttpError(502, 'SuperHero API utilgængeligt'));
    try {
      await request(app).get('/superheroes').expect(502);
      await request(app).get('/favorites').expect(200, [{ id: 1, note: 'Min helt' }]);
      await request(app).put('/favorites/1').send({ note: 'Ny note' }).expect(200);
      await request(app).delete('/favorites/1').expect(204);
    } finally {
      logger.mockRestore();
    }
  });
});

