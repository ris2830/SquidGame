const Player = require('./Player');

class Game {
  constructor(roomId, hostPlayer, wordList) {
    this.roomId = roomId;
    this.hostId = hostPlayer.id;
    this.players = {};
    this.status = 'lobby'; // lobby, playing, voting, results
    this.word = '';
    this.spyId = null;
    this.votes = {};
    this.gameResults = null;
    this.wordList = wordList;

    this.addPlayer(hostPlayer, true);
  }

  // Spieler-Management
  addPlayer(player, isHost = false) {
    player.isHost = isHost;
    this.players[player.id] = player;
  }

  removePlayer(playerId) {
    delete this.players[playerId];
    if (this.getPlayerList().length > 0 && playerId === this.hostId) {
      this.hostId = this.getPlayerList()[0].id;
      this.players[this.hostId].isHost = true;
    }
  }

  getPlayerList() {
    return Object.values(this.players);
  }

  togglePlayerReady(playerId) {
    const player = this.players[playerId];
    if (player) {
      player.isReady = !player.isReady;
    }
  }
  
  canStart() {
    const players = this.getPlayerList();
    if (players.length < 3) return false;
    return players.every(p => p.isReady);
  }

  // Spiel-Logik
  start() {
    this.status = 'playing';
    this.word = this.wordList[Math.floor(Math.random() * this.wordList.length)];
    const playersArray = this.getPlayerList();
    const spy = playersArray[Math.floor(Math.random() * playersArray.length)];
    this.spyId = spy.id;
    playersArray.forEach(p => {
      p.role = p.id === this.spyId ? 'SPY' : 'AGENT';
    });
  }

  handleVote(voterId, votedPlayerId) {
    if (this.players[voterId] && this.players[votedPlayerId]) {
      this.votes[voterId] = votedPlayerId;
    }
  }

  areAllVotesIn() {
    return Object.keys(this.votes).length === this.getPlayerList().length;
  }

  calculateResults() {
    const voteCounts = {};
    Object.values(this.votes).forEach(votedId => {
      voteCounts[votedId] = (voteCounts[votedId] || 0) + 1;
    });

    let maxVotes = 0;
    let mostVotedId = null;
    for (const [playerId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        mostVotedId = playerId;
      }
    }

    const spyFound = mostVotedId === this.spyId;
    this.status = 'results';
    this.gameResults = {
      winner: spyFound ? 'AGENTS' : 'SPY',
      word: this.word,
      spyName: this.players[this.spyId].name,
      voteCounts: this.getPlayerList().map(p => ({ 
        name: p.name, 
        votes: voteCounts[p.id] || 0 
      }))
    };
    return this.gameResults;
  }

  resetForNewRound() {
    this.status = 'lobby';
    this.word = '';
    this.spyId = null;
    this.votes = {};
    this.gameResults = null;
    this.getPlayerList().forEach(p => {
      p.isReady = false;
      p.role = null;
    });
  }
}
module.exports = Game;