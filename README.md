# SuperHero REST API

Express-API til at hente superhelte fra [SuperHero API](https://akabab.github.io/superhero-api/) og gemme favoritter med en note. Projektet indeholder også en lille dansk frontend uden framework.

## Kom i gang

Kræver Node.js 22 eller nyere og npm. Internetforbindelse bruges til superhelte og deres billeder; API-nøgle er ikke nødvendig.

```sh
npm ci
npm start
```

Åbn [http://localhost:3000](http://localhost:3000). `npm run dev` genstarter serveren, når du ændrer kode. Porten kan vælges med `PORT=3001 npm start`.

## Endpoints

| Metode | Sti | Resultat |
| --- | --- | --- |
| GET | `/superheroes` | Alle helte med kun `id`, `name`, `fullName`, `strength` og `image` |
| GET | `/superheroes/:id` | Én helt eller 404 |
| POST | `/favorites` | Opret favorit med `{ "id": 1, "note": "Min yndlingshelt!" }`; returnerer 201 |
| GET | `/favorites` | Favoritter som `[{ "id": 1, "note": "Min yndlingshelt!" }]` |
| PUT | `/favorites/:id` | Erstat noten med `{ "note": "Min nye note" }`; returnerer 200 |
| DELETE | `/favorites/:id` | Slet favorit; returnerer 204 uden body |

POST og PUT kræver `Content-Type: application/json`. ID skal være et positivt, sikkert heltal; i POST skal det være et JSON-tal. Noter trimmes og skal være 2–500 tegn. Ekstra felter afvises. Request-body er begrænset til 10 KB.

```sh
curl http://localhost:3000/superheroes/1
curl -X POST http://localhost:3000/favorites \
  -H 'Content-Type: application/json' \
  -d '{"id":1,"note":"Min yndlingshelt!"}'
curl -X PUT http://localhost:3000/favorites/1 \
  -H 'Content-Type: application/json' \
  -d '{"note":"En opdateret note"}'
curl http://localhost:3000/favorites
curl -X DELETE http://localhost:3000/favorites/1
```

Fejl returneres som `{ "error": "En forklaring" }`: 400 ved ugyldigt input/JSON, 404 ved ukendt helt, favorit eller rute, 409 ved en favorit, der allerede findes, 413 ved for stor body og 415 ved forkert content type. Eksterne netværksfejl eller ugyldige API-svar giver 502; timeout efter fem sekunder giver 504. Uventede interne fejl giver en generisk 500-besked. Serverfejl logges i konsollen, mens interne detaljer ikke sendes til klienten.

## Test

```sh
npm test
npm run test:load
npm run test:postman
```

`npm test` kører Jest og Supertest uden adgang til det eksterne API. Tests dækker CRUD, Joi-validering, API-fejl, timeout og samtidige requests. `npm run test:load` kører kun samtidighedstestene og viser målinger fra den lokale test. En kontrolleret, langsom API-request holdes åben, mens en anden request gennemføres; testen undersøger dermed, om ventetid spærrer for andre requests. Målingerne er observationer på din maskine, ikke en garanti for svartider i drift.

`npm run test:postman` starter en særskilt, tom app på en ledig port, kører Postman-collectionen med Newman og lukker appen bagefter. Den kræver internet og påvirker ikke den server, du eventuelt allerede kører. Kommandoen afslutter med en fejlkode, hvis en test fejler. Collectionen i `postman/` kan også importeres i Postman; ved manuel kørsel kan den ændre den valgte helts favorit på din server.

`npm audit --omit=dev` finder ingen kendte sårbarheder i serverens afhængigheder ved afleveringen. Jest/Newman har stadig audit-fund i deres underafhængigheder. En målrettet override opdaterer Newmans Handlebars til 4.7.10 og fjerner det kritiske fund; resten kræver ændringer i testværktøjerne. Kør kun collections og tests, du har tillid til.

## Struktur

```text
app.js                        Express-opsætning uden at åbne en port
server.js                     Serverens opstart
routes/heroRoutes.js          Ruter og valideringsmiddleware
controllers/heroController.js HTTP-input og -svar
services/heroService.js       Regler for helte og favoritter
models/heroModel.js           Asynkront API-kald og feltudvælgelse
models/favoriteModel.js       Det lokale favorit-array
validators/                  Joi-skemaer og validering af sti-ID
middlewares/errorHandler.js   Central fejlhåndtering
public/                       HTML, CSS og browser-JavaScript
tests/                        Automatiske tests
postman/                      Postman-collection
```

Controlleren oversætter HTTP til servicekald; service-laget kan bruges uden Express. `createApp()` kan få testmodeller ind som argumenter, så testene bruger kontrollerede data og ingen rigtig netværksforbindelse. Express 5 videresender afviste promises fra asynkrone controllere til den centrale fejlhåndtering.

Favoritter ligger i et array som krævet i opgaven. De deles af alle browsere, der bruger samme app-instans, og forsvinder ved genstart. To selvstændige app-instanser har hver deres array. Testene undersøger både denne isolation og to apps med samme model i én proces. Det giver ingen deling eller transaktioner på tværs af processer. Der er ingen database eller filskrivning; ved behov for varig, delt lagring er næste skridt en asynkron NoSQL-database med en unik nøgle på heltens ID.

Kontrol for dubletter og tilføjelse sker samlet uden `await` i favoritmodellen, også når de forudgående API-kald afsluttes samtidigt. Det kræver ingen Promise-kø eller låsemekanisme. Superhelte hentes ved hvert relevant API-kald uden cache; det holder løsningen enkel, men betyder, at opslag og oprettelse af favoritter afhænger af det eksterne API. Eksisterende favoritter kan stadig læses, redigeres og slettes ved nedbrud hos API'et.

Frontenden har et katalog med små portrætter, søgning på navn eller identitet, sortering og 12 helte pr. side. Favoritter og noter vises separat. Den henter favoritlisten igen efter ændringer og ved tilbagevenden til siden. Ændringer fra andre browsere kan også hentes manuelt; der er ingen realtidssynkronisering. Projektet har ingen login, så favoritlisten er fælles for brugerne på samme server.
