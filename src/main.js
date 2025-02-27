import { Engine } from "@babylonjs/core/Engines/engine";
import { Game } from "./core/Game";
import { PeerManager } from "./networking/PeerManager";
import { LobbyUI } from "./ui/LobbyUI";
import { Replay } from "./core/Replay";
import "./style.css";

const canvas = document.getElementById("renderCanvas");
const engine = new Engine(canvas, true);

const game = new Game(engine, canvas);
const peerManager = new PeerManager(game);
const lobbyUI = new LobbyUI(peerManager);
const replay = new Replay(game);

// Expose functions to window for HTML buttons
window.startSinglePlayer = () => {
    lobbyUI.hide();
    game.startSinglePlayer();
};
window.startMultiplayerAsHost = () => peerManager.startAsHost();
window.joinMultiplayer = (peerId) => peerManager.join(peerId);
window.startReplay = () => {
    lobbyUI.hide();
    replay.start();
};

// Handle resize
window.addEventListener("resize", () => engine.resize());