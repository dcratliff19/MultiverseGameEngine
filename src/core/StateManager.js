export class StateManager {
    constructor(game) {
        this.game = game;
        this.eventLog = [];
        this.startTime = Date.now();
        window.addEventListener("beforeunload", () => this.save());
    }

    logEvent(type, data) {
        this.eventLog.push({
            type,
            data: { ...data },
            timestamp: Date.now() - this.startTime
        });
    }

    save() {
        const state = this.game.getState();
        localStorage.setItem("gameState", JSON.stringify(state));
        localStorage.setItem("eventLog", JSON.stringify(this.eventLog));
    }

    load() {
        const savedState = localStorage.getItem("gameState");
        if (!savedState) return;

        const state = JSON.parse(savedState);
        this.game.player.mesh.position.set(...state.player.position);
        this.game.player.physicsBody.setLinearVelocity(new BABYLON.Vector3(...state.player.velocity));

        state.objects.forEach((obj) => {
            let mesh = this.game.scene.getMeshByName(obj.name);
            if (!mesh) {
                mesh = new BABYLON.PhysicsObject(obj.name, this.game.scene, this.game.physicsPlugin);
            }
            mesh.mesh.position.set(...obj.position);
            mesh.physicsBody.setLinearVelocity(new BABYLON.Vector3(...obj.velocity));
        });
    }
}