// 1. Wir holen uns unsere Werkzeuge
const express = require('express');
const http = require('http'); // Brauchen wir jetzt zusätzlich
const { Server } = require("socket.io"); // Das ist die "magische Post"

// 2. Wir erstellen die App und den Server
const app = express();
const server = http.createServer(app); // Wir erstellen einen "normalen" Server
const io = new Server(server); // Und heften die "magische Post" an diesen Server
const port = 3000;

// 3. Wir sagen wieder, wo die Webseite (das Frontend) liegt
app.use(express.static('../public'));

// 4. NEU: Wir lauschen jetzt auf neue Verbindungen von Spielern
io.on('connection', (socket) => {
  // Dieser Code wird jedes Mal ausgeführt, wenn ein neuer Spieler die Seite öffnet
  console.log('Ein Spieler hat sich verbunden!');

  // Wir senden eine persönliche Willkommensnachricht an NUR diesen Spieler
  socket.emit('hallo', { nachricht: 'Willkommen im Spiel!' });
});

// 5. Wir starten den Server zum Lauschen
server.listen(port, () => {
  console.log(`Server lauscht auf Port ${port}`);
});