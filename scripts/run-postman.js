const newman = require('newman');
const createApp = require('../app');
const collection = require('../postman/superhero-rest.postman_collection.json');


const server = createApp().listen(0, '127.0.0.1', () => {
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  newman.run({
    collection,
    envVar: [{ key: 'baseUrl', value: baseUrl }],
    reporters: ['cli'],
    timeoutRequest: 10000,
  }, (error, summary) => {
    if (error) console.error('Postman-testene kunne ikke køres:', error.message);
    if (error || summary.run.failures.length) process.exitCode = 1;
    server.close();
  });
});

server.on('error', (error) => {
  console.error('Testserveren kunne ikke starte:', error.message);
  process.exitCode = 1;
});
