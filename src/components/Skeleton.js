// Skeleton.js
import { Skeleton as BabylonSkeleton, Bone, Matrix, MeshBuilder, StandardMaterial, VertexBuffer } from "@babylonjs/core";

export class Skeleton {
    constructor(scene, physicsPlugin, position = new BABYLON.Vector3(0, 2, 0), game) {
        this.scene = scene;
        this.physicsPlugin = physicsPlugin;
        this.game = game;
        this.position = position;
        this.isLoaded = false;
        this.health = 100;

        // Model properties
        this.height = 1.8;
        this.radius = 0.6;
        this.isWalking = false;

        // Initialize the skeleton
        this.setupSkeleton();
    }

    setupSkeleton() {
        try {
            // Visual stick-figure model (root container, also the physics mesh)
            this.model = new BABYLON.Mesh("skeletonModel", this.scene);
            this.model.position.copyFrom(this.position);
            this.model.rotationQuaternion = BABYLON.Quaternion.Identity();

            // Debug: Log initial model position
            console.log("Skeleton setup - Initial model position:", this.model.position.asArray());

            // Create the Babylon.js Skeleton
            this.babylonSkeleton = new BabylonSkeleton("skeletonRig", "skeletonRig", this.scene);

            // Define bones and corresponding meshes
            const torsoLength = 0.8;
            const armLength = 0.4;
            const legLength = 0.45;
            const headSize = 0.2;
            const limbDiameter = 0.08;

            // Material for all parts
            const material = new StandardMaterial("skeletonMat", this.scene);
            material.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);

            // Torso bone and mesh
            this.torsoBone = new Bone("torso", this.babylonSkeleton, null, 
                Matrix.Translation(0, torsoLength / 2, 0));
            this.torsoMesh = MeshBuilder.CreateCylinder("torsoMesh", { 
                height: torsoLength, 
                diameter: limbDiameter 
            }, this.scene);
            this.torsoMesh.parent = this.model;
            this.torsoMesh.position.y = torsoLength / 2;
            this.torsoMesh.material = material;

            // Debug: Log torso mesh position
            console.log("Skeleton setup - Torso mesh position (relative):", this.torsoMesh.position.asArray());
            console.log("Skeleton setup - Torso mesh absolute position:", this.torsoMesh.getAbsolutePosition().asArray());

            // Head bone and mesh
            this.headBone = new Bone("head", this.babylonSkeleton, this.torsoBone, 
                Matrix.Translation(0, torsoLength / 2 + headSize / 2, 0));
            this.headMesh = MeshBuilder.CreateSphere("headMesh", { 
                diameter: headSize 
            }, this.scene);
            this.headMesh.parent = this.torsoMesh;
            this.headMesh.position.y = torsoLength / 2;
            this.headMesh.material = material;

            // Left Upper Arm bone and mesh
            this.leftUpperArmBone = new Bone("leftUpperArm", this.babylonSkeleton, this.torsoBone, 
                Matrix.RotationZ(Math.PI / 2).multiply(Matrix.Translation(-0.15, torsoLength / 2 - 0.05, 0)));
            this.leftUpperArmMesh = MeshBuilder.CreateCylinder("leftUpperArmMesh", { 
                height: armLength, 
                diameter: limbDiameter 
            }, this.scene);
            this.leftUpperArmMesh.parent = this.torsoMesh;
            this.leftUpperArmMesh.position = new BABYLON.Vector3(-0.15, torsoLength / 2 - 0.05, 0);
            this.leftUpperArmMesh.rotation.z = Math.PI / 2;
            this.leftUpperArmMesh.material = material;

            // Left Lower Arm bone and mesh
            this.leftLowerArmBone = new Bone("leftLowerArm", this.babylonSkeleton, this.leftUpperArmBone, 
                Matrix.Translation(-armLength, 0, 0));
            this.leftLowerArmMesh = MeshBuilder.CreateCylinder("leftLowerArmMesh", { 
                height: armLength, 
                diameter: limbDiameter 
            }, this.scene);
            this.leftLowerArmMesh.parent = this.leftUpperArmMesh;
            this.leftLowerArmMesh.position = new BABYLON.Vector3(-armLength, 0, 0);
            this.leftLowerArmMesh.material = material;

            // Right Upper Arm bone and mesh
            this.rightUpperArmBone = new Bone("rightUpperArm", this.babylonSkeleton, this.torsoBone, 
                Matrix.RotationZ(-Math.PI / 2).multiply(Matrix.Translation(0.15, torsoLength / 2 - 0.05, 0)));
            this.rightUpperArmMesh = MeshBuilder.CreateCylinder("rightUpperArmMesh", { 
                height: armLength, 
                diameter: limbDiameter 
            }, this.scene);
            this.rightUpperArmMesh.parent = this.torsoMesh;
            this.rightUpperArmMesh.position = new BABYLON.Vector3(0.15, torsoLength / 2 - 0.05, 0);
            this.rightUpperArmMesh.rotation.z = -Math.PI / 2;
            this.rightUpperArmMesh.material = material;

            // Right Lower Arm bone and mesh
            this.rightLowerArmBone = new Bone("rightLowerArm", this.babylonSkeleton, this.rightUpperArmBone, 
                Matrix.Translation(armLength, 0, 0));
            this.rightLowerArmMesh = MeshBuilder.CreateCylinder("rightLowerArmMesh", { 
                height: armLength, 
                diameter: limbDiameter 
            }, this.scene);
            this.rightLowerArmMesh.parent = this.rightUpperArmMesh;
            this.rightLowerArmMesh.position = new BABYLON.Vector3(armLength, 0, 0);
            this.rightLowerArmMesh.material = material;

            // Left Upper Leg bone and mesh
            this.leftUpperLegBone = new Bone("leftUpperLeg", this.babylonSkeleton, this.torsoBone, 
                Matrix.Translation(-0.05, -torsoLength / 2, 0));
            this.leftUpperLegMesh = MeshBuilder.CreateCylinder("leftUpperLegMesh", { 
                height: legLength, 
                diameter: limbDiameter 
            }, this.scene);
            this.leftUpperLegMesh.parent = this.torsoMesh;
            this.leftUpperLegMesh.position = new BABYLON.Vector3(-0.05, -torsoLength / 2 - legLength / 2, 0);
            this.leftUpperLegMesh.material = material;

            // Left Lower Leg bone and mesh
            this.leftLowerLegBone = new Bone("leftLowerLeg", this.babylonSkeleton, this.leftUpperLegBone, 
                Matrix.Translation(0, -legLength, 0));
            this.leftLowerLegMesh = MeshBuilder.CreateCylinder("leftLowerLegMesh", { 
                height: legLength, 
                diameter: limbDiameter 
            }, this.scene);
            this.leftLowerLegMesh.parent = this.leftUpperLegMesh;
            this.leftLowerLegMesh.position = new BABYLON.Vector3(0, -legLength, 0);
            this.leftLowerLegMesh.material = material;

            // Right Upper Leg bone and mesh
            this.rightUpperLegBone = new Bone("rightUpperLeg", this.babylonSkeleton, this.torsoBone, 
                Matrix.Translation(0.05, -torsoLength / 2, 0));
            this.rightUpperLegMesh = MeshBuilder.CreateCylinder("rightUpperLegMesh", { 
                height: legLength, 
                diameter: limbDiameter 
            }, this.scene);
            this.rightUpperLegMesh.parent = this.torsoMesh;
            this.rightUpperLegMesh.position = new BABYLON.Vector3(0.05, -torsoLength / 2 - legLength / 2, 0);
            this.rightUpperLegMesh.material = material;

            // Right Lower Leg bone and mesh
            this.rightLowerLegBone = new Bone("rightLowerLeg", this.babylonSkeleton, this.rightUpperLegBone, 
                Matrix.Translation(0, -legLength, 0));
            this.rightLowerLegMesh = MeshBuilder.CreateCylinder("rightLowerLegMesh", { 
                height: legLength, 
                diameter: limbDiameter 
            }, this.scene);
            this.rightLowerLegMesh.parent = this.rightUpperLegMesh;
            this.rightLowerLegMesh.position = new BABYLON.Vector3(0, -legLength, 0);
            this.rightLowerLegMesh.material = material;

            // Bind skeleton to meshes
            this.assignWeightsToMesh(this.torsoMesh, "torso");
            this.assignWeightsToMesh(this.headMesh, "head");
            this.assignWeightsToMesh(this.leftUpperArmMesh, "leftUpperArm");
            this.assignWeightsToMesh(this.leftLowerArmMesh, "leftLowerArm");
            this.assignWeightsToMesh(this.rightUpperArmMesh, "rightUpperArm");
            this.assignWeightsToMesh(this.rightLowerArmMesh, "rightLowerArm");
            this.assignWeightsToMesh(this.leftUpperLegMesh, "leftUpperLeg");
            this.assignWeightsToMesh(this.leftLowerLegMesh, "leftLowerLeg");
            this.assignWeightsToMesh(this.rightUpperLegMesh, "rightUpperLeg");
            this.assignWeightsToMesh(this.rightLowerLegMesh, "rightLowerLeg");

            // Physics aggregate directly on the model (approximated as a capsule)
            this.physicsAggregate = new BABYLON.PhysicsAggregate(
                this.model,
                BABYLON.PhysicsShapeType.CAPSULE,
                { mass: 1, restitution: 0.1, friction: 0.8 },
                this.scene
            );
            this.physicsBody = this.physicsAggregate.body;
            this.physicsBody.setLinearDamping(0.5);

            // Debug: Log physics body position after setup
            console.log("Skeleton setup - Physics body position (via model):", this.model.position.asArray());

            this.isLoaded = true;

            // Animation variables
            this.animationTime = 0;
            this.scene.onBeforeRenderObservable.add(() => this.update());
        } catch (error) {
            console.error("Failed to setup skeleton:", error);
            this.isLoaded = false;
        }
    }

    assignWeightsToMesh(mesh, boneName) {
        mesh.skeleton = this.babylonSkeleton;
        const vertexCount = mesh.getTotalVertices();
        const indices = new Array(vertexCount * 4).fill(0);
        const weights = new Array(vertexCount * 4).fill(0);
        const boneIndex = this.babylonSkeleton.getBoneIndexByName(boneName);

        for (let i = 0; i < vertexCount; i++) {
            indices[i * 4] = boneIndex;
            weights[i * 4] = 1.0;
        }

        mesh.setVerticesData(VertexBuffer.MatricesIndicesKind, indices);
        mesh.setVerticesData(VertexBuffer.MatricesWeightsKind, weights);
    }

    update() {
        if (!this.isLoaded || this.health <= 0) return;

        const dt = this.scene.getEngine().getDeltaTime() / 1000;

        // Debug: Log model position every frame
        console.log("Skeleton update - Model position:", this.model.position.asArray());
        console.log("Skeleton update - Torso mesh absolute position:", this.torsoMesh.getAbsolutePosition().asArray());

        // Walking animation
        const swingAmplitude = Math.PI / 6;
        const swingFrequency = 3;
        if (this.isWalking) {
            this.animationTime += dt * swingFrequency;
            const swing = Math.sin(this.animationTime) * swingAmplitude;

            this.leftUpperLegBone.setRotationMatrix(Matrix.RotationX(swing));
            this.leftLowerLegBone.setRotationMatrix(Matrix.RotationX(-Math.abs(swing) * 2));
            this.rightUpperLegBone.setRotationMatrix(Matrix.RotationX(-swing));
            this.rightLowerLegBone.setRotationMatrix(Matrix.RotationX(-Math.abs(swing) * 2));
            this.leftUpperArmBone.setRotationMatrix(Matrix.RotationZ(Math.PI / 2).multiply(Matrix.RotationX(-swing)));
            this.leftLowerArmBone.setRotationMatrix(Matrix.RotationX(Math.abs(swing)));
            this.rightUpperArmBone.setRotationMatrix(Matrix.RotationZ(-Math.PI / 2).multiply(Matrix.RotationX(swing)));
            this.rightLowerArmBone.setRotationMatrix(Matrix.RotationX(Math.abs(swing)));
        } else {
            this.leftUpperLegBone.setRotationMatrix(Matrix.Identity());
            this.leftLowerLegBone.setRotationMatrix(Matrix.Identity());
            this.rightUpperLegBone.setRotationMatrix(Matrix.Identity());
            this.rightLowerLegBone.setRotationMatrix(Matrix.Identity());
            this.leftUpperArmBone.setRotationMatrix(Matrix.RotationZ(Math.PI / 2));
            this.leftLowerArmBone.setRotationMatrix(Matrix.Identity());
            this.rightUpperArmBone.setRotationMatrix(Matrix.RotationZ(-Math.PI / 2));
            this.rightLowerArmBone.setRotationMatrix(Matrix.Identity());
        }

        // Check for fall
        if (this.model.position.y < this.game.yThreshold) {
            this.respawn();
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        console.log("Skeleton defeated!");
        this.model.isVisible = false;
        this.physicsBody.setLinearVelocity(BABYLON.Vector3.Zero());
        setTimeout(() => this.respawn(), 5000);
    }

    respawn() {
        this.health = 100;
        this.model.position.copyFrom(this.position);
        this.physicsBody.setLinearVelocity(BABYLON.Vector3.Zero());
        this.model.isVisible = true;
        this.model.rotationQuaternion = BABYLON.Quaternion.Identity();

        // Debug: Log position after respawn
        console.log("Skeleton respawn - Model position:", this.model.position.asArray());
    }

    applyImpulse(impulse, point) {
        if (this.isLoaded) {
            this.physicsBody.applyImpulse(impulse, point);
        }
    }

    getPosition() {
        return this.model.position.clone();
    }

    setWalking(isWalking) {
        this.isWalking = isWalking;
    }
}