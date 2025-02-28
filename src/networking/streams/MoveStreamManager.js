import { PhysicsObject } from "../../components/PhysicsObject";
export class MoveStreamManager {
    constructor(peerManager) {
        this.peerManager = peerManager;
        this.lastMoveTime = 0;
        this.moveInterval = 32; // 32ms as per Tribes
        this.moveQueue = []; // Queue for redundancy
    }

    handleIncomingData(payload) {
        if (this.peerManager.isHost) {
            const game = this.peerManager.game;
            if (!game.remotePlayers[payload.id] && payload.id !== this.peerManager.peer.id) {
                game.remotePlayers[payload.id] = new PhysicsObject(`player-${payload.id}`, game.scene, game.physicsPlugin);
            }
            const player = game.remotePlayers[payload.id];
            if (player) {
                player.physicsBody.applyImpulse(new BABYLON.Vector3(...payload.impulse), player.mesh.position);
            }
        }
    }

    sendMove(impulse) {
        const now = Date.now();
        if (now - this.lastMoveTime >= this.moveInterval && this.peerManager.isMultiplayer) {
            const moveData = {
                id: this.peerManager.peer.id,
                impulse: impulse.asArray()
            };
            this.moveQueue.push(moveData);
            if (this.moveQueue.length > 3) this.moveQueue.shift();
            this.moveQueue.forEach(data => {
                this.peerManager.sendDataToPeers({ streamType: "move", payload: data });
            });
            this.lastMoveTime = now;
        }
    }
}