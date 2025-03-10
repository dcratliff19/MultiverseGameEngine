# Multiverse Game Engine - Development Roadmap

## Overview
The **Multiverse Game Engine** is an evolving framework for creating 3D multiplayer and single-player games using Babylon.js with Havok physics. Initially envisioned as a server-driven PVE system, it now leverages peer-to-peer (P2P) networking with PeerJS to enable seamless multiplayer experiences without a central server. The engine supports single-player persistence, allowing players to resume games, P2P multiplayer lobbies where friends can join via unique IDs, and a replay system inspired by Halo and Quake for reliving gameplay. Built with Babylon.js for rendering and Havok for physics, this project aims to be a flexible, scalable foundation for diverse gaming experiences.

**Current Date**: February 26, 2025  
**Target Audience**: Developers building physics-driven, replayable games with hybrid single-player and P2P multiplayer capabilities.

## Project Goals
1. **Single-Player Experience**: Fully functional standalone gameplay with state persistence for resuming sessions.
2. **P2P Multiplayer**: Real-time multiplayer via PeerJS, allowing players to host and join lobbies using unique IDs.
3. **Physics Integration**: Consistent physics simulation using Havok, synced across peers.
4. **Replay System**: Record and replay gameplay events for a theater-like experience.
5. **Scalability**: Modular design to support future themes, mechanics, and game instances.

## Prerequisites
- **Node.js**: v16+ for development and running Vite.
- **Babylon.js**: v7+ for 3D rendering and core functionality.
- **Havok**: Integrated via `@babylonjs/havok` for physics.
- **PeerJS**: For P2P networking.
- **Vite**: For development and production builds.
- **Git**: For version control.

## Directory Structure
```
babylon-p2p-game/
├── dist/                    # (Generated) Production build output
├── node_modules/            # (Generated) Installed dependencies
├── public/                  # Static assets
│   ├── favicon.ico          # Optional favicon
│   └── assets/              # Future textures, sounds, etc.
│       └── placeholder.png  # Placeholder
├── src/                     # Source code
│   ├── components/          # Reusable game components
│   │   └── PhysicsObject.js # Physics-enabled object class
│   ├── core/                # Core game logic
│   │   ├── Game.js          # Main game logic (state, scene setup)
│   │   ├── Replay.js        # Replay system logic
│   │   └── StateManager.js  # Game state save/load
│   ├── networking/          # Multiplayer networking logic
│   │   └── PeerManager.js   # PeerJS P2P handling
│   ├── ui/                  # UI-related code
│   │   └── LobbyUI.js       # Lobby interface logic
│   ├── main.js              # Entry point (initializes everything)
│   └── style.css            # Basic styles for UI
├── index.html               # HTML entry point
├── package.json             # Node.js project config
├── vite.config.js           # Vite configuration
└── README.md                # This file
```
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
