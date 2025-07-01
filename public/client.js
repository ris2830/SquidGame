// Mit diesem Befehl verbinden wir uns automatisch mit dem Server
const socket = io();

console.log("Versuche, mich mit dem Server zu verbinden...");

// Wir definieren, was passieren soll, wenn wir eine Nachricht namens 'hallo' bekommen
socket.on('hallo', (data) => {
  console.log('Nachricht vom Server:', data);
  // Später können wir hier die Nachricht auf der Webseite anzeigen!
});