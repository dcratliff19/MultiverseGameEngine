export class PhysicsObject {
    constructor(name, scene, physicsPlugin, options = {}) {
        this.mesh = BABYLON.MeshBuilder.CreateCapsule(name, {
            height: 2,
            radius: 0.5,
            tessellation: 16
        }, scene);
        this.mesh.position = options.position || new BABYLON.Vector3(0, 1, 0); // Adjust for capsule base
        this.physicsAggregate = new BABYLON.PhysicsAggregate(
            this.mesh,
            BABYLON.PhysicsShapeType.CAPSULE,
            { mass: options.mass || 1, restitution: 0.5, friction: 0.9 },
            scene
        );
        this.physicsBody = this.physicsAggregate.body;
        this.physicsBody.setLinearDamping(0.3); // Reduced for natural physics
    }

    applyImpulse(impulse, point) {
        this.physicsBody.applyImpulse(impulse, point);
    }
}