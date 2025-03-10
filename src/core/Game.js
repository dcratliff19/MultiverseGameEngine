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
        this.keysHeld = {}; // Tracks all keys dynamically
        this.lastTickTime = 0;
        this.spawnPoint = new BABYLON.Vector3(0, 5, 0); // Starting position above ground
        this.yThreshold = -50; // Teleport threshold
        this.isFirstPerson = true; // Start in first-person mode

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
            // First-Person Camera
            this.fpCamera = new BABYLON.UniversalCamera("fpCamera", this.spawnPoint, this.scene);
            this.fpCamera.minZ = 0;
            this.fpCamera.attachControl(this.canvas, true);

            // Third-Person Camera
            this.tpCamera = new BABYLON.ArcRotateCamera("tpCamera", -Math.PI / 2, Math.PI / 2.5, 5, this.spawnPoint, this.scene);
            this.tpCamera.attachControl(this.canvas, true);

            // Set initial active camera
            this.scene.activeCamera = this.isFirstPerson ? this.fpCamera : this.tpCamera;

            this.light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);

            console.log("Attempting to load Havok via CDN...");
            const havok = await HavokPhysics();
            if (!havok) throw new Error("HavokPhysics() returned undefined or null");
            console.log("Havok loaded successfully:", havok);

            this.physicsPlugin = new BABYLON.HavokPlugin(true, havok);
            this.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), this.physicsPlugin);
            console.log("Physics enabled on scene");

            // Load the map model (cs_assault.glb)
            console.log("Loading ground model cs_assault.glb");
            const groundResult = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "cs_assault.glb", this.scene);

            // Filter only meshes with valid vertices
            const validMeshes = groundResult.meshes.filter(mesh => mesh.getTotalVertices() > 0);
            if (validMeshes.length === 0) throw new Error("No valid mesh with vertices found in cs_assault.glb");

            // Merge meshes if multiple, or use the single valid mesh
            this.ground = validMeshes.length > 1 ? BABYLON.Mesh.MergeMeshes(validMeshes, true, true, undefined, false, true) : validMeshes[0];
            this.ground.position.y = -1; // Adjust position if necessary
            this.ground.scaling = new BABYLON.Vector3(1, 1, 1); // Match CS map scale

            // Apply mesh physics
            this.groundAggregate = new BABYLON.PhysicsAggregate(this.ground, BABYLON.PhysicsShapeType.MESH, { mass: 0 }, this.scene);
            console.log("Ground physics applied");

            // Create the player object
            this.player = new PhysicsObject("player", this.scene, this.physicsPlugin);
            this.player.mesh.position.copyFrom(this.spawnPoint);
            this.player.physicsBody.setGravityFactor(2); // Match provided example

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
        // Enable pointer lock for first-person mode
        if (this.isFirstPerson) this.createPointerLock();

        // Key event listeners using window instead of scene observable
        window.addEventListener("keydown", (event) => {
            this.keysHeld[event.code] = true;
            if (event.code === "KeyV") { // Toggle between first and third person
                this.isFirstPerson = !this.isFirstPerson;
                this.scene.activeCamera = this.isFirstPerson ? this.fpCamera : this.tpCamera;
                if (this.isFirstPerson) this.createPointerLock();
            }
        });
        window.addEventListener("keyup", (event) => {
            this.keysHeld[event.code] = false;
        });

        this.scene.onBeforeRenderObservable.add(() => {
            const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;
            const maxSpeed = 10; // Match provided movementSpeed
            let direction = new BABYLON.Vector3(0, 0, 0);

            // Movement direction based on active camera
            if (this.keysHeld["KeyW"]) direction.addInPlace(this.scene.activeCamera.getForwardRay().direction);
            if (this.keysHeld["KeyS"]) direction.addInPlace(this.scene.activeCamera.getForwardRay().direction.negate());
            if (this.keysHeld["KeyA"]) direction.addInPlace(BABYLON.Vector3.Cross(this.scene.activeCamera.getForwardRay().direction, this.scene.activeCamera.upVector).normalize());
            if (this.keysHeld["KeyD"]) direction.addInPlace(BABYLON.Vector3.Cross(this.scene.activeCamera.getForwardRay().direction, this.scene.activeCamera.upVector).normalize().negate());

            if (!direction.equals(BABYLON.Vector3.Zero())) {
                direction = direction.normalize().scale(maxSpeed);
            }

            const now = Date.now();
            const isMoving = Object.values(this.keysHeld).some(v => v);
            if (isMoving || direction.length() > 0) {
                if (!this.peerManager || this.peerManager.isHost || !this.peerManager.isMultiplayer) {
                    const currentVelocity = this.player.physicsBody.getLinearVelocity();
                    this.player.physicsBody.setLinearVelocity(new BABYLON.Vector3(direction.x, currentVelocity.y, direction.z));
                }
                if (this.peerManager && this.peerManager.isMultiplayer) {
                    console.log("Sending velocity from client:", direction.asArray());
                    this.peerManager.streamManagers.move.sendMove(direction);
                }
                this.stateManager.logEvent("velocity", { velocity: direction.asArray(), position: this.player.mesh.position.asArray() });
            }

            // Jump logic
            if (this.keysHeld["Space"] && this.isOnGround()) {
                const currentVelocity = this.player.physicsBody.getLinearVelocity();
                this.player.physicsBody.setLinearVelocity(new BABYLON.Vector3(currentVelocity.x, 9.8 * 1.5, currentVelocity.z)); // Match provided maxVerticalSpeed
            }

            // Teleport if below threshold (host only)
            if (this.peerManager && this.peerManager.isHost && this.isMultiplayer) {
                if (this.player.mesh.position.y < this.yThreshold) {
                    console.log("Host fell below threshold, teleporting to spawn");
                    this.player.mesh.position.copyFrom(this.spawnPoint);
                    this.player.physicsBody.setLinearVelocity(new BABYLON.Vector3(0, 0, 0));
                    this.peerManager.streamManagers.ghost.sendUpdate();
                }
                Object.keys(this.remotePlayers).forEach(id => {
                    const player = this.remotePlayers[id];
                    if (player.mesh.position.y < this.yThreshold) {
                        console.log(`Remote player ${id} fell below threshold, teleporting to spawn`);
                        player.mesh.position.copyFrom(this.spawnPoint);
                        player.physicsBody.setLinearVelocity(new BABYLON.Vector3(0, 0, 0));
                        this.peerManager.streamManagers.ghost.sendUpdate();
                    }
                });
            }

            // Client tick request every 100ms
            if (this.peerManager && !this.peerManager.isHost && this.isMultiplayer) {
                if (!this.lastTickTime || now - this.lastTickTime >= 100) {
                    this.peerManager.sendDataToPeers({ streamType: "tickRequest", payload: { id: this.peerManager.peer.id } });
                    this.lastTickTime = now;
                }
            }

            // Update camera position
            if (this.isFirstPerson) {
                this.fpCamera.position = this.player.mesh.position.add(new BABYLON.Vector3(0, 1, 0)); // Eye level
            } else {
                this.tpCamera.target = this.player.mesh.position;
            }
        });
    }

    // Check if player is on the ground
    isOnGround() {
        const ray = new BABYLON.Ray(this.player.mesh.position, new BABYLON.Vector3(0, -1, 0), 1.1); // Adjust length based on player size
        const hit = this.scene.pickWithRay(ray);
        return hit && hit.hit;
    }

    // Pointer lock for first-person camera
    createPointerLock() {
        const canvas = this.scene.getEngine().getRenderingCanvas();
        canvas.addEventListener("click", () => {
            canvas.requestPointerLock = canvas.requestPointerLock || canvas.msRequestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
            if (canvas.requestPointerLock) canvas.requestPointerLock();
        });

        const updateCameraRotation = (e) => {
            const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
            const movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
            const sensitivity = 0.0005; // Match provided example
            this.fpCamera.rotation.y += movementX * sensitivity;
            this.fpCamera.rotation.x += movementY * sensitivity;
            this.fpCamera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.fpCamera.rotation.x));
        };

        document.addEventListener("pointerlockchange", () => {
            if (document.pointerLockElement === canvas) {
                document.addEventListener("mousemove", updateCameraRotation, false);
            } else {
                document.removeEventListener("mousemove", updateCameraRotation, false);
            }
        }, false);
    }

    lerpVector3(start, target, amount) {
        return new BABYLON.Vector3(
            BABYLON.Scalar.Lerp(start.x, target.x, amount),
            BABYLON.Scalar.Lerp(start.y, target.y, amount),
            BABYLON.Scalar.Lerp(start.z, target.z, amount)
        );
    }

    getState() {
        if (!this.isReady || !this.player) return null;
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