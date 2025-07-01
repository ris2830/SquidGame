const { createRoom, getRoom, removePlayerFromAllRooms } = require('./rooms');
const Player = require('./game/Player');

// Deine große Wörterliste
const WORD_LIST = [
    "STRAND", "BERG", "WALD", "STADT", "KIRCHE", "SCHULE", "KRANKENHAUS", "FLUGHAFEN", "RESTAURANT", "KINO", 
    "MUSEUM", "ZOO", "SUPERMARKT", "POLIZEI", "HOTEL", "BRÜCKE", "AUTOBAHN", "ARZT", "LEHRER", "KOCH", 
    "PILOT", "BAUER", "HUND", "KATZE", "PFERD", "LÖWE", "ELEFANT", "AFFE", "ADLER", "HAI", "PIZZA", 
    "BURGER", "SALAT", "KAFFEE", "BIER", "FUSSBALL", "TENNIS", "SCHWIMMEN", "RADFAHREN", "GOLF", "SCHACH",
    "HANDY", "COMPUTER", "FERNSEHER", "KAMERA", "UHR", "BETT", "STUHL", "TISCH", "LAMPE", "SONNE", "MOND", "STERN"
];

function initializeSocket(io) {
  io.on('connection', (socket) => {
    
    const emitGameState = (roomId) => {
      const game = getRoom(roomId);
      if (game) io.to(roomId).emit('gameStateUpdate', game);
    };

    socket.on('createRoom', ({ playerName }) => {
      const player = new Player(socket.id, playerName);
      const game = createRoom(player, WORD_LIST);
      socket.join(game.roomId);
      emitGameState(game.roomId);
    });

    socket.on('joinRoom', ({ playerName, roomCode }) => {
      const game = getRoom(roomCode);
      if (game && game.status === 'lobby') {
        const player = new Player(socket.id, playerName);
        game.addPlayer(player);
        socket.join(roomCode);
        emitGameState(roomCode);
      } else {
        socket.emit('error', 'Raum nicht gefunden oder Spiel läuft bereits.');
      }
    });

    socket.on('toggleReady', ({ roomCode }) => {
      const game = getRoom(roomCode);
      if (game) {
        game.togglePlayerReady(socket.id);
        if (game.canStart()) {
            io.to(roomCode).emit('canStartGame');
        }
        emitGameState(roomCode);
      }
    });

    socket.on('startGame', ({ roomCode }) => {
      const game = getRoom(roomCode);
      if (game && game.hostId === socket.id && game.canStart()) {
        game.start();
        emitGameState(roomCode);
        // Timer starten
        let timer = 300;
        const interval = setInterval(() => {
          timer--;
          io.to(roomCode).emit('timerUpdate', timer);
          if (timer <= 0 || game.status !== 'playing') {
            clearInterval(interval);
            if(game.status === 'playing') { // Nur wenn nicht schon manuell beendet
              game.status = 'voting';
              emitGameState(roomCode);
            }
          }
        }, 1000);
      }
    });

    socket.on('submitVote', ({ roomCode, votedPlayerId }) => {
        const game = getRoom(roomCode);
        if (game && game.status === 'voting') {
            game.handleVote(socket.id, votedPlayerId);
            if (game.areAllVotesIn()) {
                game.calculateResults();
            }
            emitGameState(roomCode);
        }
    });

    socket.on('playAgain', ({ roomCode }) => {
        const game = getRoom(roomCode);
        if (game && game.hostId === socket.id && game.status === 'results') {
            game.resetForNewRound();
            emitGameState(roomCode);
        }
    });

    socket.on('disconnect', () => {
        const roomId = removePlayerFromAllRooms(socket.id);
        if (roomId) {
            emitGameState(roomId);
        }
    });
  });
}
module.exports = { initializeSocket };