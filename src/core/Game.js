import { StateManager } from "./StateManager";
import { Character } from "./Character";

class AnimationController {
    constructor(animationGroups) {
        this.animations = {
            idle: animationGroups.find(anim => anim.name === "Armature|Ideal") || animationGroups[0],
            walk: animationGroups.find(anim => anim.name === "Armature|Walk"),
            run: animationGroups.find(anim => anim.name === "Armature|Run"),
            jump: animationGroups.find(anim => anim.name === "Armature|Jump1"),
            punch: animationGroups.find(anim => anim.name === "Armature|Punch")
        };

        this.currentAnim = this.animations.idle;
        animationGroups.forEach(anim => anim.applyRootMotion = false);
        if (this.animations.jump) {
            this.animations.jump.speedRatio = 1.5;
            this.animations.jump.startFrame = 5;
        }
        this.animations.idle?.play(true);
    }

    playAnimation(animationName, loop = false) {
        if (this.animations[animationName]) {
            this.currentAnim?.stop();
            this.animations[animationName].play(loop);
            this.currentAnim = this.animations[animationName];
        }
    }

    onAnimationEnd(animationName, callback) {
        if (this.animations[animationName]) {
            this.animations[animationName].onAnimationEndObservable.addOnce(callback);
        }
    }
}

