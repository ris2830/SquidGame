const socket = io();

// --- State Variablen ---
let myPlayerId = null;
let currentRoomCode = null;
let isHost = false;

// --- UI Elemente ---
const screens = {
    start: document.getElementById('startScreen'),
    lobby: document.getElementById('lobbyScreen'),
    game: document.getElementById('gameScreen'),
    voting: document.getElementById('votingScreen'),
    results: document.getElementById('resultsScreen'),
};
const playerNameInput = document.getElementById('playerName');
const roomCodeInput = document.getElementById('roomCode');
const currentRoomCodeDisplay = document.getElementById('currentRoomCode');
const playersList = document.getElementById('playersList');
const readyBtn = document.getElementById('readyBtn');
const startGameBtn = document.getElementById('startGameBtn');
const gameTimerDisplay = document.getElementById('gameTimer');
const playerWordDisplay = document.getElementById('playerWord');
const roleInfoDisplay = document.getElementById('roleInfo');
const spyReveal = document.getElementById('spyReveal');
const wordReveal = document.getElementById('wordReveal');
const votingOptions = document.getElementById('votingOptions');
const submitVoteBtn = document.getElementById('submitVoteBtn');
const winnerText = document.getElementById('winnerText');
const revealWord = document.getElementById('revealWord');
const revealSpy = document.getElementById('revealSpy');
const votingResults = document.getElementById('votingResults');
const joinGameBtn = document.getElementById('joinGameBtn');
const createRoomBtn = document.getElementById('createRoomBtn');
// ... (readyBtn und startGameBtn hast du schon)
const startVotingBtn = document.getElementById('startVotingBtn');
// ... (submitVoteBtn hast du schon)
const playAgainBtn = document.getElementById('playAgainBtn');
const backToLobbyBtn = document.getElementById('backToLobbyBtn');


joinGameBtn.addEventListener('click', joinGame);
createRoomBtn.addEventListener('click', createRoom);
readyBtn.addEventListener('click', toggleReady);
startGameBtn.addEventListener('click', startGame);
startVotingBtn.addEventListener('click', () => { /* Diese Funktion war leer, definieren wir später */ });
submitVoteBtn.addEventListener('click', submitVote);
playAgainBtn.addEventListener('click', playAgain);
backToLobbyBtn.addEventListener('click', backToLobby);

// --- UI Funktionen ---
function showScreen(screenId) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenId].classList.add('active');
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    if (type === 'error') notification.style.background = 'rgba(244, 67, 54, 0.9)';
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// --- Event Emitter (Aktionen an den Server senden) ---
function joinGame() {
    const playerName = playerNameInput.value.trim();
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (!playerName) return showNotification('Bitte gib deinen Namen ein!', 'error');
    if (!roomCode) return showNotification('Bitte gib einen Raum-Code ein!', 'error');
    socket.emit('joinRoom', { playerName, roomCode });
}

function createRoom() {
    const playerName = playerNameInput.value.trim();
    if (!playerName) return showNotification('Bitte gib deinen Namen ein!', 'error');
    socket.emit('createRoom', { playerName });
}

function toggleReady() {
    socket.emit('toggleReady', { roomCode: currentRoomCode });
}

function startGame() {
    socket.emit('startGame', { roomCode: currentRoomCode });
}

function submitVote() {
    const selectedVoteId = document.querySelector('.vote-btn.selected')?.dataset.id;
    if (selectedVoteId) {
        socket.emit('submitVote', { roomCode: currentRoomCode, votedPlayerId: selectedVoteId });
        submitVoteBtn.disabled = true;
    }
}

function playAgain() {
    if(isHost) socket.emit('playAgain', { roomCode: currentRoomCode });
}

function backToLobby() {
    playAgain(); // Für Nicht-Hosts hat dies den gleichen Effekt
}

// --- Socket Event Listener (Daten vom Server empfangen) ---
socket.on('connect', () => {
    myPlayerId = socket.id;
});

