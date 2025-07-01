const express = require('express');
const path = require('path');
const http = require('http'); // Node.js http Modul
const { Server } = require("socket.io"); // Socket.IO Server

const app = express();
const server = http.createServer(app); // Erstelle HTTP-Server mit der Express-App
const io = new Server(server); // Initialisiere Socket.IO mit dem HTTP-Server

const port = 3000;

// Statische Dateien aus dem 'public'-Verzeichnis bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// Spiel-Daten (In-Memory)
// Wir verwenden ein Objekt, um mehrere Spiele zu verwalten, identifiziert durch eine gameId
const games = {};
const words = ["Apfel", "Banane", "Kirsche", "Orange", "Mango", "Ananas", "Erdbeere", "Zitrone", "Pflaume", "Birne"]; // Beispielwörter

const MIN_PLAYERS = 3;
const MAX_PLAYERS_PER_GAME = 10; // Beispiel

function getGame(gameId) {
    if (!games[gameId]) {
        games[gameId] = {
            id: gameId,
            players: [], // { id: socket.id, name: playerName, role: null, word: null, hasVoted: false }
            gameStarted: false,
            currentWord: null,
            imposters: [], // List of player IDs
            votes: {}, // {votedPlayerId: count}
            messages: [], // Chat messages
            currentPhase: 'lobby', // lobby, discussion, voting, result
            timer: null, // Placeholder for game timer
            settings: { // Placeholder for game settings
                discussionTime: 300, // 5 minutes
                imposterCount: 1 // Default, kann angepasst werden
            }
        };
    }
    return games[gameId];
}

function getPlayer(game, playerId) {
    return game.players.find(p => p.id === playerId);
}

function broadcastGameState(gameId) {
    const game = getGame(gameId);
    if (game) {
        // Send full state to all players in the game room
        // For individual roles/words, send specific events
        io.to(gameId).emit('game_state', {
            id: game.id,
            players: game.players.map(p => ({ id: p.id, name: p.name, hasVoted: p.hasVoted, status: p.status || 'active' })), // Don't send role/word to everyone
            gameStarted: game.gameStarted,
            currentPhase: game.currentPhase,
            messages: game.messages,
            playerCount: game.players.length,
            // Weitere allgemeine Spielinfos hier
            timerValue: game.timerValue, // Hinzufügen des Timer-Werts
            votes: game.votes // Hinzufügen der aktuellen Stimmen (wer hat wen gewählt, oder wer wurde wie oft gewählt)
        });

        // Send individual role/word info
        game.players.forEach(player => {
            io.to(player.id).emit('player_info', { // Use a more specific event for sensitive info
                role: player.role,
                word: player.word,
                isImposter: game.imposters.includes(player.id)
            });
        });
    }
}

function startDiscussionPhase(game) {
    game.currentPhase = 'discussion';
    game.timerValue = game.settings.discussionTime; // z.B. 300 Sekunden
    game.votes = {}; // Reset votes for the new round
    game.players.forEach(p => p.hasVoted = false); // Reset vote status

    broadcastGameState(game.id);
    console.log(`Spiel ${game.id}: Diskussionsphase gestartet. Dauer: ${game.timerValue}s`);

    if (game.timer) clearInterval(game.timer); // Clear existing timer if any
    game.timer = setInterval(() => {
        game.timerValue--;
        if (game.timerValue <= 0) {
            clearInterval(game.timer);
            game.timer = null;
            startVotingPhase(game);
        } else {
            // Optional: Sende Timer-Updates häufiger, wenn gewünscht
            // io.to(game.id).emit('timer_update', { timerValue: game.timerValue });
            // Fürs Erste wird der Timer nur mit dem vollen game_state gesendet
            broadcastGameState(game.id); // Sendet den Timer mit dem Rest des Status
        }
    }, 1000);
}

function startVotingPhase(game) {
    game.currentPhase = 'voting';
    game.timerValue = game.settings.votingTime || 60; // z.B. 60 Sekunden für Abstimmung
    console.log(`Spiel ${game.id}: Abstimmungsphase gestartet. Dauer: ${game.timerValue}s`);
    broadcastGameState(game.id);

    if (game.timer) clearInterval(game.timer);
    game.timer = setInterval(() => {
        game.timerValue--;
        if (game.timerValue <= 0) {
            clearInterval(game.timer);
            game.timer = null;
            tallyVotesAndProceed(game);
        } else {
            broadcastGameState(game.id);
        }
    }, 1000);
}

