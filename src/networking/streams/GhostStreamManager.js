import { PhysicsObject } from "../../components/PhysicsObject";

export class GhostStreamManager {
    constructor(peerManager) {
        this.peerManager = peerManager;
        this.lastUpdateTime = 0;
        this.updateInterval = 50;
    }

    handleIncomingData(payload) {
        if (!this.peerManager.isHost) {
            const game = this.peerManager.game;
            const playerId = payload.id === this.peerManager.peer.id ? this.peerManager.peer.id : payload.id;
            if (!game.remotePlayers[playerId] && payload.id !== this.peerManager.peer.id) {
                game.remotePlayers[playerId] = new PhysicsObject(`player-${playerId}`, game.scene, game.physicsPlugin);
            }
            const player = payload.id === this.peerManager.peer.id ? game.player : game.remotePlayers[playerId];
            if (player) {
                player.mesh.position = game.lerpVector3(player.mesh.position, new BABYLON.Vector3(...payload.position), 0.1);
                player.physicsBody.setLinearVelocity(new BABYLON.Vector3(...payload.velocity));
            }
        }
    }

    sendUpdate() {
        const now = Date.now();
        if (this.peerManager.isHost && now - this.lastUpdateTime >= this.updateInterval && this.peerManager.isMultiplayer) {
            const state = this.peerManager.game.getState();
            // Send host’s player state
            this.peerManager.sendDataToPeers({
                streamType: "ghost",
                payload: {
                    id: this.peerManager.peer.id,
                    position: state.player.position,
                    velocity: state.player.velocity
                }
            });
            // Send all remote players’ states
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