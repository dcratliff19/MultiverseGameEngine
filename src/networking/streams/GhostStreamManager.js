import { PhysicsObject } from "../../components/PhysicsObject";

export class GhostStreamManager {
    constructor(peerManager) {
        this.peerManager = peerManager;
        this.lastUpdateTime = 0;
        this.updateInterval = 16;
    }

    handleIncomingData(payload) {
        if (!this.peerManager.isHost) {
            const game = this.peerManager.game;
            const playerId = payload.id === this.peerManager.peer.id ? this.peerManager.peer.id : payload.id;
            if (!game.remotePlayers[playerId] && payload.id !== this.peerManager.peer.id) {
                game.remotePlayers[playerId] = new PhysicsObject(
                    `player-${playerId}`,
                    game.scene,
                    game.physicsPlugin,
                    { position: new BABYLON.Vector3(...payload.position) }
                );
            }
            const player = payload.id === this.peerManager.peer.id ? game.player : game.remotePlayers[playerId];
            if (player) {
                // Stronger correction for client’s own player
                if (payload.id === this.peerManager.peer.id) {
                    console.log("Client position from host:", payload.position, "local:", player.mesh.position.asArray());
                    player.mesh.position.set(...payload.position); // Direct set for client’s player
                    player.physicsBody.setLinearVelocity(new BABYLON.Vector3(...payload.velocity));
                    console.log("Client position after set:", player.mesh.position.asArray());
                } else {
                    player.mesh.position = game.lerpVector3(player.mesh.position, new BABYLON.Vector3(...payload.position), 0.3); // Increased lerp for remotes
                    player.physicsBody.setLinearVelocity(new BABYLON.Vector3(...payload.velocity));
                }
            }
        } else {
            if (!this.peerManager.game.remotePlayers[payload.id] && payload.id !== this.peerManager.peer.id) {
                this.peerManager.game.remotePlayers[payload.id] = new PhysicsObject(
                    `player-${payload.id}`,
                    this.peerManager.game.scene,
                    this.peerManager.game.physicsPlugin,
                    { position: new BABYLON.Vector3(...payload.position) }
                );
            }
            const player = this.peerManager.game.remotePlayers[payload.id];
            if (player) {
                player.mesh.position.set(...payload.position);
                player.physicsBody.setLinearVelocity(new BABYLON.Vector3(...payload.velocity));
            }
        }
    }

    sendUpdate() {
        const now = Date.now();
        if (this.peerManager.isHost && now - this.lastUpdateTime >= this.updateInterval && this.peerManager.isMultiplayer) {
            const state = this.peerManager.game.getState();
            this.peerManager.sendDataToPeers({
                streamType: "ghost",
                payload: {
                    id: this.peerManager.peer.id,
                    position: state.player.position,
                    velocity: state.player.velocity
                }
            });
            Object.keys(this.peerManager.game.remotePlayers).forEach(id => {
                const player = this.peerManager.game.remotePlayers[id];
                this.peerManager.sendDataToPeers({
                    streamType: "ghost",
                    payload: {
                        id: id,
                        position: player.mesh.position.asArray(),
                        velocity: player.physicsBody.getLinearVelocity().asArray()
                    }
                });
            });
            this.lastUpdateTime = now;
        }
    }
}