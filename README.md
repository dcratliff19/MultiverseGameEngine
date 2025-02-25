Below is a consolidated `README.md` that incorporates all the previous content—your initial roadmap for the "Multiverse Game Engine," the PVE shared mechanics with guns, melee, and knives, and the shared physics engine with limitations—into a single markdown code block. This combines everything into a cohesive document you can download and use as your project's roadmap.

---

# Multiverse Game Engine - Development Roadmap

## Overview
The **Multiverse Game Engine** is a framework for creating multiplayer PVE (Player vs. Environment) games with a centralized server managing shared properties (e.g., XP, skills, characters, combat, physics) that sync across diverse game instances. Each game can have unique themes and maps (within a defined size), while leveraging a common set of mechanics. Built with Babylon.js for clients and Node.js with Socket.IO for the server, this engine aims to provide a reusable, scalable foundation for varied gaming experiences.

**Current Date**: February 24, 2025  
**Target Audience**: Developers building multiplayer PVE games with shared mechanics but distinct flavors.

## Project Goals
1. **Shared Property System**: A server-side system to manage and sync XP, skill trees, characters, combat, and physics across all connected clients.
2. **Flexible Game Instances**: Support for different themes (e.g., sci-fi, fantasy) and maps (fixed-size areas) while using the same core mechanics.
3. **Scalability**: Easy to extend with new systems or game-specific features.
4. **Real-Time Multiplayer**: Seamless communication between clients via WebSocket with consistent physics.

## Prerequisites
- **Node.js**: v16+ for the server.
- **Babylon.js**: v5+ for 3D rendering on clients.
- **Socket.IO**: For real-time communication.
- **Cannon.js**: For physics simulation.
- **Git**: For version control.

## Directory Structure
```
multiverse-game-engine/
├── client/               # Client-side code (Babylon.js)
│   ├── public/           # Static assets (HTML, images)
│   │   ├── index.html    # Entry point
│   │   └── maps/         # Map configurations
│   └── src/              # Game logic
│       └── game.js       # Main client script
├── server/               # Server-side code (Node.js)
│   ├── src/
│   │   ├── systems/      # Shared property systems
│   │   │   ├── xp.js     # XP system
│   │   │   ├── skills.js # Skill tree system
│   │   │   ├── character.js # Character system
│   │   │   ├── combat.js # Attack/weapons system
│   │   │   └── physics.js # Physics system
│   │   └── server.js     # Main server script
│   └── package.json      # Server dependencies
├── docs/                 # Documentation
│   └── README.md         # This file
└── package.json          # Root dependencies
```

## Development Roadmap

### Phase 1: Foundation (1-2 Weeks)
#### Goals
- Set up a basic server with shared state management.
- Extend the existing Babylon.js multiplayer setup.
- Define the fixed map size and initial shared properties.

#### Tasks
1. **Server Setup**
   - Initialize a Node.js project: `npm init -y`.
   - Install dependencies: `npm install express socket.io cannon`.
   - Update `server.js` to manage a shared state object:
     ```javascript
     const sharedState = {
       players: {}, // { id: { x, z, xp, skills, character, weapon } }
       mapSize: { width: 10, height: 10 } // Fixed area in Babylon.js units
     };
     ```

2. **Client Integration**
   - Use the existing `game.js` as a base.
   - Add map boundaries based on `mapSize`:
     ```javascript
     const constrainPosition = (pos, mapSize) => {
       pos.x = Math.max(-mapSize.width / 2, Math.min(mapSize.width / 2, pos.x));
       pos.z = Math.max(-mapSize.height / 2, Math.min(mapSize.height / 2, pos.z));
       return pos;
     };
     ```

3. **Milestone**
   - Two clients can connect, move spheres, and stay within a 10x10 map.

### Phase 2: Shared Property Systems (3-4 Weeks)
#### Goals
- Implement XP, skill tree, character, combat, and physics systems on the server.
- Sync these properties to clients in real-time.

#### Tasks
1. **XP System (`server/src/systems/xp.js`)**
   - Track XP per player:
     ```javascript
     class XPSystem {
       static addXP(playerId, amount, sharedState) {
         sharedState.players[playerId].xp = (sharedState.players[playerId].xp || 0) + amount;
         return sharedState.players[playerId].xp;
       }
     }
     ```
   - Trigger XP gain (e.g., on enemy defeat).

2. **Skill Tree System (`server/src/systems/skills.js`)**
   - Define a simple skill tree:
     ```javascript
     const skillTree = {
       speed: { cost: 50, effect: (player) => player.speed += 0.1 },
       strength: { cost: 100, effect: (player) => player.damage += 1 }
     };
     class SkillSystem {
       static unlockSkill(playerId, skillName, sharedState) {
         const player = sharedState.players[playerId];
         if (player.xp >= skillTree[skillName].cost) {
           player.xp -= skillTree[skillName].cost;
           skillTree[skillName].effect(player);
         }
       }
     }
     ```

3. **Character System (`server/src/systems/character.js`)**
   - Store character data:
     ```javascript
     sharedState.players[socket.id] = { x: 0, z: 0, xp: 0, speed: 0.1, damage: 1, character: { name: `Player${socket.id.slice(0, 4)}`, color } };
     ```

