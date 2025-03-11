export class Inventory {
    constructor() {
        this.primary = null;
        this.secondary = null;
        this.activeGun = null; // Tracks currently equipped gun
    }

    addGun(gun, slot = "primary") {
        if (slot === "primary") {
            this.primary = gun;
            if (!this.activeGun) this.activeGun = this.primary;
        } else if (slot === "secondary") {
            this.secondary = gun;
            if (!this.activeGun) this.activeGun = this.secondary;
        }
    }

    switchGun() {
        if (this.primary && this.secondary) {
            this.activeGun = this.activeGun === this.primary ? this.secondary : this.primary;
        }
    }

    getActiveGun() {
        return this.activeGun;
    }
}