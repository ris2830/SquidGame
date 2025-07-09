const { createRoom, getRoom, removePlayerFromAllRooms } = require('./rooms');
const Player = require('./game/Player');

// Deine große Wörterliste
const WORD_LIST = [
"STRAND", "MITTERNACHT", "BERGHÜTTE", "MARKTPLATZ", "STADTPARK", "FESTIVAL", "JUGENDHERBERGE", "KIRCHE", "BAHNHOF", "U-BAHN", 
"FLUGHAFEN", "BRÜCKE", "GARTEN", "MÜNZE", "ALPEN", "SEE", "MEER", "KNEIPE", "CAFÉ", "BADESEE", 
"WALD", "BIBLIOTHEK", "SCHULE", "UNIVERSITÄT", "KRANKENHAUS", "POLIZEIWACHE", "POST", "FEUERWACHE", "MUSEUM", "KUNSTHALLE",
"KINO", "THEATER", "OPERNHAUS", "CONCERT", "MESSE", "STADION", "ARENA", "TENNISPLATZ", "SCHWIMMBAD", "FITNESSSTUDIO",
"SAUNA", "WELLNESSHOTEL", "CAMPINGPLATZ", "ZELT", "BAUERNHOF", "SCHLOSS", "BURG", "RUINE", "KATAKOMBEN", "KELLER",
"DACHBODEN", "MARKTHALLE", "SUPERMARKT", "EISDIELE", "RESTAURANT", "IMBISS", "FOODTRUCK", "BIERGARTEN", "WEINFEST", "STAMMTISCH",
"DISKOTHEK", "BAR", "CLUB", "LOUNGE", "CASINO", "SPIELHALLE", "RATHAUS", "BÜRGERBÜRO", "KREISVERWALTUNG", "FINANZAMT",
"STRASSENECKE", "KREUZUNG", "FUSSGÄNGERZONE", "BAUSTELLE", "AUTOBAHN", "TANKSTELLE", "RASTSTÄTTE", "WERKSTATT", "GARAGE", "PARKPLATZ",
"TIEFGARAGE", "AUFZUG", "ROLLTREPPE", "EINGANGSHALLE", "LOBBY", "HOTELZIMMER", "SUITE", "REZEPTION", "SPA", "KONFERENZRAUM",
"VORLESUNGSSAAL", "KLASSENZIMMER", "AULA", "KANTINE", "MENSA", "PAUSENHOF", "SPIELPLATZ", "BOLZPLATZ", "KLETTERWAND", "SKATEPARK",
"RADSTATION", "BUSBAHNHOF", "TAXISTAND", "HAFEN", "ANLEGESTELLE", "FÄHRE", "LEUCHTTURM", "BOOTSVERLEIH", "JACHTHAFEN", "SEGELCLUB",
"RUDERCLUB", "GOLFPLATZ", "MINIGOLF", "REITSTALL", "AQUARIUM", "TIERPARK", "SAFARIPARK", "BOTANISCHER GARTEN", "PALMENHAUS", "WINTERGARTEN",
"BLUMENLADEN", "FRISEURSALON", "TATTOOSTUDIO", "NAGELSTUDIO", "FITNESSRAUM", "YOGASTUDIO", "THERMALBAD", "SAUNALANDSCHAFT", "SPORTHALLE", "KLETTERHALLE",
"TRAMPOLINPARK", "BOWLINGBAHN", "KARTBAHN", "ESCAPE ROOM", "LASERTAG", "SPIELHÖLLE", "KINDERSPIELPARADIES", "VERGNÜGUNGSPARK", "JAHRMARKT", "OKTOBERFEST",
"KIRMES", "ZIRKUS", "CAMPUS", "INNENHOF", "TERRASSE", "BALKON", "GÄRTNEREI", "BAUMSCHULE", "FRIEDHOF", "MAUSOLEUM",
"GRAB", "GEDENKSTÄTTE", "MAHNMAL", "DENKMAL", "STADTTOR", "AUSSICHTSTURM", "FESTUNG", "OBSERVATORIUM", "SENDEMAST", "SENDERAUM",
"RADIOSTATION", "FERNSEHSTUDIO", "TONSTUDIO", "BÜCHEREI", "ARCHIV", "STADTARCHIV", "ZEITUNG", "REDAKTION", "DRUCKEREI", "BUCHLADEN",
"COMICLADEN", "PLATTENLADEN", "VINYLBAR", "SPIELWARLADEN", "MODEHAUS", "KONFEKTIONSGESCHÄFT", "PARFÜMERIE", "JUWELIER", "ELEKTROMARKT", "MÖBELHAUS",
"BAUMARKT", "GARTENCENTER", "WOHNUNG", "EINFAMILIENHAUS", "VILLA", "DACHGESCHOSS", "PENTHOUSE", "ALTBAU", "NEUBAU", "LOFT",
"HOLZHAUS", "FERIENHAUS", "SCHLAFSAAL", "ZELTLAGER", "HÜTTENDORF", "FERIENDORF", "MOTORHOME", "CAMPER", "WOHNWAGEN", "STELLPLATZ"
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
        let timer = 600;
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