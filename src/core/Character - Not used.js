
class Character {
    constructor(mesh, scene, physicsPlugin, animationController) {
        this.mesh = mesh;
        this.scene = scene;
        this.animationController = animationController;
        this.yaw = Math.PI;
        this.walkSpeed = 5;
        this.runSpeed = 10;
        this.jumpForce = 4;
        this.isGrounded = true;
        this.isPunching = false;
        this.isJumping = false;  // Track jump state
        this.jumpDelay = 0.7;  // Delay in seconds before physics jump

        this.setupPhysics(physicsPlugin);
        this.setupRotation();
    }

    setupPhysics(physicsPlugin) {
        this.aggregate = new BABYLON.PhysicsAggregate(this.mesh, BABYLON.PhysicsShapeType.BOX, {
            mass: 1,
            restitution: 0.1,
            extents: new BABYLON.Vector3(1, 2, 1)
        }, this.scene);
        this.aggregate.body.setAngularVelocity(new BABYLON.Vector3(0, 0, 0));
        this.aggregate.body.disablePreStep = false;
    }

    setupRotation() {
        this.mesh.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(this.yaw, 0, 0);
    }

    updateRotation(deltaX) {
        this.yaw += deltaX * 0.005;
        this.mesh.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(this.yaw, 0, 0);
        this.aggregate.body.transformNode.rotationQuaternion = this.mesh.rotationQuaternion;
    }

    checkGround() {
        const rayOrigin = this.mesh.position.clone();
        rayOrigin.y += 0.1;
        const ray = new BABYLON.Ray(rayOrigin, new BABYLON.Vector3(0, -1, 0), 2.2);
        const hit = this.scene.pickWithRay(ray);
        const velocity = this.aggregate.body.getLinearVelocity();
        return hit.hit && hit.pickedMesh.name === "ground" && Math.abs(velocity.y) < 0.1;
    }

    move(direction, speed) {
        const velocity = this.aggregate.body.getLinearVelocity();
        velocity.x = direction.x * speed;
        velocity.z = direction.z * speed;
        this.aggregate.body.setLinearVelocity(velocity);
    }

    jump() {
        if (this.isGrounded && !this.isPunching && !this.isJumping) {
            this.isJumping = true;
            this.animationController.playAnimation("jump");
            // Delay physics jump to sync with animation
            setTimeout(() => {
                if (this.isJumping) {
                    const velocity = this.aggregate.body.getLinearVelocity();
                    velocity.y = this.jumpForce;
                    this.aggregate.body.setLinearVelocity(velocity);
                    this.isGrounded = false;
                }
            }, this.jumpDelay * 1000);  // Convert to milliseconds
        }
    }
}