function tallyVotesAndProceed(game) {
    if (game.currentPhase !== 'voting' && game.currentPhase !== 'discussion') return; // Nur von diesen Phasen aus

    console.log(`Spiel ${game.id}: Abstimmung wird ausgewertet.`);
    let mostVotes = 0;
    let votedPlayerId = null;
    let tie = false;

    // Zähle die Stimmen: game.votes ist {voterId: votedPlayerId}
    const voteCounts = {}; // {votedPlayerId: count}
    game.players.filter(p => p.status === 'active').forEach(player => {
        if (game.votes[player.id]) { // Wenn dieser Spieler eine Stimme für jemanden abgegeben hat
            const targetPlayerId = game.votes[player.id];
            voteCounts[targetPlayerId] = (voteCounts[targetPlayerId] || 0) + 1;
        }
    });

    console.log("Vote counts:", voteCounts);

    for (const playerId in voteCounts) {
        if (voteCounts[playerId] > mostVotes) {
            mostVotes = voteCounts[playerId];
            votedPlayerId = playerId;
            tie = false;
        } else if (voteCounts[playerId] === mostVotes) {
            tie = true;
        }
    }

    let eliminatedPlayer = null;
    if (votedPlayerId && !tie && mostVotes > 0) {
        eliminatedPlayer = getPlayer(game, votedPlayerId);
        if (eliminatedPlayer) {
            eliminatedPlayer.status = 'eliminated'; // Oder 'ghost'
            console.log(`Spiel ${game.id}: Spieler ${eliminatedPlayer.name} wurde eliminiert.`);
        }
    } else if (tie) {
        console.log(`Spiel ${game.id}: Unentschieden bei der Abstimmung.`);
    } else {
        console.log(`Spiel ${game.id}: Niemand hat genügend Stimmen erhalten oder niemand hat abgestimmt.`);
    }

    // Hier Logik für Spielende / nächste Runde einfügen
    // Fürs Erste gehen wir einfach zur "Ergebnis"-Anzeige der Runde über
    // und starten dann eine neue Diskussionsphase, wenn das Spiel nicht vorbei ist.

    game.currentPhase = 'result'; // Eine kurze Ergebnisphase
    broadcastGameState(game.id);

    // TODO: Implement proper game end conditions (imposters win, normals win)
    // For now, after a short delay, start a new round if game not over
    setTimeout(() => {
        if (checkWinConditions(game)) { // checkWinConditions setzt game.currentPhase auf 'gameOver' wenn nötig
            broadcastGameState(game.id); // Sende den finalen gameOver Status
            // Spiel ist vorbei, keine neue Runde starten.
            // Optional: Spiel nach einiger Zeit automatisch aufräumen/zurücksetzen
            // delete games[game.id]; // Oder eine Funktion zum Zurücksetzen des Spiels für eine neue Runde in der Lobby
        } else {
            // Spiel geht weiter, starte nächste Runde
            startDiscussionPhase(game);
        }
    }, 5000); // 5 Sekunden Ergebnis anzeigen (oder bis zum gameOver)
}

function checkWinConditions(game) {
    const activePlayers = game.players.filter(p => p.status === 'active');
    const activeImposters = activePlayers.filter(p => game.imposters.includes(p.id));
    const activeNormals = activePlayers.filter(p => !game.imposters.includes(p.id));

    let gameOver = false;
    if (activeImposters.length === 0 && game.gameStarted) { // gameStarted check to prevent win on initial empty state
        game.winnerTeam = 'Normal';
        game.reason = 'Alle Imposter wurden erfolgreich entlarvt!';
        gameOver = true;
    } else if (activeImposters.length >= activeNormals.length && activeNormals.length > 0) { // Imposter gewinnen bei Gleichstand oder Mehrheit (solange noch Normals da sind)
        game.winnerTeam = 'Imposter';
        game.reason = 'Die Imposter sind in der Überzahl oder gleichauf mit den Normalen!';
        gameOver = true;
    } else if (activeImposters.length > 0 && activeNormals.length === 0) { // Sollte nicht oft vorkommen, aber Imposter gewinnen, wenn nur noch sie übrig sind
        game.winnerTeam = 'Imposter';
        game.reason = 'Nur noch Imposter sind übrig!';
        gameOver = true;
    }


    if (gameOver) {
        console.log(`Spiel ${game.id} beendet. Gewinner: ${game.winnerTeam}. Grund: ${game.reason}`);
        game.currentPhase = 'gameOver';
        if (game.timer) {
            clearInterval(game.timer);
            game.timer = null;
        }
        // broadcastGameState(game.id); // Wird von der aufrufenden Funktion (tallyVotesAndProceed) gemacht
    }
    return gameOver;
}

