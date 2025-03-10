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
        this.keysHeld = { w: false, s: false, a: false, d: false };
        this.lastTickTime = 0;

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
            this.light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);

            console.log("Attempting to load Havok via CDN...");
            const havok = await HavokPhysics();
            if (!havok) {
                throw new Error("HavokPhysics() returned undefined or null");
            }
            console.log("Havok loaded successfully:", havok);

            this.physicsPlugin = new BABYLON.HavokPlugin(true, havok);
            this.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), this.physicsPlugin);
            console.log("Physics enabled on scene");

            // Load the map model (cs_assault.glb)
            console.log("Loading ground model cs_assault.glb");
            const groundResult = await BABYLON.SceneLoader.ImportMeshAsync(
                "", 
                "assets/", // Path to your model
                "cs_assault.glb", 
                this.scene
            );

            // Filter only meshes with valid vertices
            const validMeshes = groundResult.meshes.filter(mesh => mesh.getTotalVertices() > 0);
            if (validMeshes.length === 0) {
                throw new Error("No valid mesh with vertices found in cs_assault.glb");
            }

            // If multiple meshes exist, merge them into one
            if (validMeshes.length > 1) {
                this.ground = BABYLON.Mesh.MergeMeshes(validMeshes, true, true, undefined, false, true);
            } else {
                this.ground = validMeshes[0];
            }

            this.ground.position.y = -1; // Adjust position if necessary

            // Apply mesh physics
            this.groundAggregate = new BABYLON.PhysicsAggregate(
                this.ground,
                BABYLON.PhysicsShapeType.MESH,
                { mass: 0 },
                this.scene
            );
            console.log("Ground physics applied");

            // Create the player object
            this.player = new PhysicsObject("player", this.scene, this.physicsPlugin);

            // Third-person camera setup
            this.camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 5, this.player.mesh.position, this.scene);
            this.camera.attachControl(this.canvas, true);
            this.scene.onBeforeRenderObservable.add(() => {
                this.camera.target = this.player.mesh.position;
            });

            this.remotePlayers = {};

            // Pause/resume physics on tab out/in
            document.addEventListener("visibilitychange", () => {
                if (this.isReady && this.peerManager && !this.peerManager.isHost && this.isMultiplayer) {
                    if (document.visibilityState === "hidden") {
                        console.log("Client tabbed out, pausing physics");
                        this.player.physicsBody.setMotionType(BABYLON.PhysicsMotionType.STATIC);
                    } else {
                        console.log("Client tabbed back in, resuming physics");
                        this.player.physicsBody.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC);
                        this.peerManager.sendDataToPeers({ streamType: "tickRequest", payload: { id: this.peerManager.peer.id } });
                    }
                }
            });

            this.engine.runRenderLoop(() => this.scene.render());
        } catch (error) {
            console.error("Failed to load Havok or cs_assault.glb:", error);
            console.error("Error stack:", error.stack);
            this.engine.runRenderLoop(() => this.scene.render());
        }
    }

    setupControls() {
        this.scene.onKeyboardObservable.add((kbInfo) => {
            const key = kbInfo.event.key.toLowerCase();
            if (this.keysHeld.hasOwnProperty(key)) {
                this.keysHeld[key] = kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN;
            }
        });

        this.scene.onBeforeRenderObservable.add(() => {
            const speed = 5;
            let velocity = new BABYLON.Vector3(0, 0, 0);
            if (this.keysHeld.w) velocity.z = speed;
            if (this.keysHeld.s) velocity.z = -speed;
            if (this.keysHeld.a) velocity.x = -speed;
            if (this.keysHeld.d) velocity.x = speed;

            if (velocity.length() > speed) {
                velocity = velocity.normalize().scale(speed);
            }

            const now = Date.now();
            if (velocity.length() > 0 || Object.values(this.keysHeld).some(v => v)) {
                if (!this.peerManager || this.peerManager.isHost || !this.peerManager.isMultiplayer) {
                    const currentVelocity = this.player.physicsBody.getLinearVelocity();
                    this.player.physicsBody.setLinearVelocity(new BABYLON.Vector3(velocity.x, currentVelocity.y, velocity.z));
                }
                if (this.peerManager && this.peerManager.isMultiplayer) {
                    console.log("Sending velocity from client:", velocity.asArray());
                    this.peerManager.streamManagers.move.sendMove(velocity);
                }
                this.stateManager.logEvent("velocity", { velocity: velocity.asArray(), position: this.player.mesh.position.asArray() });
            }

            // Client tick request every 100ms
            if (this.peerManager && !this.peerManager.isHost && this.isMultiplayer) {
                if (!this.lastTickTime || now - this.lastTickTime >= 100) {
                    this.peerManager.sendDataToPeers({ streamType: "tickRequest", payload: { id: this.peerManager.peer.id } });
                    this.lastTickTime = now;
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
