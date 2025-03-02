import { PhysicsObject } from "../components/PhysicsObject";
import { StateManager } from "./StateManager";

export class Game {
    constructor(engine, canvas) {
        this.engine = engine;
        this.scene = new BABYLON.Scene(engine);
        this.canvas = canvas;
        this.stateManager = new StateManager(this);
        this.isReady = false;
        this.remotePlayers = {};
        this.peerManager = null;
        this.setupScene().then(() => {
            this.isReady = true;
            this.setupControls();
        });
    }

    setPeerManager(peerManager) {
        if (this.peerManager && !this.peerManager.isHost && this.isMultiplayer) {
            this.player.setKinematic(true);
        }
        this.peerManager = peerManager;
    }

    async setupScene() {
        try {
            this.camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 5, -10), this.scene);
            this.camera.setTarget(BABYLON.Vector3.Zero());
            this.camera.attachControl(this.canvas, true);

            this.light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);
            this.ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 10, height: 10 }, this.scene);
            this.ground.position.y = -1;

            console.log("Attempting to load Havok via CDN...");
            const havok = await HavokPhysics();
            if (!havok) {
                throw new Error("HavokPhysics() returned undefined or null");
            }
            console.log("Havok loaded successfully:", havok);
            this.physicsPlugin = new BABYLON.HavokPlugin(true, havok);
            console.log("Physics plugin created:", this.physicsPlugin);

            this.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), this.physicsPlugin);
            console.log("Physics enabled on scene");

            this.groundAggregate = new BABYLON.PhysicsAggregate(this.ground, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, this.scene);
            console.log("Ground aggregate created");

            this.player = new PhysicsObject("player", this.scene, this.physicsPlugin);
            console.log("Player physics body:", this.player.physicsBody);
            this.remotePlayers = {};

            // Add velocity reset for client in multiplayer
            this.scene.onAfterPhysicsObservable.add(() => {
                if (this.peerManager && !this.peerManager.isHost && this.isMultiplayer) {
                    this.player.physicsBody.setLinearVelocity(new BABYLON.Vector3(0, 0, 0));
                }
            });

            this.engine.runRenderLoop(() => this.scene.render());
        } catch (error) {
            console.error("Failed to load Havok:", error);
            console.error("Error stack:", error.stack);
            this.engine.runRenderLoop(() => this.scene.render());
        }
    }

    setupControls() {
        this.scene.onKeyboardObservable.add((kbInfo) => {
            if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
                const speed = 10;
                let impulse;
                switch (kbInfo.event.key) {
                    case "w": impulse = new BABYLON.Vector3(0, 0, speed); break;
                    case "s": impulse = new BABYLON.Vector3(0, 0, -speed); break;
                    case "a": impulse = new BABYLON.Vector3(-speed, 0, 0); break;
                    case "d": impulse = new BABYLON.Vector3(speed, 0, 0); break;
                }
                if (impulse) {
                    // Apply impulse locally only if host, otherwise wait for host sync
                    if (!this.peerManager || this.peerManager.isHost || !this.peerManager.isMultiplayer) {
                        this.player.applyImpulse(impulse, this.player.mesh.position);
                    }
                    if (this.peerManager && this.peerManager.isMultiplayer) {
                        console.log("Sending move from client:", impulse.asArray());
                        this.peerManager.streamManagers.move.sendMove(impulse);
                    }
                    this.stateManager.logEvent("impulse", { impulse: impulse.asArray(), position: this.player.mesh.position.asArray() });
                }
            }
        });
    }

    lerpVector3(start, target, amount) {
        return new BABYLON.Vector3(
            BABYLON.Scalar.Lerp(start.x, target.x, amount),
            BABYLON.Scalar.Lerp(start.y, target.y, amount),
            BABYLON.Scalar.Lerp(start.z, target.z, amount)
        );
    }

    getState() {
        if (!this.isReady || !this.player) {
            return null;
        }
        const state = {
            player: {
                position: this.player.mesh.position.asArray(),
                velocity: this.player.physicsBody.getLinearVelocity().asArray()
            },
            objects: []
        };
        Object.keys(this.remotePlayers).forEach(id => {
            const player = this.remotePlayers[id];
            state.objects.push({
                name: `player-${id}`,
                position: player.mesh.position.asArray(),
                velocity: player.physicsBody.getLinearVelocity().asArray()
            });
        });
        return state;
    }

    startSinglePlayer() {}
}