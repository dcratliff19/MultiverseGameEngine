const CANNON = require('cannon-es'); // Updated from 'cannon'
class PhysicsSystem {
  constructor(sharedState) {
    this.sharedState = sharedState;
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.8, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 10;
  }

  addPlayer(playerId) {
    const player = this.sharedState.players[playerId];
    if (!player) return;
    const body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Sphere(0.5)
    });
    body.position.set(player.x, 0.5, player.z);
    this.world.addBody(body);
    player.physicsBody = body;
  }

  addEnemy(enemyId) {
    const enemy = this.sharedState.enemies[enemyId];
    if (!enemy) return;
    const body = new CANNON.Body({
      mass: 2,
      shape: new CANNON.Box(new CANNON.Vec3(0.5, 1, 0.5))
    });
    body.position.set(enemy.x, 1, enemy.z);
    this.world.addBody(body);
    enemy.physicsBody = body;
  }

  update(delta) {
    this.world.step(delta);
    for (let id in this.sharedState.players) {
      const body = this.sharedState.players[id].physicsBody;
      if (body) {
        this.sharedState.players[id].x = body.position.x;
        this.sharedState.players[id].z = body.position.z;
      }
    }
    for (let id in this.sharedState.enemies) {
      const body = this.sharedState.enemies[id].physicsBody;
      if (body) {
        this.sharedState.enemies[id].x = body.position.x;
        this.sharedState.enemies[id].z = body.position.z;
      }
    }
  }

  applyForce(playerId, force) {
    const player = this.sharedState.players[playerId];
    if (player && player.physicsBody) {
      player.physicsBody.applyForce(new CANNON.Vec3(force.x, 0, force.z), player.physicsBody.position);
    }
  }
}

module.exports = PhysicsSystem;