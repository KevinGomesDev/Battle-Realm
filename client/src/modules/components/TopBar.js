import Phaser from "phaser";

export class TopBar {
  constructor(scene) {
    this.scene = scene;
    this.width = scene.scale.width;
    this.height = 80;

    this.container = scene.add.container(0, 0);
    this.resourceTexts = {};
    this.infoGroup = null;

    this.createBackground();
    this.createResourcesArea();
    this.createInfoArea();
  }

  // ... (Mantenha createBackground e createResourcesArea iguais) ...

  createBackground() {
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x111111, 1);
    bg.fillRect(0, 0, this.width, this.height);
    bg.lineStyle(2, 0x444444, 1);
    bg.beginPath();
    bg.moveTo(0, this.height);
    bg.lineTo(this.width, this.height);
    bg.strokePath();
    this.container.add(bg);
  }

  createResourcesArea() {
    const resources = [
      { key: "gold", icon: "🟡", label: "Ouro", value: 1000 },
      { key: "wood", icon: "🌲", label: "Madeira", value: 500 },
      { key: "food", icon: "🍎", label: "Comida", value: 800 },
      { key: "pop", icon: "👥", label: "Súditos", value: 25 },
    ];

    let startX = 30;
    const gap = 120;

    resources.forEach((res, index) => {
      const xPos = startX + index * gap;
      const yPos = this.height / 2;

      const textObj = this.scene.add
        .text(xPos, yPos, `${res.icon} ${res.value}`, {
          fontFamily: "Arial",
          fontSize: "18px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);

      this.resourceTexts[res.key] = textObj;
      this.container.add(textObj);
    });
  }

  createInfoArea() {
    const rightMargin = this.width - 30;
    const centerY = this.height / 2;

    this.infoTitle = this.scene.add
      .text(rightMargin, centerY - 10, "Mundo Aberto", {
        fontFamily: "Arial",
        fontSize: "20px",
        color: "#e0e0e0",
        fontStyle: "bold",
      })
      .setOrigin(1, 0.5);

    this.infoSubtitle = this.scene.add
      .text(rightMargin, centerY + 15, "Selecione um local", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#888888",
      })
      .setOrigin(1, 0.5);

    this.container.add([this.infoTitle, this.infoSubtitle]);
  }

  updateTerritoryInfo(data) {
    if (!data) {
      this.infoTitle.setText("Mundo Aberto");
      this.infoTitle.setColor("#e0e0e0");
      this.infoSubtitle.setText("Nenhum território selecionado");
      return;
    }
    // ... Lógica existente ...
    if (data.type === "LAND") {
      this.infoTitle.setText(`Território #${data.id} - ${data.terrain.name}`);
      this.infoTitle.setColor("#ffffff");
      const owner =
        data.ownership !== null ? `Jogador ${data.ownership}` : "Neutro";
      const size = data.size || "Padrão";
      this.infoSubtitle.setText(`${size} • ${owner}`);
    } else {
      this.infoTitle.setText("Águas Internacionais");
      this.infoTitle.setColor("#4da6ff");
      this.infoSubtitle.setText("Zona não habitável");
    }
  }

  updateResource(key, newValue) {
    if (this.resourceTexts[key]) {
      const currentText = this.resourceTexts[key].text;
      const icon = currentText.split(" ")[0];
      this.resourceTexts[key].setText(`${icon} ${newValue}`);
    }
  }

  // --- NOVO MÉTODO ---
  setCombatState(isActive, territoryName = "", color = 0xffffff) {
    if (isActive) {
      this.infoTitle.setText(`⚔️ COMBATE: ${territoryName.toUpperCase()}`);
      // Converte cor int (0xff0000) para string hex css ('#ff0000')
      const hexString = "#" + color.toString(16).padStart(6, "0");
      this.infoTitle.setColor(hexString);

      this.infoSubtitle.setText("Modo Tático Ativado");
      this.infoSubtitle.setColor("#ffaa00"); // Laranja alerta
    } else {
      // Restaura estado padrão
      this.updateTerritoryInfo(null);
      this.infoSubtitle.setColor("#888888");
    }
  }
}
