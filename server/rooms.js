const Game = require('./game/Game');
const { nanoid } = require('nanoid');

let activeRooms = {};

function createRoom(hostPlayer, wordList) {
  const roomId = nanoid(6).toUpperCase();
  const game = new Game(roomId, hostPlayer, wordList);
  activeRooms[roomId] = game;
  return game;
}

function getRoom(roomId) {
  return activeRooms[roomId];
}

function removePlayerFromAllRooms(playerId) {
    let affectedRoomId = null;
    for (const roomId in activeRooms) {
        const game = activeRooms[roomId];
        if (game.players[playerId]) {
            affectedRoomId = roomId;
            game.removePlayer(playerId);
            if (game.getPlayerList().length === 0) {
                delete activeRooms[roomId];
            }
            break;
        }
    }
    return affectedRoomId;
}

module.exports = { createRoom, getRoom, removePlayerFromAllRooms };