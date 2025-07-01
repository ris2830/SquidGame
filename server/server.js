const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = 3000;

app.use(express.static('../public'));

// NEU: Ein Ort, um alle verbundenen Spieler zu speichern
let spieler = [];

io.on('connection', (socket) => {
  console.log(`Ein Spieler hat sich verbunden! (ID: ${socket.id})`);

  // Was passiert, wenn ein Spieler die Nachricht 'spielBeitreten' sendet
  socket.on('spielBeitreten', (data) => {
    const neuerSpieler = {
      id: socket.id,
      name: data.name
    };
    spieler.push(neuerSpieler);
    console.log(`${neuerSpieler.name} ist dem Spiel beigetreten.`);

    // Sende die neue, komplette Spielerliste an ALLE verbundenen Spieler
    io.emit('spielerlisteUpdate', spieler);
  });

  // Was passiert, wenn ein Spieler die Seite schließt (Verbindung trennt)
  socket.on('disconnect', () => {
    console.log(`Ein Spieler hat die Verbindung getrennt! (ID: ${socket.id})`);
    // Finde heraus, wer gegangen ist
    const verlassenderSpieler = spieler.find(s => s.id === socket.id);
    // Entferne den Spieler aus unserer Liste
    spieler = spieler.filter(s => s.id !== socket.id);

    if (verlassenderSpieler) {
      console.log(`${verlassenderSpieler.name} hat das Spiel verlassen.`);
    }
    
    // Sende die aktualisierte Liste an die verbleibenden Spieler
    io.emit('spielerlisteUpdate', spieler);
  });
});

server.listen(port, () => {
  console.log(`Server lauscht auf Port ${port}`);
});