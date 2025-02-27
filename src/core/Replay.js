import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export class Replay {
    constructor(game) {
        this.game = game;
    }

    start() {
        const savedLog = JSON.parse(localStorage.getItem("eventLog") || "[]");
        this.game.scene.onBeforeRenderObservable.clear();
        let replayTime = 0;

        this.game.scene.onBeforeRenderObservable.add(() => {
            replayTime += this.game.engine.getDeltaTime();
            while (savedLog.length > 0 && savedLog[0].timestamp <= replayTime) {
                const event = savedLog.shift();
                if (event.type === "impulse") {
                    this.game.player.applyImpulse(new Vector3(...event.data.impulse), new Vector3(...event.data.position));
                } else if (event.type === "fullState") {
                    this.applyFullState(event.data);
                }
            }
        });
    }

    applyFullState(state) {
        this.game.player.mesh.position.set(...state.player.position);
        this.game.player.physicsBody.setLinearVelocity(new Vector3(...state.player.velocity));
        state.objects.forEach((obj) => {
            let mesh = this.game.scene.getMeshByName(obj.name) || new PhysicsObject(obj.name, this.game.scene, this.game.physicsPlugin);
            mesh.mesh.position.set(...obj.position);
            mesh.physicsBody.setLinearVelocity(new Vector3(...obj.velocity));
        });
    }
}