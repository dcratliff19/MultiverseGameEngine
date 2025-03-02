export class PhysicsObject {
    constructor(name, scene, physicsPlugin, options = {}) {
        this.mesh = BABYLON.MeshBuilder.CreateSphere(name, { diameter: 1 }, scene);
        this.mesh.position = options.position || new BABYLON.Vector3(0, 0.5, 0); // Use provided position or default
        this.physicsAggregate = new BABYLON.PhysicsAggregate(
            this.mesh,
            BABYLON.PhysicsShapeType.SPHERE,
            { mass: options.mass || 1, restitution: 0.5, friction: 0.9 },
            scene
        );
        this.physicsBody = this.physicsAggregate.body;
        this.physicsBody.setLinearDamping(10);
    }

    applyImpulse(impulse, point) {
        this.physicsBody.applyImpulse(impulse, point);
    }

    setKinematic(isKinematic) {
        if (isKinematic) {
            this.physicsBody.setMassProperties({ mass: 0 });
            this.physicsBody.setMotionType(BABYLON.PhysicsMotionType.STATIC);
        } else {
            this.physicsBody.setMassProperties({ mass: 1 });
            this.physicsBody.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC);
        }
    }
}