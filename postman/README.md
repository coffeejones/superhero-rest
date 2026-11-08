# Postman

Importér `superhero-rest.postman_collection.json` i Postman og kør hele collectionen i rækkefølge med Collection Runner. `baseUrl` er som standard `http://localhost:3000`.

`npm run test:postman` starter en isoleret server og kører de samme kontroller automatisk. SuperHero API skal være tilgængeligt.

Collectionen bruger den første helt fra de aktuelle API-data. Den fjerner en eventuel eksisterende favorit for netop dette ID, tester oprettelse, redigering og sletning, og fjerner sin testfavorit til sidst. Kør derfor mod en testserver; en tidligere note for dette ID genskabes ikke. Andre favoritter ændres ikke.

De 18 requests kontrollerer alle fem krævede felter, CRUD, dubletter, ukendte helte, inputvalidering, ugyldig JSON, Content-Type og tomme 204-svar.
