import Peer from "peerjs";
import { PhysicsObject } from "../components/PhysicsObject";

export class PeerManager {
    constructor(game) {
        this.game = game;
        this.peer = null;
        this.connections = [];
        this.isMultiplayer = false;
        this.setupSync();
    }

    startAsHost() {
        this.peer = new Peer();
        this.peer.on("open", (id) => {
            document.getElementById("myId").textContent = id;
            this.isMultiplayer = true;
        });
        this.peer.on("connection", (conn) => {
            this.connections.push(conn);
            conn.on("data", (data) => this.handleData(data));
            this.sendFullState(conn);
        });
    }

    join(peerId) {
        this.peer = new Peer();
        this.peer.on("open", (myId) => {
            document.getElementById("myId").textContent = myId;
            const conn = this.peer.connect(peerId);
            conn.on("open", () => {
                this.connections.push(conn);
                this.isMultiplayer = true;
            });
            conn.on("data", (data) => this.handleData(data));
        });
    }

    setupSync() {
        this.game.scene.onBeforeRenderObservable.add(() => {
            if (this.isMultiplayer && this.connections.length > 0) {
                const state = {
                    id: this.peer.id,
                    position: this.game.player.mesh.position.asArray(),
                    velocity: this.game.player.physicsBody.getLinearVelocity().asArray()
                };
                this.connections.forEach((conn) => conn.send(state));
            }
        });
    }

    sendFullState(conn) {
        const state = this.game.getState();
        conn.send({ type: "fullSync", state });
    }

    handleData(data) {
        if (data.type === "fullSync") {
            this.game.stateManager.applyFullState(data.state);
        } else {
            if (!this.game.remotePlayers[data.id]) {
                this.game.remotePlayers[data.id] = new PhysicsObject(`player-${data.id}`, this.game.scene, this.game.physicsPlugin);
            }
            const player = this.game.remotePlayers[data.id];
            player.mesh.position.set(...data.position);
            player.physicsBody.setLinearVelocity(new BABYLON.Vector3(...data.velocity));
        }
    }
}