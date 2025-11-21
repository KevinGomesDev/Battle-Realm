import Phaser from "phaser";
import { TopBar } from "../modules/components/TopBar";
export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: "UIScene" });
    this.topBar = null;
  }

  create() {
    this.topBar = new TopBar(this);
  }

  updateInfo(data) {
    if (this.topBar) {
      this.topBar.updateTerritoryInfo(data);
    }
  }

  // --- NOVO MÉTODO ---
  setCombatMode(isActive, data) {
    if (this.topBar) {
      if (isActive && data) {
        this.topBar.setCombatState(true, data.terrain.name, data.terrain.color);
      } else {
        this.topBar.setCombatState(false);
      }
    }
  }
}
