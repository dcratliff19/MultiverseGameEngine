import { Game } from "./core/Game";
import { PeerManager } from "./networking/PeerManager";
import { LobbyUI } from "./ui/LobbyUI";
import { Replay } from "./core/Replay";
import "./style.css";

const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

const game = new Game(engine, canvas);
const peerManager = new PeerManager(game);
game.setPeerManager(peerManager);
const lobbyUI = new LobbyUI(peerManager);
const replay = new Replay(game);

// Function to hide lobby and show HUD
function showGameUI() {
    console.log("Hiding lobby...");
    lobbyUI.hide();
    const lobby = document.getElementById("lobby");
    if (lobby && lobby.style.display !== "none") {
        lobby.style.display = "none"; // Force hide if not already hidden
        console.log("Lobby forced hidden via style");
    }
    console.log("Showing HUD...");
    document.getElementById("hud").style.display = "block";
}

// Expose functions to window for HTML buttons
window.startSinglePlayer = () => {
    console.log("Starting single player...");
    showGameUI();
    game.startSinglePlayer();
};

window.startMultiplayerAsHost = (myId) => {
    console.log("Starting as host with ID:", myId);
    peerManager.startAsHost(myId).then(() => {
        showGameUI();
    }).catch((error) => {
        console.error("Failed to start as host:", error);
    });
};

window.joinMultiplayer = (peerId) => {
    console.log("Joining peer:", peerId);
    peerManager.join(peerId).then(() => {
        showGameUI();
    }).catch((error) => {
        console.error("Failed to join multiplayer:", error);
    });
};

window.startReplay = () => {
    console.log("Starting replay...");
    showGameUI();
    replay.start();
};

// Handle resize
window.addEventListener("resize", () => engine.resize());