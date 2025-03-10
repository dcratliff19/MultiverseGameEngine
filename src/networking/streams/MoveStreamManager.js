import { PhysicsObject } from "../../components/PhysicsObject";

export class MoveStreamManager {
    constructor(peerManager) {
        this.peerManager = peerManager;
        this.lastMoveTime = 0;
        this.moveInterval = 32;
        this.latestMove = null;
    }

    handleIncomingData(payload) {
        if (this.peerManager.isHost) {
            if (!this.peerManager.game.remotePlayers[payload.id] && payload.id !== this.peerManager.peer.id) {
                this.peerManager.game.remotePlayers[payload.id] = new PhysicsObject(
                    `player-${payload.id}`,
                    this.peerManager.game.scene,
                    this.peerManager.game.physicsPlugin
                );
            }
            const player = this.peerManager.game.remotePlayers[payload.id];
            if (player && player.mesh && player.physicsBody) {
                console.log("Move received:", payload);
                if (!this.latestMove || payload.timestamp > this.latestMove.timestamp) {
                    this.latestMove = payload;
                    const velocity = Array.isArray(payload.velocity) && payload.velocity.length === 3 
                        ? new BABYLON.Vector3(...payload.velocity)
                        : new BABYLON.Vector3(0, 0, 0);
                    try {
                        player.physicsBody.setLinearVelocity(velocity);
                        console.log("Velocity applied:", { velocity: velocity.asArray(), position: player.mesh.position.asArray() });
                    } catch (error) {
                        console.error("Failed to apply velocity:", error, { velocity: velocity.asArray(), position: player.mesh.position.asArray() });
                    }
                }
            } else {
                console.warn("Player not fully initialized for move:", payload.id);
            }
        }
    }

    sendMove(velocity) {
        const now = Date.now();
        if (now - this.lastMoveTime >= this.moveInterval && this.peerManager.isMultiplayer) {
            const moveData = {
                id: this.peerManager.peer.id,
                velocity: velocity.asArray(), // Changed from impulse to velocity
                timestamp: now
            };
            this.peerManager.sendDataToPeers({ streamType: "move", payload: moveData });
            this.lastMoveTime = now;
        }
    }
}