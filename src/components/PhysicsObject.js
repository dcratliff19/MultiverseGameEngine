import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export class PhysicsObject {
    constructor(name, scene, physicsPlugin, options = {}) {
        this.mesh = MeshBuilder.CreateSphere(name, { diameter: 1 }, scene);
        this.mesh.position = options.position || new Vector3(0, 5, 0);
        this.physicsBody = physicsPlugin.addPhysicsBody(this.mesh, { mass: options.mass || 1, restitution: 0.5 });
    }

    applyImpulse(impulse, point) {
        this.physicsBody.applyImpulse(impulse, point);
    }
}