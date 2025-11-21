import Phaser from "phaser";
import { InteractiveHexagon } from "./components/InteractiveHexagon";
import { GridCalculator } from "../utils/GridCalculator";

export class CombatModal {
  constructor(scene) {
    this.scene = scene;
    this.hexagons = [];
    this.selectedHexId = -1;

    this.isDragging = false;
    this.isHexClick = false; // Flag de controle vital
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.lastPointerPosition = null;

    this.currentScale = 1;
    this.minScale = 0.1;
    this.maxScale = 3.0;

    this.createBackdrop();

    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(31).setVisible(false);

    this.titleText = this.scene.add
      .text(this.scene.scale.width / 2, 40, "MODO COMBATE", {
        fontSize: "32px",
        color: "#ffffff",
        fontStyle: "bold",
        backgroundColor: "#000000",
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5)
      .setDepth(32)
      .setVisible(false);

    this.setupInput();
  }

  setupInput() {
    // --- POINTER DOWN ---
    this.scene.input.on("pointerdown", (pointer) => {
      if (!this.container.visible) return;

      // REMOVIDO: this.isHexClick = false;
      // MOTIVO: Se clicamos num hexágono, a flag já virou true milissegundos atrás.
      // Se resetarmos aqui, perdemos essa informação.
      // A flag só será resetada no pointerUP após ser usada.

      // Lógica de Drag
      const objects = this.scene.input.hitTestPointer(pointer);

      // Se clicou no backdrop (e ele é o primeiro), paramos drag anterior
      if (objects.length > 0 && objects[0] === this.backdrop) {
        this.isDragging = false;
      } else {
        this.isDragging = false;
      }

      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
      this.lastPointerPosition = { x: pointer.x, y: pointer.y };
    });

    // --- POINTER UP ---
    this.scene.input.on("pointerup", (pointer) => {
      if (!this.container.visible) return;

      // 1. Checagem de Prioridade: Foi clique em Hexágono?
      if (this.isHexClick) {
        this.isHexClick = false; // Consome a flag e reseta
        this.isDragging = false;
        return; // ABORTA: Não fecha o modal!
      }

      const dist = Phaser.Math.Distance.Between(
        pointer.x,
        pointer.y,
        this.dragStartX,
        this.dragStartY
      );

      // 2. Checagem de Fechamento: Foi clique no Backdrop?
      if (dist < 5 && !this.isDragging) {
        const objects = this.scene.input.hitTestPointer(pointer);

        // Só fecha se o objeto clicado for explicitamente o backdrop
        if (objects.length > 0 && objects[0] === this.backdrop) {
          this.close();
        }
      }

      this.isDragging = false;
    });

    // --- POINTER MOVE ---
    this.scene.input.on("pointermove", (pointer) => {
      if (!this.container.visible || !pointer.isDown) return;

      const dist = Phaser.Math.Distance.Between(
        pointer.x,
        pointer.y,
        this.dragStartX,
        this.dragStartY
      );

      if (dist > 5) {
        this.isDragging = true;
        const deltaX = pointer.x - this.lastPointerPosition.x;
        const deltaY = pointer.y - this.lastPointerPosition.y;

        // Movimento 1:1
        this.container.x += deltaX;
        this.container.y += deltaY;

        this.lastPointerPosition = { x: pointer.x, y: pointer.y };
      }
    });

    this.scene.input.on(
      "wheel",
      (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
        if (!this.container.visible) return;
        this.handleZoom(deltaY, pointer.x, pointer.y);
      }
    );
  }

  handleZoom(deltaY, mouseX, mouseY) {
    const zoomFactor = 0.1;
    const direction = deltaY > 0 ? -1 : 1;
    const oldScale = this.currentScale;
    let newScale = oldScale + direction * zoomFactor * oldScale;
    newScale = Phaser.Math.Clamp(newScale, this.minScale, this.maxScale);
    if (newScale === oldScale) return;
    const localX = (mouseX - this.container.x) / oldScale;
    const localY = (mouseY - this.container.y) / oldScale;
    this.currentScale = newScale;
    this.container.setScale(this.currentScale);
    this.container.x = mouseX - localX * newScale;
    this.container.y = mouseY - localY * newScale;
  }

  createBackdrop() {
    this.backdrop = this.scene.add.rectangle(
      0,
      0,
      this.scene.scale.width,
      this.scene.scale.height,
      0x000000,
      0.5
    );
    this.backdrop.setOrigin(0, 0).setDepth(30).setVisible(false);
    this.backdrop.setInteractive();
  }

  show(territoryData) {
    this.backdrop.setVisible(true);
    this.container.setVisible(true);
    this.container.setPosition(0, 0);
    this.container.setScale(1);

    const terrainColor = territoryData?.terrain?.color || 0x445566;
    if (territoryData) {
      const uiScene = this.scene.scene.get("UIScene");
      if (uiScene) {
        uiScene.setCombatMode(true, territoryData);
      }
    }

    const cols = 30;
    const rows = 15;
    const FIXED_RADIUS = 35;

    const gridData = GridCalculator.generateRectangularGrid(
      cols,
      rows,
      this.scene.scale.width,
      this.scene.scale.height,
      FIXED_RADIUS
    );

    this.createHexagons(gridData, terrainColor);

    // Centralização
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    gridData.positions.forEach((pos) => {
      if (pos.x < minX) minX = pos.x;
      if (pos.x > maxX) maxX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.y > maxY) maxY = pos.y;
    });
    const hexW = 2 * FIXED_RADIUS;
    const hexH = Math.sqrt(3) * FIXED_RADIUS;
    const gridPixelWidth = maxX - minX + hexW;
    const gridPixelHeight = maxY - minY + hexH;
    const gridCenterX = (minX + maxX) / 2;
    const gridCenterY = (minY + maxY) / 2;
    const screenW = this.scene.scale.width;
    const screenH = this.scene.scale.height;
    const scaleX = (screenW * 0.8) / gridPixelWidth;
    const scaleY = (screenH * 0.8) / gridPixelHeight;
    this.minScale = Math.max(Math.min(scaleX, scaleY), 0.05);
    this.currentScale = this.minScale;
    this.container.setScale(this.currentScale);
    this.container.x = screenW / 2 - gridCenterX * this.currentScale;
    this.container.y = screenH / 2 - gridCenterY * this.currentScale;
  }

