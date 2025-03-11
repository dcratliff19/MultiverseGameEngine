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
        this.keysHeld = {};
        this.lastTickTime = 0;
        this.spawnPoint = new BABYLON.Vector3(0, 2, 0); // Adjusted for capsule and map scale
        this.yThreshold = -50;
        this.isFirstPerson = true;
        this.fireRate = 0.2;
        this.lastShotTime = 0;
        this.bulletSpeed = 300;
        this.bulletRange = 100;

        // Character controller params
        this.state = "IN_AIR";
        this.inAirSpeed = 10.0; // Matches your maxSpeed
        this.onGroundSpeed = 10.0;
        this.jumpHeight = 1.5; // Matches your jump velocity (9.8 * 1.5)
        this.wantJump = false;
        this.inputDirection = new BABYLON.Vector3(0, 0, 0);
        this.forwardLocalSpace = new BABYLON.Vector3(0, 0, 1);
        this.characterOrientation = BABYLON.Quaternion.Identity();
        this.characterGravity = new BABYLON.Vector3(0, -9.81 * 2, 0); // Matches your gravityFactor: 2

        this.setupScene().then(() => {
            this.isReady = true;
            this.setupControls();
        });
    }

    setPeerManager(peerManager) {
        this.peerManager = peerManager;
        this.peerManager.registerGameCallback((data) => {
            if (data.streamType === "shoot") {
                this.handlePeerShoot(data);
            }
        });
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

            this.scene.activeCamera = this.isFirstPerson ? this.fpCamera : this.tpCamera;

            this.light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);

            console.log("Attempting to load Havok via CDN...");
            const havok = await HavokPhysics();
            if (!havok) throw new Error("HavokPhysics() returned undefined or null");
            console.log("Havok loaded successfully:", havok);

            this.physicsPlugin = new BABYLON.HavokPlugin(true, havok);
            this.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), this.physicsPlugin);
            console.log("Physics enabled on scene");

            // Load cs_assault.glb
            console.log("Loading ground model cs_assault.glb");
            const groundResult = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "cs_assault.glb", this.scene);
            const validMeshes = groundResult.meshes.filter(mesh => mesh.getTotalVertices() > 0);
            if (validMeshes.length === 0) throw new Error("No valid mesh with vertices found in cs_assault.glb");

            this.ground = validMeshes.length > 1 ? BABYLON.Mesh.MergeMeshes(validMeshes, true, true, undefined, false, true) : validMeshes[0];
            this.ground.position.y = -1;
            this.ground.scaling = new BABYLON.Vector3(1.5, 1.5, 1.5); // As per your working code
            this.groundAggregate = new BABYLON.PhysicsAggregate(this.ground, BABYLON.PhysicsShapeType.MESH, { mass: 0 }, this.scene);
            console.log("Ground physics applied");

            // Character controller setup
            this.h = 1.8; // Matches typical player height, adjustable
            this.r = 0.6; // Matches your sphere-like size
            this.playerMesh = BABYLON.MeshBuilder.CreateCapsule("player", { height: this.h, radius: this.r }, this.scene);
            this.playerMesh.position.copyFrom(this.spawnPoint);
            this.characterController = new BABYLON.PhysicsCharacterController(this.spawnPoint, { capsuleHeight: this.h, capsuleRadius: this.r }, this.scene);

            await this.loadGun();
            this.remotePlayers = {};

            document.addEventListener("visibilitychange", () => {
                if (this.isReady && this.peerManager && !this.peerManager.isHost && this.isMultiplayer) {
                    if (document.visibilityState === "hidden") {
                        console.log("Client tabbed out, pausing physics");
                        this.characterController.setVelocity(BABYLON.Vector3.Zero());
                    } else {
                        console.log("Client tabbed back in, resuming physics");
                        this.peerManager.sendDataToPeers({ streamType: "tickRequest", payload: { id: this.peerManager.peer.id } });
                    }
                }
            });

            this.engine.runRenderLoop(() => this.scene.render());
        } catch (error) {
            console.error("Failed to load Havok or cs_assault.glb:", error);
            this.engine.runRenderLoop(() => this.scene.render());
        }
    }

    async loadGun() {
        try {
            console.log("Loading Desert Eagle model...");
            const gunResult = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "deagle.glb", this.scene);
            this.gun = gunResult.meshes[0];
            this.gun.scaling = new BABYLON.Vector3(1.5, 1.5, 1.5);
            this.gun.rotationQuaternion = new BABYLON.Quaternion();
            this.updateGunParenting();
            console.log("Big-ass Desert Eagle loaded and attached");
        } catch (error) {
            console.error("Failed to load Desert Eagle:", error);
        }
    }

    updateGunParenting() {
        if (!this.gun) return;
        if (this.isFirstPerson) {
            this.gun.parent = this.fpCamera;
            this.gun.position = new BABYLON.Vector3(0.6, -0.3, 1.5);
            this.gun.rotation = new BABYLON.Vector3(0, 0, 0);
        } else {
            this.gun.parent = this.playerMesh;
            this.gun.position = new BABYLON.Vector3(1.5, 1.5, 0);
            this.gun.rotation = new BABYLON.Vector3(0, Math.PI, 0);
        }
    }

    shoot() {
        const now = Date.now() / 1000;
        if (now - this.lastShotTime < this.fireRate) return;
        this.lastShotTime = now;

        const ray = this.scene.activeCamera.getForwardRay(this.bulletRange);
        const origin = ray.origin.clone();
        const direction = ray.direction.clone();

        const bullet = BABYLON.MeshBuilder.CreateSphere("bullet", { diameter: 0.1 }, this.scene);
        bullet.position = origin.clone();
        const bulletBody = new BABYLON.PhysicsAggregate(bullet, BABYLON.PhysicsShapeType.SPHERE, { mass: 0.1 }, this.scene);
        bulletBody.body.setLinearVelocity(direction.scale(this.bulletSpeed));
        setTimeout(() => bullet.dispose(), 1000);

        const hit = this.scene.pickWithRay(ray);
        if (hit && hit.hit) {
            console.log("Shot hit:", hit.pickedMesh.name, "at", hit.pickedPoint.asArray());
            this.handleHit(hit);
        }

        if (this.peerManager && this.peerManager.isMultiplayer) {
            this.peerManager.sendDataToPeers({
                streamType: "shoot",
                payload: {
                    id: this.peerManager.peer.id,
                    origin: origin.asArray(),
                    direction: direction.asArray(),
                    timestamp: now
                }
            });
        }

        this.applyRecoil();
    }

    handleHit(hit) {
        const hitMesh = hit.pickedMesh;
        if (hitMesh === this.ground) {
            const decal = BABYLON.MeshBuilder.CreateDecal("bulletDecal", hitMesh, {
                position: hit.pickedPoint,
                normal: hit.normal,
                size: new BABYLON.Vector3(0.5, 0.5, 0.5)
            });
            decal.material = new BABYLON.StandardMaterial("decalMat", this.scene);
            decal.material.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
            setTimeout(() => decal.dispose(), 5000);
        } else if (hitMesh.name.startsWith("player-")) {
            const playerId = hitMesh.name.split("player-")[1];
            console.log(`Hit remote player ${playerId}`);
            if (this.peerManager && this.peerManager.isHost) {
                const remotePlayer = this.remotePlayers[playerId];
                if (remotePlayer) {
                    const impulse = hit.ray.direction.scale(10);
                    remotePlayer.physicsBody.applyImpulse(impulse, hit.pickedPoint);
                    this.peerManager.streamManagers.ghost.sendUpdate();
                }
            }
        }
    }

    applyRecoil() {
        if (this.isFirstPerson) {
            this.fpCamera.rotation.x -= 0.05;
            setTimeout(() => this.fpCamera.rotation.x += 0.03, 100);
        }
    }

    handlePeerShoot(data) {
        const { id, origin, direction, timestamp } = data.payload;
        if (id === this.peerManager.peer.id) return;

        const bullet = BABYLON.MeshBuilder.CreateSphere(`bullet-${id}-${timestamp}`, { diameter: 0.1 }, this.scene);
        bullet.position = BABYLON.Vector3.FromArray(origin);
        const bulletBody = new BABYLON.PhysicsAggregate(bullet, BABYLON.PhysicsShapeType.SPHERE, { mass: 0.1 }, this.scene);
        bulletBody.body.setLinearVelocity(BABYLON.Vector3.FromArray(direction).scale(this.bulletSpeed));
        setTimeout(() => bullet.dispose(), 1000);

        if (this.peerManager.isHost) {
            const ray = new BABYLON.Ray(BABYLON.Vector3.FromArray(origin), BABYLON.Vector3.FromArray(direction), this.bulletRange);
            const hit = this.scene.pickWithRay(ray);
            if (hit && hit.hit) this.handleHit(hit);
        }
    }

    getNextState(supportInfo) {
        if (supportInfo.supportedState === BABYLON.CharacterSupportedState.SUPPORTED) {
            return "ON_GROUND";
        }
        if (this.state === "START_JUMP") return "IN_AIR";
        return "IN_AIR";
    }

    getDesiredVelocity(deltaTime, supportInfo, characterOrientation, currentVelocity) {
        const nextState = this.getNextState(supportInfo);
        if (nextState !== this.state) this.state = nextState;

        const upWorld = this.characterGravity.normalizeToNew().scale(-1);
        const forwardWorld = this.forwardLocalSpace.applyRotationQuaternion(characterOrientation);

        if (this.state === "IN_AIR") {
            const desiredVelocity = this.inputDirection.scale(this.inAirSpeed).applyRotationQuaternion(characterOrientation);
            let outputVelocity = this.characterController.calculateMovement(
                deltaTime, forwardWorld, upWorld, currentVelocity, BABYLON.Vector3.ZeroReadOnly, desiredVelocity, upWorld
            );
            outputVelocity.addInPlace(upWorld.scale(-outputVelocity.dot(upWorld)));
            outputVelocity.addInPlace(upWorld.scale(currentVelocity.dot(upWorld)));
            outputVelocity.addInPlace(this.characterGravity.scale(deltaTime));
            return outputVelocity;
        } else if (this.state === "ON_GROUND") {
            const desiredVelocity = this.inputDirection.scale(this.onGroundSpeed).applyRotationQuaternion(characterOrientation);
            let outputVelocity = this.characterController.calculateMovement(
                deltaTime, forwardWorld, supportInfo.averageSurfaceNormal, currentVelocity, supportInfo.averageSurfaceVelocity, desiredVelocity, upWorld
            );
            outputVelocity.subtractInPlace(supportInfo.averageSurfaceVelocity);
            const inv1k = 1e-3;
            if (outputVelocity.dot(upWorld) > inv1k) {
                const velLen = outputVelocity.length();
                outputVelocity.normalizeFromLength(velLen);
                const horizLen = velLen / supportInfo.averageSurfaceNormal.dot(upWorld);
                const c = supportInfo.averageSurfaceNormal.cross(outputVelocity);
                outputVelocity = c.cross(upWorld).scale(horizLen);
            }
            outputVelocity.addInPlace(supportInfo.averageSurfaceVelocity);
            return outputVelocity;
        } else if (this.state === "START_JUMP") {
            const u = Math.sqrt(2 * this.characterGravity.length() * this.jumpHeight);
            const curRelVel = currentVelocity.dot(upWorld);
            return currentVelocity.add(upWorld.scale(u - curRelVel));
        }
        return BABYLON.Vector3.Zero();
    }

    setupControls() {
        if (this.isFirstPerson) this.createPointerLock();

        window.addEventListener("keydown", (event) => {
            this.keysHeld[event.code] = true;
            if (event.code === "KeyV") {
                this.isFirstPerson = !this.isFirstPerson;
                this.scene.activeCamera = this.isFirstPerson ? this.fpCamera : this.tpCamera;
                if (this.isFirstPerson) this.createPointerLock();
                this.updateGunParenting();
            }
            if (event.code === "KeyW") this.inputDirection.z = 1;
            if (event.code === "KeyS") this.inputDirection.z = -1;
            if (event.code === "KeyA") this.inputDirection.x = -1;
            if (event.code === "KeyD") this.inputDirection.x = 1;
            if (event.code === "Space") this.wantJump = true;
        });

        window.addEventListener("keyup", (event) => {
            this.keysHeld[event.code] = false;
            if (event.code === "KeyW" || event.code === "KeyS") this.inputDirection.z = 0;
            if (event.code === "KeyA" || event.code === "KeyD") this.inputDirection.x = 0;
            if (event.code === "Space") this.wantJump = false;
        });

        window.addEventListener("mousedown", (event) => {
            if (event.button === 0 && document.pointerLockElement === this.canvas) this.shoot();
        });

        this.scene.onBeforeRenderObservable.add(() => {
            const dt = this.scene.getEngine().getDeltaTime() / 1000;
            if (!this.characterController) return;

            this.playerMesh.position.copyFrom(this.characterController.getPosition());

            if (this.isFirstPerson) {
                this.fpCamera.position.copyFrom(this.playerMesh.position);
                this.fpCamera.position.y += this.h / 2; // Eye level at capsule center
            } else {
                this.tpCamera.target.copyFrom(this.playerMesh.position);
            }

            const down = new BABYLON.Vector3(0, -1, 0);
            const support = this.characterController.checkSupport(dt, down);
            BABYLON.Quaternion.FromEulerAnglesToRef(0, this.fpCamera.rotation.y, 0, this.characterOrientation);
            const currentVelocity = this.characterController.getVelocity();
            const desiredVelocity = this.getDesiredVelocity(dt, support, this.characterOrientation, currentVelocity);

            if (!this.peerManager || this.peerManager.isHost || !this.peerManager.isMultiplayer) {
                this.characterController.setVelocity(desiredVelocity);
                this.characterController.integrate(dt, support, this.characterGravity);
            }

            if (this.peerManager && this.peerManager.isMultiplayer) {
                this.peerManager.streamManagers.move.sendMove(desiredVelocity);
                this.stateManager.logEvent("velocity", { velocity: desiredVelocity.asArray(), position: this.playerMesh.position.asArray() });
            }

            if (this.peerManager && this.peerManager.isHost && this.isMultiplayer) {
                if (this.playerMesh.position.y < this.yThreshold) {
                    console.log("Host fell below threshold, teleporting to spawn");
                    this.playerMesh.position.copyFrom(this.spawnPoint);
                    this.characterController.setVelocity(BABYLON.Vector3.Zero());
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

            const now = Date.now();
            if (this.peerManager && !this.peerManager.isHost && this.isMultiplayer) {
                if (!this.lastTickTime || now - this.lastTickTime >= 100) {
                    this.peerManager.sendDataToPeers({ streamType: "tickRequest", payload: { id: this.peerManager.peer.id } });
                    this.lastTickTime = now;
                }
            }
        });
    }

    createPointerLock() {
        const canvas = this.scene.getEngine().getRenderingCanvas();
        canvas.addEventListener("click", () => {
            if (canvas.requestPointerLock) canvas.requestPointerLock();
        });

        const updateCameraRotation = (e) => {
            const movementX = e.movementX || 0;
            const movementY = e.movementY || 0;
            const sensitivity = 0.0005;
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
        if (!this.isReady || !this.playerMesh) return null;
        const state = {
            player: {
                position: this.playerMesh.position.asArray(),
                velocity: this.characterController.getVelocity().asArray()
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