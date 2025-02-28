export class EventStreamManager {
    constructor(peerManager) {
        this.peerManager = peerManager;
    }

    handleIncomingData(payload) {
        console.log("Received event:", payload);
        // Process event based on payload
        // Example: Trigger a game action like shooting
        // if (payload.type === "shoot") {
        //     // Handle shooting logic here (e.g., apply damage in game)
        //     this.peerManager.game.scene.triggerEvent(payload); // Hypothetical method
        // }
    }

    sendEvent(data) {
        const packet = { streamType: "event", payload: data };
        this.peerManager.sendDataToPeers(packet);
    }
}