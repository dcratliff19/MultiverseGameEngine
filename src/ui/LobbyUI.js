export class LobbyUI {
    constructor(peerManager) {
        this.peerManager = peerManager;
        this.lobby = document.getElementById("lobby");
    }

    hide() {
        this.lobby.style.display = "none";
    }
}