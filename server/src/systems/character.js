class CharacterSystem {
    constructor(sharedState) {
      this.sharedState = sharedState;
    }
  
    createCharacter(playerId, name, color) {
      const player = {
        x: 0,
        z: 0,
        xp: 0,
        speed: 0.1,
        damage: 1,
        stamina: 100,
        staminaRegen: 1,
        ammo: 30,
        health: 100,
        character: {
          name: name || `Player${playerId.slice(0, 4)}`,
          color: color || this.randomColor()
        },
        weapon: 'gun' // Default weapon
      };
      this.sharedState.players[playerId] = player;
      return player;
    }
  
    updateCharacter(playerId, updates) {
      const player = this.sharedState.players[playerId];
      if (!player) return;
      Object.assign(player.character, updates);
    }
  
    randomColor() {
      return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
    }
  }
  
  module.exports = CharacterSystem;