class XPSystem {
    constructor(sharedState) {
      this.sharedState = sharedState;
    }
  
    addXP(playerId, amount) {
      const player = this.sharedState.players[playerId];
      if (!player) return;
      player.xp = (player.xp || 0) + amount;
      return player.xp;
    }
  
    getXP(playerId) {
      const player = this.sharedState.players[playerId];
      return player ? player.xp || 0 : 0;
    }
  }
  
  module.exports = XPSystem;