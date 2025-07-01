const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, '..','public')));

// Route for the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..','public', 'index.html'));
});

// Game state
const games = new Map();
const players = new Map();

class Game {
    constructor(gameId) {
        this.id = gameId;
        this.players = new Map();
        this.status = 'waiting'; // waiting, playing, finished
        this.spy = null;
        this.location = null;
        this.locations = [
            'Bank', 'Flughafen', 'Krankenhaus', 'Hotel', 'Restaurant', 
            'Schule', 'Casino', 'Theater', 'Museum', 'Bibliothek',
            'Strand', 'Büro', 'Fitnessstudio', 'Supermarkt', 'Park',
            'U-Bahn', 'Kirche', 'Polizeistation', 'Feuerwehr', 'Zoo'
        ];
        this.timer = 300; // 5 minutes
        this.currentTurn = null;
        this.votes = new Map();
        this.gamePhase = 'discussion'; // discussion, voting
        this.roundHistory = [];
    }

    addPlayer(playerId, playerName) {
        if (this.players.size >= 8) return false;
        
        this.players.set(playerId, {
            id: playerId,
            name: playerName,
            role: null,
            isAlive: true,
            votes: 0,
            hasVoted: false
        });
        return true;
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        if (this.players.size < 3 && this.status === 'playing') {
            this.endGame('insufficient_players');
        }
    }

    startGame() {
        if (this.players.size < 3) return false;
        
        this.status = 'playing';
        this.assignRoles();
        this.startTimer();
        return true;
    }

    assignRoles() {
        const playerIds = Array.from(this.players.keys());
        const spyIndex = Math.floor(Math.random() * playerIds.length);
        this.spy = playerIds[spyIndex];
        this.location = this.locations[Math.floor(Math.random() * this.locations.length)];

        // Assign roles
        playerIds.forEach((id, index) => {
            const player = this.players.get(id);
            if (index === spyIndex) {
                player.role = 'spy';
            } else {
                player.role = 'civilian';
            }
        });

        // Set first turn randomly
        this.currentTurn = playerIds[Math.floor(Math.random() * playerIds.length)];
    }

    startTimer() {
        this.gameTimer = setInterval(() => {
            this.timer--;
            if (this.timer <= 0) {
                this.endDiscussion();
            }
        }, 1000);
    }

    endDiscussion() {
        this.gamePhase = 'voting';
        this.timer = 60; // 1 minute for voting
        clearInterval(this.gameTimer);
        
        this.gameTimer = setInterval(() => {
            this.timer--;
            if (this.timer <= 0) {
                this.processVotes();
            }
        }, 1000);
    }

    vote(voterId, targetId) {
        if (this.gamePhase !== 'voting') return false;
        if (!this.players.has(voterId) || !this.players.has(targetId)) return false;
        
        const voter = this.players.get(voterId);
        if (voter.hasVoted) return false;

        // Remove previous vote if exists
        if (this.votes.has(voterId)) {
            const previousTarget = this.votes.get(voterId);
            const prevPlayer = this.players.get(previousTarget);
            if (prevPlayer) prevPlayer.votes--;
        }

        // Add new vote
        this.votes.set(voterId, targetId);
        const target = this.players.get(targetId);
        target.votes++;
        voter.hasVoted = true;

        return true;
    }

    processVotes() {
        clearInterval(this.gameTimer);
        
        // Find player with most votes
        let maxVotes = 0;
        let eliminatedPlayer = null;
        
        this.players.forEach(player => {
            if (player.votes > maxVotes) {
                maxVotes = player.votes;
                eliminatedPlayer = player;
            }
        });

        if (eliminatedPlayer && maxVotes > 0) {
            eliminatedPlayer.isAlive = false;
            
            // Check win conditions
            if (eliminatedPlayer.role === 'spy') {
                this.endGame('civilians_win');
            } else {
                // Check if spy is last remaining
                const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
                const aliveCivilians = alivePlayers.filter(p => p.role === 'civilian');
                
                if (aliveCivilians.length <= 1) {
                    this.endGame('spy_wins');
                } else {
                    // Continue game
                    this.resetForNextRound();
                }
            }
        } else {
            // No one eliminated, continue
            this.resetForNextRound();
        }
    }

    resetForNextRound() {
        // Reset votes
        this.players.forEach(player => {
            player.votes = 0;
            player.hasVoted = false;
        });
        this.votes.clear();
        
        // Start new discussion phase
        this.gamePhase = 'discussion';
        this.timer = 300;
        this.startTimer();
    }

