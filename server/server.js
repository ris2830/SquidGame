const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { initializeSocket } = require('./socketHandler');
const { nanoid } = require('nanoid'); // Importiere nanoid hier, um es an rooms.js weiterzugeben

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = 3000;

app.use(express.static('../public'));
initializeSocket(io);

server.listen(port, () => {
    console.log(`Server lauscht auf Port ${port}`);
});