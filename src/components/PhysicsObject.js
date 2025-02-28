export class PhysicsObject {
    constructor(name, scene, physicsPlugin, options = {}) {
        this.mesh = BABYLON.MeshBuilder.CreateSphere(name, { diameter: 1 }, scene);
        this.mesh.position = options.position || new BABYLON.Vector3(0, 0.5, 0);
        this.physicsAggregate = new BABYLON.PhysicsAggregate(
            this.mesh,
            BABYLON.PhysicsShapeType.SPHERE,
            { mass: options.mass || 1, restitution: 0.5, friction: 0.9 }, // Increased friction
            scene
        );
        this.physicsBody = this.physicsAggregate.body;
        this.physicsBody.setLinearDamping(10); // Add damping to slow down faster
    }

    applyImpulse(impulse, point) {
        this.physicsBody.applyImpulse(impulse, point);
    }
}