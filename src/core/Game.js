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
        this.peerManager = peerManager; // Method to set peerManager after instantiation
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
            const havok = await HavokPhysics(); // Global HavokPhysics from CDN
            console.log("Havok loaded successfully:", havok);
            this.physicsPlugin = new BABYLON.HavokPlugin(true, havok);
            this.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), this.physicsPlugin);

            this.player = new PhysicsObject("player", this.scene, this.physicsPlugin);
            this.remotePlayers = {};

            // Add static physics body to ground
            this.groundAggregate = new BABYLON.PhysicsAggregate(
                this.ground,
                BABYLON.PhysicsShapeType.BOX,
                { mass: 0 },
                this.scene
            );

            this.engine.runRenderLoop(() => this.scene.render());
        } catch (error) {
            console.error("Failed to load Havok:", error);
            console.error("Error stack:", error.stack);
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
                    // Always apply locally for immediate control
                    this.player.applyImpulse(impulse, this.player.mesh.position);
                    // Send to host if in multiplayer
                    if (this.peerManager && this.peerManager.isMultiplayer) {
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
            objects: this.scene.meshes
                .filter((m) => m !== this.player.mesh && m !== this.ground)
                .map((m) => ({
                    name: m.name,
                    position: m.position.asArray(),
                    velocity: m.physicsBody ? m.physicsBody.getLinearVelocity().asArray() : [0, 0, 0]
                }))
        };
        // Include remote players in state for host
        if (this.peerManager?.isHost) {
            Object.keys(this.remotePlayers).forEach(id => {
                const player = this.remotePlayers[id];
                state.objects.push({
                    name: `player-${id}`,
                    position: player.mesh.position.asArray(),
                    velocity: player.physicsBody.getLinearVelocity().asArray()
                });
            });
        }
        return state;
    }

    startSinglePlayer() {
        // Implementation for single-player mode if needed
    }
}