    endGame(reason) {
        this.status = 'finished';
        clearInterval(this.gameTimer);
        
        const result = {
            reason,
            spy: this.spy,
            location: this.location,
            winner: reason === 'spy_wins' ? 'spy' : 'civilians'
        };
        
        return result;
    }

    getGameState() {
        return {
            id: this.id,
            status: this.status,
            players: Array.from(this.players.values()),
            timer: this.timer,
            currentTurn: this.currentTurn,
            gamePhase: this.gamePhase,
            location: this.status === 'finished' ? this.location : null
        };
    }

    getPlayerState(playerId) {
        const player = this.players.get(playerId);
        if (!player) return null;

        return {
            ...this.getGameState(),
            myRole: player.role,
            location: player.role === 'civilian' ? this.location : null
        };
    }
}

// Socket handling
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('join_game', (data) => {
        const { gameId, playerName } = data;
        
        if (!gameId || !playerName) {
            socket.emit('error', 'Game ID and player name required');
            return;
        }

        // Get or create game
        let game = games.get(gameId);
        if (!game) {
            game = new Game(gameId);
            games.set(gameId, game);
        }

        // Add player to game
        if (!game.addPlayer(socket.id, playerName)) {
            socket.emit('error', 'Game is full or already started');
            return;
        }

        // Store player info
        players.set(socket.id, { gameId, playerName });
        
        // Join socket room
        socket.join(gameId);
        
        // Send game state
        socket.emit('game_joined', game.getPlayerState(socket.id));
        socket.to(gameId).emit('player_joined', {
            playerName,
            gameState: game.getGameState()
        });
    });

    socket.on('start_game', () => {
        const playerInfo = players.get(socket.id);
        if (!playerInfo) return;

        const game = games.get(playerInfo.gameId);
        if (!game) return;

        if (game.startGame()) {
            io.to(playerInfo.gameId).emit('game_started', {
                message: 'Game started! Find the spy!'
            });
            
            // Send individual game states
            game.players.forEach((player, playerId) => {
                io.to(playerId).emit('game_state', game.getPlayerState(playerId));
            });
        }
    });

    socket.on('send_message', (data) => {
        const playerInfo = players.get(socket.id);
        if (!playerInfo) return;

        const game = games.get(playerInfo.gameId);
        if (!game || game.status !== 'playing') return;

        const message = {
            playerId: socket.id,
            playerName: playerInfo.playerName,
            message: data.message,
            timestamp: Date.now()
        };

        io.to(playerInfo.gameId).emit('new_message', message);
    });

    socket.on('vote', (data) => {
        const playerInfo = players.get(socket.id);
        if (!playerInfo) return;

        const game = games.get(playerInfo.gameId);
        if (!game) return;

        if (game.vote(socket.id, data.targetId)) {
            io.to(playerInfo.gameId).emit('vote_cast', {
                voterId: socket.id,
                targetId: data.targetId,
                gameState: game.getGameState()
            });

            // Check if all players voted
            const alivePlayers = Array.from(game.players.values()).filter(p => p.isAlive);
            const votedPlayers = alivePlayers.filter(p => p.hasVoted);
            
            if (votedPlayers.length === alivePlayers.length) {
                setTimeout(() => game.processVotes(), 1000);
            }
        }
    });

    socket.on('spy_guess', (data) => {
        const playerInfo = players.get(socket.id);
        if (!playerInfo) return;

        const game = games.get(playerInfo.gameId);
        if (!game || game.status !== 'playing') return;

        const player = game.players.get(socket.id);
        if (player.role !== 'spy') return;

        const isCorrect = data.location.toLowerCase() === game.location.toLowerCase();
        const result = game.endGame(isCorrect ? 'spy_wins' : 'civilians_win');
        
        io.to(playerInfo.gameId).emit('game_ended', {
            ...result,
            spyGuess: data.location,
            correct: isCorrect
        });
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        const playerInfo = players.get(socket.id);
        if (playerInfo) {
            const game = games.get(playerInfo.gameId);
            if (game) {
                game.removePlayer(socket.id);
                socket.to(playerInfo.gameId).emit('player_left', {
                    playerName: playerInfo.playerName,
                    gameState: game.getGameState()
                });

                // Clean up empty games
                if (game.players.size === 0) {
                    games.delete(playerInfo.gameId);
                }
            }
            players.delete(socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🕵️ Spy Game Server running on port ${PORT}`);
    console.log(`🌐 Open http://localhost:${PORT} to play!`);
});