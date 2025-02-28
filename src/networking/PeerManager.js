import Peer from "peerjs";
import { PhysicsObject } from "../components/PhysicsObject";
import { EventStreamManager } from "./streams/EventStreamManager";

export class PeerManager {
    constructor(game) {
        this.game = game;
        this.peer = null;
        this.connections = [];
        this.isHost = false;
        this.isMultiplayer = false;
        this.streamManagers = {
            event: new EventStreamManager(this),
            // ghost: new GhostStreamManager(this),
            // move: new MoveStreamManager(this),
            // datablock: new DatablockStreamManager(this),
            // string: new StringStreamManager(this)
        };
        this.setupSync();
    }

    startAsHost() {
        this.isHost = true;
        this.peer = new Peer({
            config: {
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { 
                        urls: "turn:openrelay.metered.ca:80",
                        username: "openrelayproject",
                        credential: "openrelayproject"
                    }
                ]
            }
        });
        this.peer.on("open", (id) => {
            document.getElementById("myId").textContent = id;
            this.isMultiplayer = true;
        });
        this.peer.on("connection", (conn) => {
            this.connections.push(conn);
            conn.on("data", (data) => this.receiveData(data));
            this.sendFullState(conn);
        });
    }

    join(peerId) {
        this.isHost = false;
        this.peer = new Peer({
            config: {
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { 
                        urls: "turn:openrelay.metered.ca:80",
                        username: "openrelayproject",
                        credential: "openrelayproject"
                    }
                ]
            }
        });
        this.peer.on("open", (myId) => {
            document.getElementById("myId").textContent = myId;
            const conn = this.peer.connect(peerId);
            conn.on("open", () => {
                this.connections.push(conn);
                this.isMultiplayer = true;
            });
            conn.on("data", (data) => this.receiveData(data));
        });
    }

    setupSync() {
        this.game.scene.onBeforeRenderObservable.add(() => {
            if (this.isMultiplayer && this.connections.length > 0 && this.isHost) {
                const state = {
                    id: this.peer.id,
                    position: this.game.player.mesh.position.asArray(),
                    velocity: this.game.player.physicsBody.getLinearVelocity().asArray()
                };
                this.sendDataToPeers({ streamType: "ghost", payload: state });
            }
        });
    }

    sendFullState(conn) {
        const state = this.game.getState();
        conn.send({ streamType: "datablock", payload: state });
    }

    receiveData(data) {
        const { streamType, payload } = data;
        if (this.streamManagers[streamType]) {
            this.streamManagers[streamType].handleIncomingData(payload);
        } else if (streamType === "ghost") {
            // Handle ghost updates directly for now
            if (!this.game.remotePlayers[payload.id]) {
                this.game.remotePlayers[payload.id] = new PhysicsObject(`player-${payload.id}`, this.game.scene, this.game.physicsPlugin);
            }
            const player = this.game.remotePlayers[payload.id];
            player.mesh.position.set(...payload.position);
            player.physicsBody.setLinearVelocity(new BABYLON.Vector3(...payload.velocity));
        } else if (streamType === "datablock") {
            // Handle full state sync for joining peers
            this.applyFullState(payload);
        }
    }

    sendDataToPeers(data) {
        if (this.isHost) {
            this.connections.forEach(conn => conn.send(data));
        } else if (this.connections.length) {
            this.connections[0].send(data); // Send to host
        }
    }

    applyFullState(state) {
        this.game.player.mesh.position.set(...state.player.position);
        this.game.player.physicsBody.setLinearVelocity(new BABYLON.Vector3(...state.player.velocity));
        state.objects.forEach((obj) => {
            let mesh = this.game.scene.getMeshByName(obj.name);
            if (!mesh) {
                mesh = new PhysicsObject(obj.name, this.game.scene, this.game.physicsPlugin);
            }
            mesh.mesh.position.set(...obj.position);
            mesh.physicsBody.setLinearVelocity(new BABYLON.Vector3(...obj.velocity));
        });
    }

    handleData(data) {
        // Legacy method, redirect to receiveData
        this.receiveData(data);
    }
}