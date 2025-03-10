export class Character {
    constructor(mesh, scene, physicsPlugin, animationController) {
        this.mesh = mesh;
        this.scene = scene;
        this.animationController = animationController;
        this.yaw = Math.PI;
        this.walkSpeed = 5;
        this.runSpeed = 10;
        this.jumpForce = 6;
        this.isGrounded = false; // Start false until checked
        this.isPunching = false;
        this.isJumping = false;

        this.setupPhysics(physicsPlugin);
        this.setupRotation();
    }

    setupPhysics(physicsPlugin) {
        const boundingInfo = this.mesh.getBoundingInfo();
        const height = boundingInfo.boundingBox.maximum.y - boundingInfo.boundingBox.minimum.y;
        const width = boundingInfo.boundingBox.maximum.x - boundingInfo.boundingBox.minimum.x;
        const depth = boundingInfo.boundingBox.maximum.z - boundingInfo.boundingBox.minimum.z;
        const radius = Math.max(width, depth) / 2;

        this.aggregate = new BABYLON.PhysicsAggregate(this.mesh, BABYLON.PhysicsShapeType.CAPSULE, {
            mass: 1,
            restitution: 0.1,
            friction: 0.5,
            radius: radius,
            height: height
        }, this.scene);

        this.aggregate.body.setAngularVelocity(new BABYLON.Vector3(0, 0, 0));
        this.aggregate.body.setLinearDamping(0.8);
        this.aggregate.body.setAngularDamping(0.99);
        this.aggregate.body.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC); // Force dynamic from start
    }

    setupRotation() {
        this.mesh.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(this.yaw, 0, 0);
        this.aggregate.body.transformNode.rotationQuaternion = this.mesh.rotationQuaternion;
    }

    updateRotation(deltaX) {
        this.yaw += deltaX * 0.005;
        const desiredRotation = BABYLON.Quaternion.RotationYawPitchRoll(this.yaw, 0, 0);
        this.mesh.rotationQuaternion = desiredRotation;
        this.aggregate.body.transformNode.rotationQuaternion = desiredRotation;
        this.aggregate.body.setAngularVelocity(new BABYLON.Vector3(0, 0, 0));
    }

    checkGround() {
        const boundingInfo = this.mesh.getBoundingInfo();
        const height = boundingInfo.boundingBox.maximum.y - boundingInfo.boundingBox.minimum.y;
        const rayOrigin = this.mesh.position.clone();
        rayOrigin.y -= (height / 2); // Start at capsule bottom
        const ray = new BABYLON.Ray(rayOrigin, new BABYLON.Vector3(0, -1, 0), height / 2); // Ray length half height
        const hit = this.scene.pickWithRay(ray, (mesh) => mesh === this.scene.getMeshByName("ground"));
        const velocity = this.aggregate.body.getLinearVelocity();
        console.log("Ray origin:", rayOrigin.y, "Ray hit:", hit ? hit.hit : "no hit", "Distance:", hit?.distance);
        return hit && hit.hit && Math.abs(velocity.y) < 0.2;
    }

    move(direction, speed) {
        const velocity = this.aggregate.body.getLinearVelocity();
        const newVelocity = new BABYLON.Vector3(direction.x * speed, velocity.y, direction.z * speed);
        const maxSpeed = speed;
        if (newVelocity.length() > maxSpeed) {
            newVelocity.normalize().scaleInPlace(maxSpeed);
        }
        this.aggregate.body.setLinearVelocity(newVelocity);
    }

    jump() {
        if (this.isGrounded && !this.isPunching && !this.isJumping) {
            this.isJumping = true;
            this.animationController.playAnimation("jump");
            const velocity = this.aggregate.body.getLinearVelocity();
            velocity.y = 6;
            this.aggregate.body.setLinearVelocity(velocity);
            this.isGrounded = false;
        }
    }
}