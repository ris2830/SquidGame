// server/server.js

// 1. Hole die nötigen Kern-Pakete
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

// 2. Hole unseren eigenen Code, der die Logik enthält
const { initializeSocket } = require('./socketHandler');

// 3. Erstelle die Server-Instanzen
const app = express();
const server = http.createServer(app);
const io = new Server(server); // Hier wird keine CORS-Regel mehr benötigt, da Apache das regelt
const port = 3000;

// 4. Sage Express, wo die statischen Dateien (HTML, CSS, client.js) liegen
app.use(express.static('../public'));

// 5. Übergebe die 'io'-Instanz an unseren Handler, der die ganze Arbeit macht
initializeSocket(io);

// 6. Starte den Server
server.listen(port, () => {
    console.log(`Server lauscht auf Port ${port}`);
});