jest.mock('axios');

const axios = require('axios');
const heroModel = require('../models/heroModel');

const rawHero = {
  id: 1,
  name: 'A-Bomb',
  biography: { fullName: 'Richard Milhouse Jones', publisher: 'Marvel Comics' },
  powerstats: { strength: 100, speed: 17 },
  images: { md: 'https://example.com/a-bomb.jpg' },
};

beforeEach(() => {
  jest.resetAllMocks();
});

test('henter data med en timeout og udvælger kun opgavens felter', async () => {
  axios.get.mockResolvedValue({ data: [rawHero] });

  await expect(heroModel.getAll()).resolves.toEqual([{
    id: 1,
    name: 'A-Bomb',
    fullName: 'Richard Milhouse Jones',
    strength: 100,
    image: 'https://example.com/a-bomb.jpg',
  }]);
  expect(axios.get).toHaveBeenCalledWith(
    'https://akabab.github.io/superhero-api/api/all.json',
    expect.objectContaining({ timeout: 5000 }),
  );
});

test('bevarer null som ukendt styrke', async () => {
  axios.get.mockResolvedValue({ data: [{ ...rawHero, powerstats: { strength: null } }] });
  expect((await heroModel.getAll())[0].strength).toBeNull();
});

test('netværksfejl bliver til 502', async () => {
  axios.get.mockRejectedValue(new Error('ENOTFOUND upstream'));
  await expect(heroModel.getAll()).rejects.toMatchObject({ status: 502 });
});

test.each(['ECONNABORTED', 'ETIMEDOUT'])('timeout %s bliver til 504', async (code) => {
  axios.get.mockRejectedValue(Object.assign(new Error('timeout'), { code }));
  await expect(heroModel.getAll()).rejects.toMatchObject({ status: 504 });
});

test.each([
  ['objekt i stedet for array', {}],
  ['null i stedet for array', null],
  ['null i array', [null]],
  ['forkert id', [{ ...rawHero, id: '1' }]],
  ['manglende navn', [{ ...rawHero, name: undefined }]],
  ['manglende biography', [{ ...rawHero, biography: undefined }]],
  ['forkert styrke', [{ ...rawHero, powerstats: { strength: '100' } }]],
  ['manglende billede', [{ ...rawHero, images: {} }]],
])('ugyldigt upstream-format: %s giver 502', async (_, data) => {
  axios.get.mockResolvedValue({ data });
  await expect(heroModel.getAll()).rejects.toMatchObject({ status: 502 });
});
