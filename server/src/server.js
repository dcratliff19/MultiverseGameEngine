const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const XPSystem = require('./systems/xp');
const SkillSystem = require('./systems/skills');
const CharacterSystem = require('./systems/character');
const CombatSystem = require('./systems/combat');
const PhysicsSystem = require('./systems/physics');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('../client/public')); // Serve client files

// Shared state
const sharedState = {
  players: {},
  enemies: {},
  mapSize: { width: 25, height: 25 }
};

// Initialize systems
const xpSystem = new XPSystem(sharedState);
const skillSystem = new SkillSystem(sharedState);
const characterSystem = new CharacterSystem(sharedState);
const combatSystem = new CombatSystem(sharedState);
const physicsSystem = new PhysicsSystem(sharedState);

// Physics loop
const PHYSICS_TICK_RATE = 1 / 60; // 60Hz
setInterval(() => {
  physicsSystem.update(PHYSICS_TICK_RATE);
  io.emit('physicsUpdate', {
    players: Object.fromEntries(
      Object.entries(sharedState.players).map(([id, p]) => [id, { x: p.x, z: p.z }])
    ),
    enemies: Object.fromEntries(
      Object.entries(sharedState.enemies).map(([id, e]) => [id, { x: e.x, z: e.z }])
    )
  });
}, 1000 / 60);

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Create character
  characterSystem.createCharacter(socket.id);
  physicsSystem.addPlayer(socket.id);

  // Send existing players and state
  socket.emit('existingPlayers', Object.keys(sharedState.players).filter(id => id !== socket.id));
  socket.broadcast.emit('playerJoined', { id: socket.id });

  socket.on('setColor', (data) => {
    characterSystem.updateCharacter(socket.id, { color: data.color });
    socket.broadcast.emit('playerColor', { id: socket.id, color: data.color });
  });

  socket.on('move', (data) => {
    physicsSystem.applyForce(socket.id, { x: data.x * sharedState.players[socket.id].speed, z: data.z * sharedState.players[socket.id].speed });
    xpSystem.addXP(socket.id, 1); // Example XP gain
  });

  socket.on('attack', (data) => {
    console.log(`Player ${socket.id} attacks ${data.targetId} with ${data.weaponType}`);
    const result = combatSystem.attack(socket.id, data.targetId, data.weaponType);
    console.log('Attack result:', result);
    if (result && result.killed) {
      xpSystem.addXP(socket.id, 10);
    }
    io.emit('combatUpdate', { attackerId: socket.id, targetId: data.targetId, result });
  });

  socket.on('switchWeapon', (weaponType) => {
    combatSystem.switchWeapon(socket.id, weaponType);
    socket.emit('weaponUpdated', { weapon: sharedState.players[socket.id].weapon });
  });

  socket.on('unlockSkill', (skillName) => {
    const success = skillSystem.unlockSkill(socket.id, skillName);
    if (success) {
      socket.emit('skillUnlocked', { skillName, skills: skillSystem.getSkills(socket.id) });
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete sharedState.players[socket.id];
    socket.broadcast.emit('playerLeft', { id: socket.id });
  });
});

// Spawn a test enemy
sharedState.enemies['enemy1'] = { x: 2, z: 2, health: 5 };
physicsSystem.addEnemy('enemy1');

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});