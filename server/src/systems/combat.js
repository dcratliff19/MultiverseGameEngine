class CombatSystem {
    constructor(sharedState) {
      this.sharedState = sharedState;
    }
  
    attack(attackerId, targetId, weaponType) {
      const attacker = this.sharedState.players[attackerId];
      const target = this.sharedState.enemies[targetId];
      if (!attacker || !target) return false;
  
      const distance = Math.hypot(attacker.x - target.x, attacker.z - target.z);
      let success = false;
  
      switch (weaponType) {
        case 'gun':
          if (distance < 10 && attacker.ammo > 0) {
            target.health -= attacker.damage;
            attacker.ammo -= 1;
            success = true;
          }
          break;
        case 'melee':
          if (distance < 2 && attacker.stamina >= 10) {
            target.health -= attacker.damage;
            attacker.stamina -= 10;
            success = true;
          }
          break;
        case 'knife':
          if (distance < 1 && attacker.stamina >= 5) {
            const isCritical = Math.random() > 0.7;
            target.health -= isCritical ? attacker.damage * 2 : attacker.damage;
            attacker.stamina -= 5;
            success = true;
          }
          break;
      }
  
      if (success && target.health <= 0) {
        delete this.sharedState.enemies[targetId];
        return { killed: true };
      }
      return { killed: false };
    }
  
    switchWeapon(playerId, weaponType) {
      const player = this.sharedState.players[playerId];
      if (!player || !['gun', 'melee', 'knife'].includes(weaponType)) return false;
      player.weapon = weaponType;
      return true;
    }
  }
  
  module.exports = CombatSystem;