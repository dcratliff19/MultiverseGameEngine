import { StateManager } from "./StateManager";
import { GunObject } from "../components/GunObject";
import { Inventory } from "../components/Inventory";

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
        this.spawnPoint = new BABYLON.Vector3(0, 2, 0);
        this.yThreshold = -50;
        this.isFirstPerson = true;
        this.inventory = new Inventory();
        this.leftUpperArm = null;  // Upper left arm
        this.leftLowerArm = null;  // Lower left arm (forearm)
        this.rightUpperArm = null; // Upper right arm
        this.rightLowerArm = null; // Lower right arm (forearm)

        // HUD elements
        this.hud = {
            gunIndicator: document.getElementById("gun-indicator"),
            ammoDisplay: document.getElementById("ammo-display"),
            healthFill: document.getElementById("health-fill"),
            reloadIndicator: document.getElementById("reload-indicator")
        };

        // Character controller params
        this.state = "IN_AIR";
        this.inAirSpeed = 10.0;
        this.onGroundSpeed = 10.0;
        this.jumpHeight = 1.5;
        this.wantJump = false;
        this.inputDirection = new BABYLON.Vector3(0, 0, 0);
        this.forwardLocalSpace = new BABYLON.Vector3(0, 0, 1);
        this.characterOrientation = BABYLON.Quaternion.Identity();
        this.characterGravity = new BABYLON.Vector3(0, -9.81 * 2, 0);

        this.setupScene().then(() => {
            this.isReady = true;
            this.setupControls();
            this.updateHUD();
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
            // Camera setup
            this.fpCamera = new BABYLON.UniversalCamera("fpCamera", this.spawnPoint, this.scene);
            this.fpCamera.minZ = 0;
            this.fpCamera.attachControl(this.canvas, true);
        
            this.tpCamera = new BABYLON.ArcRotateCamera("tpCamera", -Math.PI / 2, Math.PI / 2.5, 5, this.spawnPoint, this.scene);
            this.tpCamera.attachControl(this.canvas, true);
        
            this.scene.activeCamera = this.isFirstPerson ? this.fpCamera : this.tpCamera;
        
            // Lighting
            this.light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);
        
            // Physics setup
            const havok = await HavokPhysics();
            if (!havok) throw new Error("HavokPhysics() returned undefined or null");
            this.physicsPlugin = new BABYLON.HavokPlugin(true, havok);
            this.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), this.physicsPlugin);
        
            // Ground setup
            const groundResult = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "cs_assault.glb", this.scene);
            const validMeshes = groundResult.meshes.filter(mesh => mesh.getTotalVertices() > 0);
            if (validMeshes.length === 0) throw new Error("No valid mesh with vertices found in cs_assault.glb");
            this.ground = validMeshes.length > 1 ? BABYLON.Mesh.MergeMeshes(validMeshes, true, true, undefined, false, true) : validMeshes[0];
            this.ground.position.y = -1;
            this.ground.scaling = new BABYLON.Vector3(1.5, 1.5, 1.5);
            this.groundAggregate = new BABYLON.PhysicsAggregate(this.ground, BABYLON.PhysicsShapeType.MESH, { mass: 0 }, this.scene);
        
            // Player dimensions
            this.h = 1.8; // Total height (for physics)
            this.r = 0.6; // Width for physics capsule
    
            // Physics capsule (invisible)
            this.playerMesh = BABYLON.MeshBuilder.CreateCapsule("playerPhysics", { height: this.h, radius: this.r / 2 }, this.scene);
            this.playerMesh.position.copyFrom(this.spawnPoint);
            this.playerMesh.isVisible = false;
            this.characterController = new BABYLON.PhysicsCharacterController(this.spawnPoint, { capsuleHeight: this.h, capsuleRadius: this.r / 2 }, this.scene);
        
            // Stick figure visual representation
            this.playerModel = new BABYLON.Mesh("playerModel", this.scene);
            this.playerModel.position.copyFrom(this.spawnPoint);
            this.playerModel.parent = this.playerMesh;
    
            // Scaling factor to place head at 2 units above ground (2 / 1.9 ≈ 1.05263)
            const scaleFactor = 2 / 1.9; // ≈ 1.05263
            this.playerModel.scaling = new BABYLON.Vector3(scaleFactor, scaleFactor, scaleFactor);
    
            // Adjust position to align head at y = 1 (2 units above ground)
            // Head top: y = 1.0 relative to playerModel, after scaling: 1.0 * 1.05263 = 1.05263
            // Solve: playerModel.position.y + 1.05263 = 1
            // playerModel.position.y = 1 - 1.05263 ≈ -0.05263
            this.playerModel.position.y = 1 - (1.0 * scaleFactor);
    
            // Torso (thin stick)
            this.torso = BABYLON.MeshBuilder.CreateCylinder("torso", { height: 0.8, diameter: 0.1 }, this.scene);
            this.torso.parent = this.playerModel;
            this.torso.position.y = 0.4; // Centered vertically (bottom at y=0, top at y=0.8)
            this.torso.material = new BABYLON.StandardMaterial("torsoMat", this.scene);
            this.torso.material.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5); // Gray
    
            // Head
            this.head = BABYLON.MeshBuilder.CreateSphere("head", { diameter: 0.2 }, this.scene);
            this.head.parent = this.torso;
            this.head.position.y = 0.5; // Atop torso (y=0.9 relative to playerModel)
            this.head.material = new BABYLON.StandardMaterial("headMat", this.scene);
            this.head.material.diffuseColor = new BABYLON.Color3(1, 0.8, 0.6); // Skin tone
    
            // Left Arm (red)
            this.leftArm = BABYLON.MeshBuilder.CreateCylinder("leftArm", { height: 0.8, diameter: 0.08 }, this.scene);
            this.leftArm.parent = this.torso;
            this.leftArm.position = new BABYLON.Vector3(-0.15, 0.35, 0); // Shoulder pivot point
            this.leftArm.rotation.z = Math.PI / 2; // Default: extends left (T-pose for arms)
            this.leftArm.material = new BABYLON.StandardMaterial("leftLimbMat", this.scene);
            this.leftArm.material.diffuseColor = new BABYLON.Color3(1, 0, 0); // Red for left limbs
            this.leftArm.isVisible = !this.isFirstPerson;
    
            // Right Arm (blue)
            this.rightArm = BABYLON.MeshBuilder.CreateCylinder("rightArm", { height: 0.8, diameter: 0.08 }, this.scene);
            this.rightArm.parent = this.torso;
            this.rightArm.position = new BABYLON.Vector3(0.15, 0.35, 0); // Shoulder pivot point
            this.rightArm.rotation.z = -Math.PI / 2; // Default: extends right (T-pose for arms)
            this.rightArm.material = new BABYLON.StandardMaterial("rightLimbMat", this.scene);
            this.rightArm.material.diffuseColor = new BABYLON.Color3(0, 0, 1); // Blue for right limbs
            this.rightArm.isVisible = !this.isFirstPerson;
    
            // Left Leg (red, pivot at top, top connecting at torso bottom)
            this.leftLeg = BABYLON.MeshBuilder.CreateCylinder("leftLeg", { height: 0.9, diameter: 0.08 }, this.scene);
            this.leftLeg.parent = this.torso;
            this.leftLeg.position = new BABYLON.Vector3(-0.05, -0.4, 0); // Pivot at torso bottom (y=0 relative to playerModel)
            this.leftLeg.setPivotPoint(new BABYLON.Vector3(0, 0.45, 0)); // Pivot at top (0.45 below center)
            this.leftLeg.rotation.x = 0; // No rotation needed; cylinder naturally points upward, pivot at top
            this.leftLeg.position.y -= 0.45; // Align top with torso bottom
            this.leftLeg.material = new BABYLON.StandardMaterial("leftLimbMat", this.scene);
            this.leftLeg.material.diffuseColor = new BABYLON.Color3(1, 0, 0); // Red for left limbs
    
            // Right Leg (blue, pivot at top, top connecting at torso bottom)
            this.rightLeg = BABYLON.MeshBuilder.CreateCylinder("rightLeg", { height: 0.9, diameter: 0.08 }, this.scene);
            this.rightLeg.parent = this.torso;
            this.rightLeg.position = new BABYLON.Vector3(0.05, -0.4, 0); // Pivot at torso bottom (y=0 relative to playerModel)
            this.rightLeg.setPivotPoint(new BABYLON.Vector3(0, 0.45, 0)); // Pivot at top (0.45 below center)
            this.rightLeg.rotation.x = 0; // No rotation needed; cylinder naturally points upward, pivot at top
            this.rightLeg.position.y -= 0.45; // Align top with torso bottom
            this.rightLeg.material = new BABYLON.StandardMaterial("rightLimbMat", this.scene);
            this.rightLeg.material.diffuseColor = new BABYLON.Color3(0, 0, 1); // Blue for right limbs
    
            // Gun setup
            const primaryGun = new GunObject(this.scene, "rifle.glb", {
                clipSize: 30,
                totalAmmo: 90,
                fireRate: 0.1,
                bulletSpeed: 400,
                bulletRange: 150,
                thirdPersonPosition: new BABYLON.Vector3(0.55, 0.4, 0.6)
            });
            const secondaryGun = new GunObject(this.scene, "deagle.glb", {
                clipSize: 7,
                totalAmmo: 21,
                fireRate: 0.2,
                bulletSpeed: 300,
                bulletRange: 100,
                thirdPersonPosition: new BABYLON.Vector3(0.6, 0.4, 0.2)
            });
        
            await Promise.all([primaryGun.load(), secondaryGun.load()]);
            if (!primaryGun.isLoaded || !secondaryGun.isLoaded) {
                throw new Error("One or more guns failed to load");
            }
        
            this.inventory.addGun(primaryGun, "primary");
            this.inventory.addGun(secondaryGun, "secondary");
            this.updateGunParenting();
        
            this.remotePlayers = {};
        
            document.addEventListener("visibilitychange", () => {
                if (this.isReady && this.peerManager && !this.peerManager.isHost && this.isMultiplayer) {
                    if (document.visibilityState === "hidden") {
                        this.characterController.setVelocity(BABYLON.Vector3.Zero());
                    } else {
                        this.peerManager.sendDataToPeers({ streamType: "tickRequest", payload: { id: this.peerManager.peer.id } });
                    }
                }
            });
        
            this.engine.runRenderLoop(() => this.scene.render());
        } catch (error) {
            console.error("Failed to load scene:", error);
            this.engine.runRenderLoop(() => this.scene.render());
        }
    }

    updateGunParenting() {
        if (this.inventory.primary && this.inventory.primary.mesh) {
            this.inventory.primary.mesh.parent = null;
        }
        if (this.inventory.secondary && this.inventory.secondary.mesh) {
            this.inventory.secondary.mesh.parent = null;
        }

        const activeGun = this.inventory.getActiveGun();
        if (activeGun && activeGun.isLoaded) {
            activeGun.setFirstPerson(this.isFirstPerson);
            activeGun.updateParenting(this.isFirstPerson ? this.fpCamera : this.torso);
            this.updateHUD();
        }

        // Update arm visibility (single segments now)
        if (this.leftArm) this.leftArm.isVisible = !this.isFirstPerson;
        if (this.rightArm) this.rightArm.isVisible = !this.isFirstPerson;
    }

    shoot() {
        const activeGun = this.inventory.getActiveGun();
        if (!activeGun || !activeGun.isLoaded) {
            console.warn("No active gun or gun not loaded, cannot shoot");
            return;
        }

        const gunPosition = activeGun.mesh.getAbsolutePosition();
        const direction = this.scene.activeCamera.getForwardRay().direction;

        const hitInfo = activeGun.shoot(gunPosition, direction, this.peerManager);
        if (hitInfo) {
            this.handleHit(hitInfo);
        }
        activeGun.applyRecoil(this.fpCamera);
        this.updateHUD();

        if (activeGun.currentClip === 0 && activeGun.totalAmmo > 0) {
            activeGun.reload();
            this.updateHUD();
        }
    }

    reload() {
        const activeGun = this.inventory.getActiveGun();
        if (activeGun && activeGun.isLoaded) {
            activeGun.reload();
            this.updateHUD();
        }
    }

    updateHUD() {
        const activeGun = this.inventory.getActiveGun();
        if (!activeGun || !activeGun.isLoaded) return;

        const gunName = activeGun === this.inventory.primary ? "Primary: Rifle" : "Secondary: Deagle";
        this.hud.gunIndicator.textContent = gunName;

        this.hud.ammoDisplay.textContent = `${activeGun.currentClip} / ${activeGun.totalAmmo}`;

        this.hud.healthFill.style.width = "100%";

        if (activeGun.isReloading) {
            this.hud.reloadIndicator.classList.add("reloading");
        } else {
            this.hud.reloadIndicator.classList.remove("reloading");
        }
    }

    handleHit(hitInfo) {
        const { pickedMesh, pickedPoint, normal } = hitInfo;
        if (pickedMesh === this.ground) {
            const decal = BABYLON.MeshBuilder.CreateDecal("bulletDecal", pickedMesh, {
                position: pickedPoint,
                normal: normal,
                size: new BABYLON.Vector3(0.5, 0.5, 0.5)
            });
            decal.material = new BABYLON.StandardMaterial("decalMat", this.scene);
            decal.material.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
            setTimeout(() => decal.dispose(), 5000);
        } else if (pickedMesh.name.startsWith("player-")) {
            const playerId = pickedMesh.name.split("player-")[1];
            console.log(`Hit remote player ${playerId}`);
            if (this.peerManager && this.peerManager.isHost) {
                const remotePlayer = this.remotePlayers[playerId];
                if (remotePlayer) {
                    const impulse = hitInfo.ray.direction.scale(10);
                    remotePlayer.physicsBody.applyImpulse(impulse, pickedPoint);
                    this.peerManager.streamManagers.ghost.sendUpdate();
                }
            }
        }
    }

    handlePeerShoot(data) {
        const { id, origin, direction, timestamp } = data.payload;
        if (id === this.peerManager.peer.id) return;

        const bullet = BABYLON.MeshBuilder.CreateBox(`bullet-${id}-${timestamp}`, { size: 0.1 }, this.scene);
        bullet.position = BABYLON.Vector3.FromArray(origin);
        bullet.material = new BABYLON.StandardMaterial("bulletMat", this.scene);
        bullet.material.diffuseColor = new BABYLON.Color3(1, 0, 0);

        const travelTime = this.bulletRange / this.bulletSpeed;
        const endPosition = bullet.position.add(BABYLON.Vector3.FromArray(direction).scale(this.bulletRange));
        BABYLON.Animation.CreateAndStartAnimation(
            "bulletMove",
            bullet,
            "position",
            60,
            travelTime * 60,
            bullet.position,
            endPosition,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
            null,
            () => bullet.dispose()
        );

        if (this.peerManager.isHost) {
            const ray = new BABYLON.Ray(BABYLON.Vector3.FromArray(origin), BABYLON.Vector3.FromArray(direction), this.bulletRange);
            const hit = this.scene.pickWithRay(ray);
            if (hit && hit.hit) this.handleHit({ pickedMesh: hit.pickedMesh, pickedPoint: hit.pickedPoint, normal: hit.normal, ray });
        }
    }

    getNextState(supportInfo) {
        if (this.state === "IN_AIR") {
            if (supportInfo.supportedState === BABYLON.CharacterSupportedState.SUPPORTED) {
                return "ON_GROUND";
            }
            return "IN_AIR";
        } else if (this.state === "ON_GROUND") {
            if (supportInfo.supportedState !== BABYLON.CharacterSupportedState.SUPPORTED) {
                return "IN_AIR";
            }
            if (this.wantJump) {
                return "START_JUMP";
            }
            return "ON_GROUND";
        } else if (this.state === "START_JUMP") {
            return "IN_AIR";
        }
        return this.state;
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
            if (event.code === "Digit1") {
                if (this.inventory.activeGun !== this.inventory.primary) {
                    this.inventory.switchGun();
                    this.updateGunParenting();
                    this.updateHUD();
                }
            }
            if (event.code === "Digit2") {
                if (this.inventory.activeGun !== this.inventory.secondary) {
                    this.inventory.switchGun();
                    this.updateGunParenting();
                    this.updateHUD();
                }
            }
            if (event.code === "KeyR") this.reload();
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
    
        // Animation variables for walking
        let legAnimationTime = 0;
        const legSwingAmplitude = Math.PI / 12; // 15 degrees to prevent raising
        const legSwingFrequency = 4; // Cycles per second
    
        this.scene.onBeforeRenderObservable.add(() => {
            const dt = this.scene.getEngine().getDeltaTime() / 1000;
            if (!this.characterController) return;
    
            this.playerMesh.position.copyFrom(this.characterController.getPosition());
    
            // Raycast to find ground level beneath player
            const rayOrigin = new BABYLON.Vector3(this.playerMesh.position.x + 0.5, this.playerMesh.position.y + 1, this.playerMesh.position.z); // Slightly above player
            const rayDirection = new BABYLON.Vector3(0, -1, 0); // Downward
            const ray = new BABYLON.Ray(rayOrigin, rayDirection, 10); // Max distance of 10 units
            const hit = this.scene.pickWithRay(ray, (mesh) => mesh === this.ground);
    
            let groundLevel = -1; // Default ground level
            if (hit && hit.pickedPoint) {
                groundLevel = hit.pickedPoint.y;
            }
    
            if (this.isFirstPerson) {
                this.fpCamera.position.copyFrom(this.playerMesh.position);
                // Target camera height: 2 units above ground (aligned with head)
                const targetCameraHeight = groundLevel + 2.0; // 2 units above actual ground
                this.fpCamera.position.y = targetCameraHeight;
                BABYLON.Quaternion.FromEulerAnglesToRef(0, this.fpCamera.rotation.y, 0, this.characterOrientation);
            } else {
                this.tpCamera.target.copyFrom(this.playerMesh.position);
                const forward = this.tpCamera.getForwardRay().direction;
                forward.y = 0;
                forward.normalize();
                const yaw = Math.atan2(forward.x, forward.z);
                BABYLON.Quaternion.RotationAxisToRef(BABYLON.Axis.Y, yaw, this.characterOrientation);
            }
    
            this.playerMesh.rotationQuaternion = this.characterOrientation.clone();
            this.playerModel.rotationQuaternion = this.characterOrientation.clone();
    
            const down = new BABYLON.Vector3(0, -1, 0);
            const support = this.characterController.checkSupport(dt, down);
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
                    this.playerMesh.position.copyFrom(this.spawnPoint);
                    this.characterController.setVelocity(BABYLON.Vector3.Zero());
                    this.peerManager.streamManagers.ghost.sendUpdate();
                }
                Object.keys(this.remotePlayers).forEach(id => {
                    const player = this.remotePlayers[id];
                    if (player.mesh.position.y < this.yThreshold) {
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
    
            // Walking animation for legs (pivot around X-axis, limited to prevent raising)
            if (this.state === "ON_GROUND" && desiredVelocity.length() > 0.1) {
                legAnimationTime += dt * legSwingFrequency;
                const swing = -Math.sin(legAnimationTime) * legSwingAmplitude; // Negative to swing downward
                this.leftLeg.rotation.x = swing; // Base at 0, swing downward
                this.rightLeg.rotation.x = -swing; // Opposite swing downward
            } else {
                this.leftLeg.rotation.x = 0; // Reset to vertical standing (downward)
                this.rightLeg.rotation.x = 0; // Reset to vertical standing (downward)
            }
    
            this.updateHUD();
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

    startSinglePlayer() { }
}