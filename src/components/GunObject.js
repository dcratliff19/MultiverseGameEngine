export class GunObject {
    constructor(scene, modelPath, options = {}) {
        this.scene = scene;
        this.modelPath = modelPath;
        this.mesh = null;

        // Configurable options with defaults
        this.fireRate = options.fireRate || 0.2;
        this.bulletSpeed = options.bulletSpeed || 300;
        this.bulletRange = options.bulletRange || 100;
        this.scaling = options.scaling || new BABYLON.Vector3(1.5, 1.5, 1.5);
        this.firstPersonPosition = options.firstPersonPosition || new BABYLON.Vector3(0.6, -0.3, 1.5);
        this.thirdPersonPosition = options.thirdPersonPosition || new BABYLON.Vector3(1.5, 1.5, 0);
        this.recoilAmount = options.recoilAmount || 0.05;

        // Ammo and clip settings
        this.clipSize = options.clipSize || 7; // Default for a Desert Eagle
        this.currentClip = this.clipSize; // Rounds currently in clip
        this.totalAmmo = options.totalAmmo || 21; // Total reserve ammo (e.g., 3 clips worth)
        this.reloadTime = options.reloadTime || 2; // Seconds to reload

        this.lastShotTime = 0;
        this.isFirstPerson = true;
        this.isLoaded = false;
        this.isReloading = false;
    }

    async load() {
        try {
            console.log(`Loading gun model from ${this.modelPath}...`);
            const result = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/", this.modelPath, this.scene);
            this.mesh = result.meshes[0];
            this.mesh.scaling = this.scaling;
            this.mesh.rotationQuaternion = new BABYLON.Quaternion();
            this.isLoaded = true;
            console.log(`Gun ${this.modelPath} loaded successfully`);
        } catch (error) {
            console.error(`Failed to load gun ${this.modelPath}:`, error);
            this.isLoaded = false;
        }
    }

    updateParenting(cameraOrMesh) {
        if (!this.mesh || !this.isLoaded) return;
        this.mesh.parent = cameraOrMesh;
        this.mesh.position = this.isFirstPerson ? this.firstPersonPosition : this.thirdPersonPosition;
        this.mesh.rotation = new BABYLON.Vector3(0, 0, 0); // No rotation for testing
        //console.log("Gun forward direction:", this.mesh.getDirection(BABYLON.Vector3.Forward()).asArray());
    }

    canShoot() {
        const now = Date.now() / 1000;
        return this.isLoaded && !this.isReloading && this.currentClip > 0 && (now - this.lastShotTime >= this.fireRate);
    }

    shoot(origin, direction, peerManager = null) {
        if (!this.canShoot()) return null;

        this.lastShotTime = Date.now() / 1000;
        this.currentClip -= 1;
        console.log(`Fired! Clip: ${this.currentClip}/${this.clipSize}, Total Ammo: ${this.totalAmmo}`);

        const bullet = BABYLON.MeshBuilder.CreateBox("bullet", { size: 0.1 }, this.scene);
        bullet.position = origin.clone();
        bullet.material = new BABYLON.StandardMaterial("bulletMat", this.scene);
        bullet.material.diffuseColor = new BABYLON.Color3(1, 0, 0);

        const travelTime = this.bulletRange / this.bulletSpeed;
        const endPosition = origin.add(direction.scale(this.bulletRange));
        BABYLON.Animation.CreateAndStartAnimation(
            "bulletMove",
            bullet,
            "position",
            60,
            travelTime * 60,
            bullet.position,
            endPosition,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
            null,
            () => bullet.dispose()
        );

        const ray = new BABYLON.Ray(origin, direction, this.bulletRange);
        const hit = this.scene.pickWithRay(ray);
        let hitInfo = null;
        if (hit && hit.hit) {
            hitInfo = { pickedMesh: hit.pickedMesh, pickedPoint: hit.pickedPoint, normal: hit.normal, ray };
        }

        if (peerManager && peerManager.isMultiplayer) {
            peerManager.sendDataToPeers({
                streamType: "shoot",
                payload: {
                    id: peerManager.peer.id,
                    origin: origin.asArray(),
                    direction: direction.asArray(),
                    timestamp: this.lastShotTime
                }
            });
        }

        return hitInfo;
    }

    async reload() {
        if (this.isReloading || this.currentClip === this.clipSize || this.totalAmmo <= 0) return;

        this.isReloading = true;
        console.log("Reloading...");

        // Simple reload animation (tilt gun down and back)
        const startPos = this.mesh.position.clone();
        const reloadAnim = new BABYLON.Animation(
            "reload",
            "rotation.x",
            60,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        reloadAnim.setKeys([
            { frame: 0, value: 0 },
            { frame: 30, value: -Math.PI / 6 }, // Tilt down
            { frame: 60, value: 0 } // Return to original
        ]);
        this.scene.beginDirectAnimation(this.mesh, [reloadAnim], 0, 60, false, this.reloadTime * 60 / 60);

        // Wait for reload time
        await new Promise(resolve => setTimeout(resolve, this.reloadTime * 1000));

        const ammoNeeded = this.clipSize - this.currentClip;
        const ammoToTake = Math.min(ammoNeeded, this.totalAmmo);
        this.currentClip += ammoToTake;
        this.totalAmmo -= ammoToTake;
        this.isReloading = false;
        this.mesh.position = startPos; // Ensure position resets
        console.log(`Reloaded! Clip: ${this.currentClip}/${this.clipSize}, Total Ammo: ${this.totalAmmo}`);
    }

    applyRecoil(camera) {
        if (this.isFirstPerson && this.isLoaded && !this.isReloading) {
            camera.rotation.x -= this.recoilAmount;
            setTimeout(() => camera.rotation.x += this.recoilAmount * 0.6, 100);
        }
    }

    setFirstPerson(isFirstPerson) {
        this.isFirstPerson = isFirstPerson;
    }
}