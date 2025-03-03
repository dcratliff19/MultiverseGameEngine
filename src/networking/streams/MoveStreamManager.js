import { PhysicsObject } from "../../components/PhysicsObject"; // Added import

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
                    const impulse = Array.isArray(payload.impulse) && payload.impulse.length === 3 
                        ? new BABYLON.Vector3(...payload.impulse)
                        : new BABYLON.Vector3(0, 0, 0);
                    const position = player.mesh.position.clone();
                    try {
                        player.physicsBody.applyImpulse(impulse, position);
                        console.log("Impulse applied:", { impulse: impulse.asArray(), position: position.asArray() });
                    } catch (error) {
                        console.error("Failed to apply impulse:", error, { impulse: impulse.asArray(), position: position.asArray() });
                    }
                }
            } else {
                console.warn("Player not fully initialized for move:", payload.id);
            }
        }
    }

    sendMove(impulse) {
        const now = Date.now();
        if (now - this.lastMoveTime >= this.moveInterval && this.peerManager.isMultiplayer) {
            const moveData = {
                id: this.peerManager.peer.id,
                impulse: impulse.asArray(),
                timestamp: now
            };
            this.peerManager.sendDataToPeers({ streamType: "move", payload: moveData });
            this.lastMoveTime = now;
        }
    }
}