socket.on('gameStateUpdate', (game) => {
    currentRoomCode = game.roomId;
    const me = game.players[myPlayerId];
    if (!me) return; // Noch nicht im Spiel
    isHost = me.isHost;

    switch (game.status) {
        case 'lobby':
            showScreen('lobby');
            updateLobby(game);
            break;
        case 'playing':
            showScreen('game');
            updateGameScreen(game);
            break;
        case 'voting':
            showScreen('voting');
            updateVotingScreen(game);
            break;
        case 'results':
            showScreen('results');
            updateResultsScreen(game);
            break;
    }
});

socket.on('canStartGame', () => {
    if(isHost) startGameBtn.classList.add('pulse');
});

socket.on('timerUpdate', (timeLeft) => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    gameTimerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    if(timeLeft <= 10) gameTimerDisplay.classList.add('pulse');
    else gameTimerDisplay.classList.remove('pulse');
});

socket.on('error', (message) => {
    showNotification(message, 'error');
});

// --- Update-Funktionen für die UI ---
// in public/client.js

function updateLobby(game) {
    currentRoomCodeDisplay.textContent = game.roomId;
    playersList.innerHTML = '';
    
    const playersArray = Object.values(game.players); // KORREKTUR HIER

    playersArray.forEach(p => { // Wir benutzen das neue Array
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        const statusClass = p.isReady ? 'status-ready' : 'status-online';
        const statusText = p.isReady ? 'Bereit' : 'Wartet';
        playerCard.innerHTML = `
            <div class="player-name">${p.name} ${p.isHost ? '👑' : ''}</div>
            <div class="player-status ${statusClass}">${statusText}</div>`;
        playersList.appendChild(playerCard);
    });

    const me = game.players[myPlayerId];
    readyBtn.textContent = me.isReady ? 'Warten...' : 'Bereit!';
    readyBtn.disabled = me.isReady;
    
    startGameBtn.style.display = isHost ? 'inline-block' : 'none';

    // KORREKTUR FÜR canStart LOGIK
    const allReady = playersArray.length >= 3 && playersArray.every(p => p.isReady);
    startGameBtn.disabled = !allReady;

    if (!allReady) {
        startGameBtn.classList.remove('pulse');
    }
}

function updateGameScreen(game) {
    const me = game.players[myPlayerId];
    spyReveal.style.display = me.role === 'SPY' ? 'block' : 'none';
    wordReveal.style.display = me.role === 'AGENT' ? 'block' : 'none';
    if(me.role === 'AGENT') {
        playerWordDisplay.textContent = game.word;
    }
}

function updateVotingScreen(game) {
    votingOptions.innerHTML = '';
    game.getPlayerList().forEach(p => {
        const voteBtn = document.createElement('button');
        voteBtn.className = 'vote-btn';
        voteBtn.textContent = p.name;
        voteBtn.dataset.id = p.id;
        if (p.id === myPlayerId) voteBtn.disabled = true; // Kann nicht für sich selbst stimmen
        
        voteBtn.onclick = () => {
            document.querySelectorAll('.vote-btn').forEach(btn => btn.classList.remove('selected'));
            voteBtn.classList.add('selected');
            submitVoteBtn.disabled = false;
        };
        votingOptions.appendChild(voteBtn);
    });
}

function updateResultsScreen(game) {
    const results = game.gameResults;
    winnerText.textContent = results.winner === 'AGENTS' ? '🎉 Die Agenten haben gewonnen!' : '🕵️ Der Spion hat gewonnen!';
    revealWord.textContent = results.word;
    revealSpy.textContent = results.spyName;
    
    votingResults.innerHTML = '<h3>Abstimmung:</h3>';
    results.voteCounts.forEach(r => {
        const p = document.createElement('p');
        p.textContent = `${r.name}: ${r.votes} Stimme(n)`;
        votingResults.appendChild(p);
    });
}