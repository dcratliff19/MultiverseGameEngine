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
        this.keysHeld = { w: false, s: false, a: false, d: false }; // Track held keys
        this.setupScene().then(() => {
            this.isReady = true;
            this.setupControls();
        });
    }

    setPeerManager(peerManager) {
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
            this.remotePlayers = {};

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
        // Track key states
        this.scene.onKeyboardObservable.add((kbInfo) => {
            const key = kbInfo.event.key.toLowerCase();
            if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
                if (this.keysHeld.hasOwnProperty(key)) {
                    this.keysHeld[key] = true;
                }
            } else if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYUP) {
                if (this.keysHeld.hasOwnProperty(key)) {
                    this.keysHeld[key] = false;
                }
            }
        });

        // Update velocity every frame based on held keys
        this.scene.onBeforeRenderObservable.add(() => {
            const speed = 5; // Adjust for desired movement speed
            let velocity = new BABYLON.Vector3(0, 0, 0);

            if (this.keysHeld.w) velocity.z = speed;
            if (this.keysHeld.s) velocity.z = -speed;
            if (this.keysHeld.a) velocity.x = -speed;
            if (this.keysHeld.d) velocity.x = speed;

            // Normalize diagonal movement to maintain consistent speed
            if (velocity.length() > speed) {
                velocity = velocity.normalize().scale(speed);
            }

            // Apply velocity and send to host if in multiplayer
            if (velocity.length() > 0 || (this.keysHeld.w || this.keysHeld.s || this.keysHeld.a || this.keysHeld.d)) {
                if (!this.peerManager || this.peerManager.isHost || !this.peerManager.isMultiplayer) {
                    this.player.physicsBody.setLinearVelocity(velocity);
                }
                if (this.peerManager && this.peerManager.isMultiplayer) {
                    console.log("Sending velocity from client:", velocity.asArray());
                    this.peerManager.streamManagers.move.sendMove(velocity);
                }
                this.stateManager.logEvent("velocity", { velocity: velocity.asArray(), position: this.player.mesh.position.asArray() });
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