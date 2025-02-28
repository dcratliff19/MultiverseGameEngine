import Peer from "peerjs";
import { PhysicsObject } from "../components/PhysicsObject";
import { EventStreamManager } from "./streams/EventStreamManager";
import { GhostStreamManager } from "./streams/GhostStreamManager";
import { MoveStreamManager } from "./streams/MoveStreamManager";

export class PeerManager {
    constructor(game) {
        this.game = game;
        this.peer = null;
        this.connections = [];
        this.isHost = false;
        this.isMultiplayer = false;
        this.streamManagers = {
            event: new EventStreamManager(this),
            ghost: new GhostStreamManager(this),
            move: new MoveStreamManager(this)
            // datablock: new DatablockStreamManager(this),
            // string: new StringStreamManager(this)
        };
        this.setupSync();
    }

    startAsHost(customId) {
        this.isHost = true;
        this.peer = new Peer(customId || undefined, {
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
                this.streamManagers.ghost.sendUpdate();
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
            if (this.isHost && streamType === "move") {
                this.streamManagers.ghost.sendUpdate();
            }
        } else if (streamType === "datablock") {
            this.applyFullState(payload);
        }
    }

    sendDataToPeers(data) {
        if (this.connections.length) {
            this.connections.forEach(conn => conn.send(data));
        }
    }

    applyFullState(state) {
        if (!this.isHost) { // Clients apply full state from host
            // Update local player only if it's not in the state (host’s player is authoritative)
            if (!state.objects.some(obj => obj.name === `player-${this.peer.id}`)) {
                this.game.player.mesh.position.set(...state.player.position);
                this.game.player.physicsBody.setLinearVelocity(new BABYLON.Vector3(...state.player.velocity));
            }
            // Apply remote players (including host)
            state.objects.forEach((obj) => {
                if (obj.name !== `player-${this.peer.id}`) { // Skip local player
                    if (!this.game.remotePlayers[obj.name.split('-')[1]]) {
                        this.game.remotePlayers[obj.name.split('-')[1]] = new PhysicsObject(obj.name, this.game.scene, this.game.physicsPlugin);
                    }
                    const player = this.game.remotePlayers[obj.name.split('-')[1]];
                    player.mesh.position.set(...obj.position);
                    player.physicsBody.setLinearVelocity(new BABYLON.Vector3(...obj.velocity));
                }
            });
        }
    }

    handleData(data) {
        this.receiveData(data);
    }
}