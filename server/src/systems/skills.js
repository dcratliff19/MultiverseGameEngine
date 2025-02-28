class SkillSystem {
    constructor(sharedState) {
      this.sharedState = sharedState;
      this.skillTree = {
        speed: { cost: 50, effect: (player) => player.speed += 0.1 },
        strength: { cost: 100, effect: (player) => player.damage += 1 },
        agility: { cost: 75, effect: (player) => player.staminaRegen += 0.5 }
      };
    }
  
    unlockSkill(playerId, skillName) {
      const player = this.sharedState.players[playerId];
      if (!player || !this.skillTree[skillName]) return false;
      const skill = this.skillTree[skillName];
      if (player.xp >= skill.cost) {
        player.xp -= skill.cost;
        skill.effect(player);
        player.skills = player.skills || [];
        player.skills.push(skillName);
        return true;
      }
      return false;
    }
  
    getSkills(playerId) {
      const player = this.sharedState.players[playerId];
      return player ? player.skills || [] : [];
    }
  }
  
  module.exports = SkillSystem;