// Anpassung in tallyVotesAndProceed:
// Die setTimeout-Logik muss checkWinConditions berücksichtigen.
// Die ursprüngliche tallyVotesAndProceed Funktion wird unten modifiziert.

io.on('connection', (socket) => {
    console.log(`Ein Benutzer verbunden: ${socket.id}`);

    socket.on('join_game', ({ gameId, playerName }) => {
        if (!gameId || !playerName) {
            socket.emit('error', 'Game ID und Spielername sind erforderlich.');
            return;
        }

        playerName = playerName.trim().slice(0, 20); // Sanitization
        gameId = gameId.trim().slice(0, 20);


        const game = getGame(gameId);
        game.settings.discussionTime = 180; // Beispiel: 3 Minuten Diskussionszeit
        game.settings.votingTime = 60;     // Beispiel: 1 Minute Abstimmzeit


        if (game.players.length >= MAX_PLAYERS_PER_GAME) {
            socket.emit('error', 'Dieses Spiel ist bereits voll.');
            return;
        }

        if (game.gameStarted) {
            socket.emit('error', 'Dieses Spiel hat bereits begonnen.');
            return;
        }

        if (game.players.find(p => p.name === playerName)) {
            socket.emit('error', 'Dieser Spielername ist in diesem Spiel bereits vergeben.');
            return;
        }

        socket.join(gameId); // Spieler dem Socket.IO Raum für das Spiel hinzufügen
        const newPlayer = { id: socket.id, name: playerName, role: null, word: null, hasVoted: false, status: 'active' };
        game.players.push(newPlayer);

        console.log(`Spieler ${playerName} (${socket.id}) ist Spiel ${gameId} beigetreten.`);

        // Informiere den beigetretenen Spieler über seinen Beitritt und den aktuellen Spielstatus
        socket.emit('game_joined', {
            gameId: game.id,
            myPlayerId: socket.id,
            players: game.players.map(p => ({ id: p.id, name: p.name })),
            gameStarted: game.gameStarted,
            currentPhase: game.currentPhase
        });

        // Informiere alle anderen Spieler im Raum über den neuen Spieler
        socket.to(gameId).emit('player_joined', {
            playerName: newPlayer.name,
            playerId: newPlayer.id,
            gameState: {
                 players: game.players.map(p => ({ id: p.id, name: p.name })),
                 playerCount: game.players.length
            }
        });
        broadcastGameState(gameId);
    });

    socket.on('start_game', () => {
        const gameId = Array.from(socket.rooms).find(room => room !== socket.id);
        if (!gameId) {
            socket.emit('error', 'Du bist in keinem Spiel, um es zu starten.');
            return;
        }

        const game = getGame(gameId);

        if (game.players.find(p => p.id === socket.id) !== game.players[0] && game.players.length > 0) {
            // Optional: Host-Logik
        }

        if (game.gameStarted) {
            socket.emit('error', 'Das Spiel hat bereits begonnen.');
            return;
        }

        if (game.players.length < MIN_PLAYERS) {
            socket.emit('error', `Nicht genügend Spieler. Benötigt: ${MIN_PLAYERS}, Vorhanden: ${game.players.length}`);
            return;
        }

        game.gameStarted = true;
        // game.currentPhase wird durch startDiscussionPhase gesetzt
        game.currentWord = words[Math.floor(Math.random() * words.length)];
        game.imposters = []; // Reset Imposters for new game

        let imposterCount = game.settings.imposterCount;
        if (game.players.length >= 6) imposterCount = 2;

        const availablePlayers = [...game.players];
        for (let i = 0; i < imposterCount; i++) {
            if (availablePlayers.length === 0) break;
            const randomIndex = Math.floor(Math.random() * availablePlayers.length);
            const imposter = availablePlayers.splice(randomIndex, 1)[0];
            imposter.role = 'Imposter';
            game.imposters.push(imposter.id);
        }

        game.players.forEach(player => {
            player.status = 'active'; // Ensure all players are active at game start
            player.hasVoted = false;  // Reset vote status
            if (player.role === 'Imposter') {
                player.word = "Du bist der Imposter!";
            } else {
                player.role = 'Normal';
                player.word = game.currentWord;
            }
        });

        game.votes = {}; // Reset votes for the new game

        console.log(`Spiel ${gameId} gestartet. Wort: ${game.currentWord}. Imposter: ${game.imposters.join(', ')}`);

        io.to(gameId).emit('game_started', { message: "Das Spiel beginnt jetzt!" });
        startDiscussionPhase(game); // Startet die erste Diskussionsphase
    });

    socket.on('cast_vote', ({ votedPlayerId }) => {
        const gameId = Array.from(socket.rooms).find(room => room !== socket.id);
        if (!gameId) return;
        const game = getGame(gameId);
        const voter = getPlayer(game, socket.id);

        if (!voter || voter.status !== 'active' || game.currentPhase !== 'voting') {
            socket.emit('error', "Abstimmung nicht möglich oder Phase ist nicht korrekt.");
            return;
        }
        if (voter.hasVoted) {
            socket.emit('error', "Du hast bereits abgestimmt.");
            return;
        }
        const targetPlayer = getPlayer(game, votedPlayerId);
        if (!targetPlayer || targetPlayer.status !== 'active') {
            socket.emit('error', "Ungültiges Ziel für die Abstimmung.");
            return;
        }
        if (targetPlayer.id === voter.id) {
            socket.emit('error', "Du kannst nicht für dich selbst stimmen.");
            return;
        }

        game.votes[voter.id] = votedPlayerId; // Speichert, für wen der Voter gestimmt hat
        voter.hasVoted = true;
        console.log(`Spieler ${voter.name} hat für ${targetPlayer.name} gestimmt in Spiel ${game.id}`);

        // Informiere den Spieler über erfolgreiche Stimmabgabe (optional)
        socket.emit('vote_confirmed', { votedPlayerId: votedPlayerId });

        broadcastGameState(game.id); // Update für alle mit den neuen Stimminfos (z.B. wer schon gevotet hat)

        // Prüfen, ob alle aktiven Spieler abgestimmt haben
        const activePlayers = game.players.filter(p => p.status === 'active');
        const allVoted = activePlayers.every(p => p.hasVoted);
        if (allVoted) {
            if (game.timer) clearInterval(game.timer); // Stoppe den Voting-Timer
            game.timer = null;
            tallyVotesAndProceed(game);
        }
    });

    socket.on('send_message', ({ message }) => {
        const gameId = Array.from(socket.rooms).find(room => room !== socket.id);
        if (!gameId) return;

        const game = getGame(gameId);
        const player = getPlayer(game, socket.id);

        if (!player || !message || message.trim() === "") return;

        const chatMessage = {
            senderId: player.id,
            senderName: player.name,
            text: message.trim().slice(0, 200), // Sanitization
            timestamp: new Date()
        };
        game.messages.push(chatMessage);
        if(game.messages.length > 100) game.messages.shift(); // Max 100 Nachrichten im Log halten

        io.to(gameId).emit('new_message', chatMessage);
    });


    socket.on('disconnect', () => {
        console.log(`Benutzer getrennt: ${socket.id}`);
        // Finde alle Spiele, in denen der Spieler war
        for (const gameId in games) {
            const game = games[gameId];
            const playerIndex = game.players.findIndex(p => p.id === socket.id);
            if (playerIndex > -1) {
                const playerName = game.players[playerIndex].name;
                game.players.splice(playerIndex, 1);
                console.log(`Spieler ${playerName} (${socket.id}) hat Spiel ${gameId} verlassen.`);

                // Wenn keine Spieler mehr im Spiel sind, Spiel löschen? Oder nach Zeit?
                if (game.players.length === 0 && !game.gameStarted) { // Nur leere Lobbies löschen
                    console.log(`Spiel ${gameId} ist leer und wird gelöscht.`);
                    delete games[gameId];
                } else {
                     // Informiere verbleibende Spieler
                    io.to(gameId).emit('player_left', {
                        playerName: playerName,
                        playerId: socket.id,
                        gameState: {
                            players: game.players.map(p => ({ id: p.id, name: p.name })),
                            playerCount: game.players.length
                        }
                    });
                    broadcastGameState(gameId); // Allgemeinen Status aktualisieren
                    // Nach dem Entfernen eines Spielers und dem Senden des Updates, prüfen ob das Spiel beendet ist
                    if (game.gameStarted && checkWinConditions(game)) {
                        broadcastGameState(gameId); // Sende den finalen gameOver Status
                    }
                }
                break;
            }
        }
    });
});

// Server starten - wichtig: server.listen statt app.listen, damit Socket.IO funktioniert
server.listen(port, () => {
  console.log(`Server lauscht auf http://localhost:${port}`);
  console.log(`Spiel erreichbar unter http://localhost:${port}/`);
});
