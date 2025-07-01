class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.isHost = false;
    this.isReady = false;
    this.role = null; // 'AGENT' oder 'SPY'
    this.votedFor = null; // Für wen dieser Spieler gestimmt hat
  }
}
module.exports = Player;