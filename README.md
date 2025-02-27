
## Development Roadmap

### Phase 1: Core Setup (Complete as of Feb 26, 2025)
#### Goals
- Establish a Babylon.js scene with Havok physics.
- Implement single-player controls and basic physics interactions.

#### Achievements
- **Scene**: A 10x10 ground with a player-controlled sphere that falls and moves via WASD.
- **Physics**: Havok integrated for gravity and collisions.
- **Codebase**: Modular structure with `Game.js`, `PhysicsObject.js`, and Vite for development.

#### Next Tasks
- Add UI feedback for player actions (e.g., velocity display).

### Phase 2: Persistence & Replay System (Complete as of Feb 26, 2025)
#### Goals
- Save and load game state for single-player continuity.
- Record events for a replayable theater system.

#### Achievements
- **StateManager**: Saves player position, velocity, and object states to `localStorage` on exit, reloads on start.
- **Replay**: Logs events (e.g., impulses) with timestamps, playable via `Replay.js`.
- **Integration**: Seamlessly resumes single-player sessions.

#### Next Tasks
- Enhance replay with pause, fast-forward, and camera controls.
- Compress event logs for larger sessions (e.g., using IndexedDB).

### Phase 3: P2P Multiplayer (Complete as of Feb 26, 2025)
#### Goals
- Enable P2P multiplayer with PeerJS.
- Sync physics and game state across peers.

#### Achievements
- **PeerManager**: Hosts and joins lobbies via PeerJS IDs, syncing player positions and velocities in real-time.
- **Full Sync**: Joining players receive the host’s full game state (e.g., objects, player position).
- **UI**: Lobby interface to start single-player, host, or join games.

#### Next Tasks
- Improve physics sync accuracy (e.g., periodic full-state corrections).
- Add player identifiers (names, colors) for multiplayer.

### Phase 4: Game Mechanics Expansion (Next Steps)
#### Goals
- Introduce combat (guns, melee, knives) and PVE elements.
- Expand physics interactions.

#### Tasks
1. **Combat System**
   - Add weapons to `PhysicsObject`:
     ```javascript
     class PhysicsObject {
         constructor(name, scene, physicsPlugin, options = {}) {
             this.mesh = MeshBuilder.CreateSphere(name, { diameter: 1 }, scene);
             this.physicsBody = physicsPlugin.addPhysicsBody(this.mesh, { mass: options.mass || 1 });
             this.weapon = options.weapon || 'none'; // e.g., 'gun', 'melee', 'knife'
         }
         attack(target) {
             if (this.weapon === 'gun') {
                 // Ranged attack logic
             }
         }
     }