export class Game {
    constructor(engine, canvas) {
        this.engine = engine;
        this.scene = new BABYLON.Scene(engine);
        this.canvas = canvas;
        this.stateManager = new StateManager(this);
        this.isReady = false;
        this.remotePlayers = {};
        this.peerManager = null;
        this.keysHeld = { w: false, s: false, a: false, d: false, ' ': false, shift: false };
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

            const havok = await HavokPhysics();
            if (!havok) throw new Error("HavokPhysics() returned undefined or null");
            this.physicsPlugin = new BABYLON.HavokPlugin(true, havok);
            this.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), this.physicsPlugin);

            const groundResult = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "cs_assault.glb", this.scene);
            const validMeshes = groundResult.meshes.filter(mesh => mesh.getTotalVertices() > 0);
            if (validMeshes.length === 0) throw new Error("No valid mesh in cs_assault.glb");
            this.ground = validMeshes.length > 1 ? BABYLON.Mesh.MergeMeshes(validMeshes, true, true, undefined, false, true) : validMeshes[0];
            this.ground.name = "ground";
            this.ground.position.y = -1;
            console.log("Ground position:", this.ground.position.y, "Ground bounding box:", this.ground.getBoundingInfo().boundingBox);

            this.groundAggregate = new BABYLON.PhysicsAggregate(this.ground, BABYLON.PhysicsShapeType.MESH, { mass: 0 }, this.scene);

            const playerResult = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "mountain_orge_2.glb", this.scene);
            const playerMesh = playerResult.meshes[0];
            if (!playerMesh) throw new Error("No valid mesh in mountain_orge_2.glb");
            playerMesh.position.y = 2; // Start higher to ensure drop to ground
            playerResult.meshes.forEach(mesh => {
                if (mesh !== playerMesh && (mesh.name.includes("Plane") || mesh.name.includes("Box"))) {
                    mesh.setEnabled(false);
                }
            });
            this.animationController = new AnimationController(playerResult.animationGroups);
            this.player = new Character(playerMesh, this.scene, this.physicsPlugin, this.animationController);

            const boundingInfo = playerMesh.getBoundingInfo();
            console.log("Player bounding box:", boundingInfo.boundingBox.minimum, boundingInfo.boundingBox.maximum);

            this.camera = new BABYLON.FollowCamera("camera", new BABYLON.Vector3(0, 5, -10), this.scene);
            this.camera.heightOffset = 5;
            this.camera.radius = 10;
            this.camera.rotationOffset = -180;
            this.camera.cameraAcceleration = 0.05;
            this.camera.maxCameraSpeed = 10;
            this.camera.fov = 1.5;
            this.camera.lockedTarget = this.player.mesh;

            this.remotePlayers = {};

            document.addEventListener("visibilitychange", () => {
                if (this.isReady && this.peerManager && !this.peerManager.isHost && this.isMultiplayer) {
                    if (document.visibilityState === "hidden") {
                        this.player.aggregate.body.setMotionType(BABYLON.PhysicsMotionType.STATIC);
                    } else {
                        this.player.aggregate.body.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC);
                        this.peerManager.sendDataToPeers({ streamType: "tickRequest", payload: { id: this.peerManager.peer.id } });
                    }
                }
            });

            this.engine.runRenderLoop(() => this.scene.render());
        } catch (error) {
            console.error("Setup failed:", error);
            this.engine.runRenderLoop(() => this.scene.render());
        }
    }

    setupControls() {
        this.scene.onKeyboardObservable.add((kbInfo) => {
            const key = kbInfo.event.key.toLowerCase();
            if (this.keysHeld.hasOwnProperty(key)) {
                this.keysHeld[key] = kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN;
            }
            this.keysHeld.shift = kbInfo.event.shiftKey;
        });

        this.canvas.addEventListener("click", () => {
            if (!document.pointerLockElement) {
                this.canvas.requestPointerLock();
            }
        });

        this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE && document.pointerLockElement === this.canvas) {
                this.player.updateRotation(pointerInfo.event.movementX);
            }
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN && pointerInfo.event.button === 0) {
                if (!this.player.isPunching) this.handlePunch();
            }
        });

        this.scene.onBeforeRenderObservable.add(() => {
            const wasGrounded = this.player.isGrounded;
            this.player.isGrounded = this.player.checkGround();
            console.log("Grounded:", this.player.isGrounded, "Position:", this.player.mesh.position.y, "Angular Velocity:", this.player.aggregate.body.getAngularVelocity());

            if (!this.player.isPunching) {
                const forward = this.player.mesh.forward;
                forward.y = 0;
                forward.normalize();
                const right = BABYLON.Vector3.Cross(forward, BABYLON.Vector3.Up());
                let moveDirection = BABYLON.Vector3.Zero();

                if (this.keysHeld.w) moveDirection.addInPlace(forward);
                if (this.keysHeld.s) moveDirection.subtractInPlace(forward);
                if (this.keysHeld.a) moveDirection.subtractInPlace(right);
                if (this.keysHeld.d) moveDirection.addInPlace(right);

                const speed = this.keysHeld.shift ? this.player.runSpeed : this.player.walkSpeed;
                const isMoving = moveDirection.length() > 0;

                if (!this.peerManager || this.peerManager.isHost || !this.peerManager.isMultiplayer) {
                    if (isMoving) {
                        moveDirection.normalize();
                        this.player.move(moveDirection, speed);
                    } else {
                        this.player.move(BABYLON.Vector3.Zero(), 0);
                    }
                    if (this.keysHeld[' '] && wasGrounded && !this.player.isJumping) {
                        this.player.jump();
                    }
                }

                if (this.peerManager && this.isMultiplayer) {
                    const moveData = { direction: moveDirection.asArray(), speed, jumping: this.keysHeld[' '] };
                    this.peerManager.streamManagers.move.sendMove(moveData);
                }

                this.updateAnimationState(isMoving);
            }

            const desiredRotation = BABYLON.Quaternion.RotationYawPitchRoll(this.player.yaw, 0, 0);
            this.player.mesh.rotationQuaternion = desiredRotation;
            this.player.aggregate.body.transformNode.rotationQuaternion = desiredRotation;
            this.player.aggregate.body.setAngularVelocity(new BABYLON.Vector3(0, 0, 0));

            if (!wasGrounded && this.player.isGrounded) {
                this.player.isJumping = false;
                this.updateAnimationState(false);
            }

            if (this.peerManager && !this.peerManager.isHost && this.isMultiplayer) {
                const now = Date.now();
                if (!this.lastTickTime || now - this.lastTickTime >= 100) {
                    this.peerManager.sendDataToPeers({ streamType: "tickRequest", payload: { id: this.peerManager.peer.id } });
                    this.lastTickTime = now;
                }
            }
        });
    }

    handlePunch() {
        this.player.isPunching = true;
        this.animationController.playAnimation("punch");
        this.animationController.onAnimationEnd("punch", () => {
            this.player.isPunching = false;
            this.updateAnimationState(false);
        });
    }

    updateAnimationState(isMoving) {
        if (this.player.isGrounded) {
            if (this.player.isJumping) {
                // Keep jump animation until landing
            } else if (isMoving) {
                this.animationController.playAnimation(this.keysHeld.shift ? "run" : "walk", true);
            } else {
                this.animationController.playAnimation("idle", true);
            }
        }
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
        return {
            player: {
                position: this.player.mesh.position.asArray(),
                velocity: this.player.aggregate.body.getLinearVelocity().asArray(),
                yaw: this.player.yaw,
                isPunching: this.player.isPunching
            },
            objects: Object.keys(this.remotePlayers).map(id => ({
                name: `player-${id}`,
                position: this.remotePlayers[id].mesh.position.asArray(),
                velocity: this.remotePlayers[id].aggregate.body.getLinearVelocity().asArray()
            }))
        };
    }

    startSinglePlayer() {}
}