const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);
const socket = io();

function createScene() {
    const scene = new BABYLON.Scene(engine);

    const camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);
    camera.keysLeft = [];
    camera.keysRight = [];
    camera.keysUp = [];
    camera.keysDown = [];

    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 10, height: 10 }, scene);

    // Function to generate random color
    function getRandomColor() {
        return new BABYLON.Color3(Math.random(), Math.random(), Math.random());
    }

    // Local player’s sphere with random color
    const mySphere = BABYLON.MeshBuilder.CreateSphere("mySphere", { diameter: 1 }, scene);
    mySphere.position.y = 0.5;
    const myMaterial = new BABYLON.StandardMaterial("myMaterial", scene);
    myMaterial.diffuseColor = getRandomColor();
    mySphere.material = myMaterial;

    // Store other players’ spheres
    const otherPlayers = {};

    // Socket.IO event listeners
    socket.on('connect', () => {
        console.log('Connected to server with ID:', socket.id);
        // Send my color to others
        socket.emit('setColor', { id: socket.id, color: myMaterial.diffuseColor.toHexString() });
    });

    socket.on('existingPlayers', (playerList) => {
        console.log('Existing players:', playerList);
        playerList.forEach((player) => {
            const otherSphere = BABYLON.MeshBuilder.CreateSphere(`sphere_${player.id}`, { diameter: 1 }, scene);
            otherSphere.position.y = 0.5;
            otherPlayers[player.id] = otherSphere;
            // Request color from server (we’ll handle this next)
        });
    });

    socket.on('playerJoined', (data) => {
        console.log('Player joined:', data.id);
        const otherSphere = BABYLON.MeshBuilder.CreateSphere(`sphere_${data.id}`, { diameter: 1 }, scene);
        otherSphere.position.y = 0.5;
        otherPlayers[data.id] = otherSphere;
    });

    socket.on('message', (data) => {
        console.log('Received position update:', data);
        const playerSphere = otherPlayers[data.id];
        if (playerSphere) {
            playerSphere.position.x = data.x;
            playerSphere.position.z = data.z;
        }
    });

    socket.on('playerLeft', (data) => {
        console.log('Player left:', data.id);
        const playerSphere = otherPlayers[data.id];
        if (playerSphere) {
            playerSphere.dispose();
            delete otherPlayers[data.id];
        }
    });

    socket.on('playerColor', (data) => {
        const playerSphere = otherPlayers[data.id];
        if (playerSphere) {
            const material = new BABYLON.StandardMaterial(`mat_${data.id}`, scene);
            material.diffuseColor = BABYLON.Color3.FromHexString(data.color);
            playerSphere.material = material;
        }
    });

    // Handle local sphere movement
    scene.onKeyboardObservable.add((kbInfo) => {
        if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
            let moved = false;
            switch (kbInfo.event.key) {
                case "ArrowLeft":
                    mySphere.position.x -= 0.1;
                    moved = true;
                    break;
                case "ArrowRight":
                    mySphere.position.x += 0.1;
                    moved = true;
                    break;
                case "ArrowUp":
                    mySphere.position.z += 0.1;
                    moved = true;
                    break;
                case "ArrowDown":
                    mySphere.position.z -= 0.1;
                    moved = true;
                    break;
            }
            if (moved) {
                socket.emit('message', { 
                    id: socket.id, 
                    x: mySphere.position.x, 
                    z: mySphere.position.z 
                });
            }
        }
    });

    return scene;
}

const scene = createScene();
engine.runRenderLoop(() => {
    scene.render();
});

window.addEventListener("resize", () => {
    engine.resize();
});