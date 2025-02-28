export class PhysicsObject {
    constructor(name, scene, physicsPlugin, options = {}) {
        this.mesh = BABYLON.MeshBuilder.CreateSphere(name, { diameter: 1 }, scene);
        this.mesh.position = options.position || new BABYLON.Vector3(0, 5, 0);
        
        // Use PhysicsAggregate instead of addPhysicsBody
        this.physicsAggregate = new BABYLON.PhysicsAggregate(
            this.mesh,
            BABYLON.PhysicsShapeType.SPHERE,
            { mass: options.mass || 1, restitution: 0.5 },
            scene
        );
        this.physicsBody = this.physicsAggregate.body; // Access the physics body
    }

    applyImpulse(impulse, point) {
        this.physicsBody.applyImpulse(impulse, point);
    }
}