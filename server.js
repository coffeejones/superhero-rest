const createApp = require('./app');

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT skal være et heltal mellem 1 og 65535.');
  process.exit(1);
}

const server = createApp().listen(port, () => {
  console.log(`SuperHero REST kører på http://localhost:${port}`);
});

server.on('error', (error) => {
  console.error('Serveren kunne ikke starte:', error.message);
  process.exitCode = 1;
});
