// 1. Module laden
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3000; // Wir lassen die App auf Port 3000 laufen

// 2. Deine HTML/CSS/JS Dateien für die Freunde bereitstellen
app.use(express.static(__dirname));

// 3. Die Echtzeit-Logik (Das ist die Magie!)
io.on('connection', (socket) => {
    console.log('Ein neuer Spieler ist verbunden!');

    // Wenn ein Spieler einem Raum beitreten will
    socket.on('joinRoom', (roomCode) => {
        socket.join(roomCode);
        console.log(`Spieler ist Raum ${roomCode} beigetreten.`);
        // Allen anderen im Raum sagen, dass jemand Neues da ist
        io.to(roomCode).emit('userJoined', 'Ein neuer Spion hat den Raum betreten!');
    });

    // Wenn ein Spieler die Verbindung trennt
    socket.on('disconnect', () => {
        console.log('Ein Spieler hat die Verbindung getrennt.');
    });
});

// 4. Den Server starten
server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