4. **Combat System (`server/src/systems/combat.js`)**
   - Guns, melee, and knives with distinct mechanics:
     ```javascript
     class CombatSystem {
       static attack(attackerId, targetId, weaponType, sharedState) {
         const attacker = sharedState.players[attackerId];
         const target = sharedState.enemies[targetId];
         if (!target) return;
         const distance = Math.hypot(attacker.x - target.x, attacker.z - target.z);
         if (weaponType === 'gun' && distance < 10 && attacker.ammo > 0) {
           target.health -= attacker.damage;
           attacker.ammo -= 1;
         } else if ((weaponType === 'melee' && distance < 2) || (weaponType === 'knife' && distance < 1)) {
           target.health -= weaponType === 'knife' && Math.random() > 0.7 ? attacker.damage * 2 : attacker.damage;
           attacker.stamina -= weaponType === 'melee' ? 10 : 5;
         }
         if (target.health <= 0) delete sharedState.enemies[targetId];
       }
     }
     ```
   - Client trigger: Space for guns, Q for melee, E for knives.

5. **Physics System (`server/src/systems/physics.js`)**
   - Use Cannon.js for consistent physics:
     ```javascript
     const CANNON = require('cannon');
     const world = new CANNON.World();
     world.gravity.set(0, -9.8, 0);
     class PhysicsSystem {
       static initPlayer(id, sharedState) {
         const body = new CANNON.Body({ mass: 1, shape: new CANNON.Sphere(0.5) });
         body.position.set(sharedState.players[id].x, 0.5, sharedState.players[id].z);
         world.addBody(body);
         sharedState.players[id].physicsBody = body;
       }
       static update(delta) {
         world.step(delta);
         for (let id in sharedState.players) {
           const body = sharedState.players[id].physicsBody;
           sharedState.players[id].x = body.position.x;
           sharedState.players[id].z = body.position.z;
         }
       }
     }
     ```

6. **Client Updates**
   - Display XP, skills, ammo, stamina, and health in UI.
   - Sync physics updates:
     ```javascript
     socket.on('physicsUpdate', (data) => {
       mySphere.position.set(data.x, data.y, data.z);
     });
     ```

7. **Milestone**
   - Players fight enemies with guns, melee, and knives, with physics-driven movement and combat.

### Phase 3: PVE Mechanics (2-3 Weeks)
#### Goals
- Add enemy AI, resources, objectives, and hazards.
- Ensure physics integration.

#### Tasks
1. **Enemy AI System**
   - Behaviors: Idle/patrol, engage, retreat.
   - Server-side logic:
     ```javascript
     class AISystem {
       static update(sharedState) {
         for (let id in sharedState.enemies) {
           const enemy = sharedState.enemies[id];
           const nearestPlayer = findNearestPlayer(enemy, sharedState.players);
           if (Math.hypot(enemy.x - nearestPlayer.x, enemy.z - nearestPlayer.z) < 5) {
             enemy.physicsBody.velocity.set((nearestPlayer.x - enemy.x) * 0.1, 0, (nearestPlayer.z - enemy.z) * 0.1);
           }
         }
       }
     }
     ```

2. **Resource Management**
   - Track ammo, stamina, health:
     ```javascript
     sharedState.players[id].ammo = 30;
     sharedState.players[id].stamina = 100;
     sharedState.players[id].health = 100;
     ```

3. **Objective System**
   - Example: Eliminate 5 enemies:
     ```javascript
     sharedState.objectives = { type: 'elimination', target: 5, current: 0 };
     ```

4. **Environmental Hazards**
   - Add traps:
     ```javascript
     const trapBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(1, 0.1, 1)) });
     world.addBody(trapBody);
     ```

5. **Milestone**
   - Players complete objectives against AI enemies with physics-based hazards.

### Phase 4: Game Diversity & Polish (Ongoing)
#### Goals
- Enable themed instances with shared mechanics.
- Refine systems.

#### Tasks
1. **Theme Configuration**
   - Client-side theme loader:
     ```javascript
     const themes = {
       fantasy: { groundTexture: "grass.jpg", weaponModels: { gun: "bow", melee: "sword", knife: "dagger" } },
       sciFi: { groundTexture: "metal.jpg", weaponModels: { gun: "laser", melee: "axe", knife: "blade" } }
     };
     ```

2. **Map Customization**
   - Load JSON maps with physics objects.

3. **Physics Customization**
   - Adjust gravity, friction within limits (-5 to -15 for gravity, 0.3-0.7 for friction).

4. **Milestone**
   - Two themed PVE games with guns, melee, knives, and physics.

## Shared Mechanics for PVE

### Combat System
- **Guns**: Ranged (ammo, rate, accuracy).
- **Melee**: Close-range (speed, reach, area damage).
- **Knives**: Quick (critical hits, low stamina).
- **Features**: Weapon switching, reloads, server-side damage, hit detection.

### Enemy AI System
- **Behaviors**: Patrol, engage, retreat.
- **Features**: Sensory detection, group tactics, adaptive difficulty.

### Resource Management
- **Ammo**: Limited, replenished via drops.
- **Stamina**: Governs melee/knife, regenerates.
- **Health**: Recoverable with items.

### Objective System
- **Types**: Elimination, retrieval, defense.
- **Features**: Dynamic updates, rewards.

### Environmental Hazards
- **Types**: Traps, terrain effects, weather.
- **Features**: Interactive, consistent effects.

### Physics System
- **Engine**: Cannon.js.
- **Features**: Server-authoritative, client prediction, gravity (-9.8 default, -5 to -15 range), friction (0.5 default), restitution (0.3), collision shapes (spheres, boxes).
- **Customization**: Adjust within limits for themes.

## Next Steps
1. Clone this repo: `git clone <your-repo-url>`.
2. Install dependencies: `cd server && npm install` then `cd ../client && npm install`.
3. Start server: `node server/src/server.js`.
4. Open `client/public/index.html` in multiple browsers.

## Contributing
- Fork and submit PRs with new systems or themes.
- Report bugs in Issues.

## License
MIT - Free to use, modify, and distribute.