  close() {
    this.backdrop.setVisible(false);
    this.container.setVisible(false);
    this.hexagons.forEach((hex) => hex.destroy());
    this.hexagons = [];
    this.selectedHexId = -1;
    const uiScene = this.scene.scene.get("UIScene");
    if (uiScene) {
      uiScene.setCombatMode(false);
    }

    if (this.scene.onCombatClose) this.scene.onCombatClose();
  }

  createHexagons(gridData, color) {
    gridData.positions.forEach((pos, index) => {
      const hex = new InteractiveHexagon(this.scene, this.container, {
        id: index,
        x: pos.x,
        y: pos.y,
        radius: gridData.radius,
        color: color,
        onSelect: (id) => this.handleHexSelection(id),
      });
      hex.gridCoords = { col: pos.col, row: pos.row };
      this.hexagons.push(hex);
    });
  }

  handleHexSelection(newId) {
    // 1. Ativa a flag
    this.isHexClick = true;

    if (this.selectedHexId !== -1) {
      const oldHex = this.hexagons.find((h) => h.id === this.selectedHexId);
      if (oldHex) oldHex.setSelected(false);
    }
    this.selectedHexId = newId;
    const newHex = this.hexagons.find((h) => h.id === newId);
    if (newHex) newHex.setSelected(true);
  }

  hexColorToString(colorInt) {
    return "#" + colorInt.toString(16).padStart(6, "0");
  }
}
