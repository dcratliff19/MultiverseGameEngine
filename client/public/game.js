const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);
const socket = io('http://localhost:3000');

// UI elements
const xpDisplay = document.getElementById('xp');
const skillsDisplay = document.getElementById('skills');
const weaponDisplay = document.getElementById('weapon');
const ammoDisplay = document.getElementById('ammo');
const staminaDisplay = document.getElementById('stamina');
const healthDisplay = document.getElementById('health');

function createScene() {
    const scene = new BABYLON.Scene(engine);

    // Camera
    const camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);
    camera.keysLeft = [];
    camera.keysRight = [];
    camera.keysUp = [];
    camera.keysDown = [];

    // Lighting
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    // Ground
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 10, height: 10 }, scene);

    // Players and enemies
    const players = {};
    const enemies = {};

    // Create local player
    const mySphere = BABYLON.MeshBuilder.CreateSphere("mySphere", { diameter: 1 }, scene);
    mySphere.position.y = 0.5;
    const myMaterial = new BABYLON.StandardMaterial("myMaterial", scene);
    myMaterial.diffuseColor = BABYLON.Color3.Random();
    mySphere.material = myMaterial;

    // Socket event handlers
    socket.on('connect', () => {
        console.log('Connected as:', socket.id);
        socket.emit('setColor', { color: myMaterial.diffuseColor.toHexString() });
    });

    socket.on('existingPlayers', (playerIds) => {
        playerIds.forEach(id => {
            if (id !== socket.id && !players[id]) {
                const sphere = BABYLON.MeshBuilder.CreateSphere(`sphere_${id}`, { diameter: 1 }, scene);
                sphere.position.y = 0.5;
                players[id] = sphere;
            }
        });
    });

    socket.on('playerJoined', (data) => {
        if (!players[data.id]) {
            const sphere = BABYLON.MeshBuilder.CreateSphere(`sphere_${data.id}`, { diameter: 1 }, scene);
            sphere.position.y = 0.5;
            players[data.id] = sphere;
        }
    });

    socket.on('playerColor', (data) => {
        const sphere = players[data.id];
        if (sphere) {
            const material = new BABYLON.StandardMaterial(`mat_${data.id}`, scene);
            material.diffuseColor = BABYLON.Color3.FromHexString(data.color);
            sphere.material = material;
        }
    });

    socket.on('playerLeft', (data) => {
        if (players[data.id]) {
            players[data.id].dispose();
            delete players[data.id];
        }
    });

    socket.on('physicsUpdate', (data) => {
        // Update local player
        if (data.players[socket.id]) {
            mySphere.position.x = data.players[socket.id].x;
            mySphere.position.z = data.players[socket.id].z;
        }
        // Update other players
        for (let id in data.players) {
            if (id !== socket.id && players[id]) {
                players[id].position.x = data.players[id].x;
                players[id].position.z = data.players[id].z;
            }
        }
        // Update enemies
        for (let id in data.enemies) {
            if (!enemies[id]) {
                const enemy = BABYLON.MeshBuilder.CreateBox(`enemy_${id}`, { size: 1 }, scene);
                enemy.position.y = 1;
                const mat = new BABYLON.StandardMaterial(`emat_${id}`, scene);
                mat.diffuseColor = BABYLON.Color3.Red();
                enemy.material = mat;
                enemies[id] = enemy;
            }
            enemies[id].position.x = data.enemies[id].x;
            enemies[id].position.z = data.enemies[id].z;
        }
    });

    socket.on('combatUpdate', (data) => {
        if (data.result.killed && enemies[data.targetId]) {
            enemies[data.targetId].dispose();
            delete enemies[data.targetId];
        }
    });

    socket.on('skillUnlocked', (data) => {
        skillsDisplay.textContent = data.skills.join(', ') || '-';
        xpDisplay.textContent = xpSystemGet(socket.id); // Simulate client-side XP fetch
    });

    socket.on('weaponUpdated', (data) => {
        weaponDisplay.textContent = data.weapon;
    });

    // Simulate server-side state fetching (for testing)
    function xpSystemGet(playerId) {
        return socket.id === playerId ? parseInt(xpDisplay.textContent) : 0; // Placeholder
    }

    // Input handling
    const keys = {};
    scene.onKeyboardObservable.add((kbInfo) => {
        const { type, event } = kbInfo;
        keys[event.key] = type === BABYLON.KeyboardEventTypes.KEYDOWN;

        if (type === BABYLON.KeyboardEventTypes.KEYDOWN) {
            switch (event.key) {
                case ' ':
                    console.log('Attacking with:', weaponDisplay.textContent);
                    socket.emit('attack', { targetId: 'enemy1', weaponType: weaponDisplay.textContent });
                    break;
                case 'q':
                    socket.emit('switchWeapon', 'melee');
                    break;
                case 'e':
                    socket.emit('switchWeapon', 'knife');
                    break;
                case '1':
                    socket.emit('unlockSkill', 'speed');
                    break;
                case '2':
                    socket.emit('unlockSkill', 'strength');
                    break;
                case '3':
                    socket.emit('unlockSkill', 'agility');
                    break;
            }
        }
    });

    // Movement
    scene.onBeforeRenderObservable.add(() => {
        const move = { x: 0, z: 0 };
        if (keys['ArrowLeft']) move.x = -1;
        if (keys['ArrowRight']) move.x = 1;
        if (keys['ArrowUp']) move.z = 1;
        if (keys['ArrowDown']) move.z = -1;
        if (move.x || move.z) {
            socket.emit('move', move);
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