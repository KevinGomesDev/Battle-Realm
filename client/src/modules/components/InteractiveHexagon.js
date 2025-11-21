import Phaser from "phaser";

export class InteractiveHexagon {
  constructor(scene, container, config) {
    this.scene = scene;
    this.id = config.id;
    this.baseColor = config.color || 0x888888;
    this.radius = config.radius;
    this.onSelect = config.onSelect;

    this.graphics = scene.add.graphics();
    this.graphics.setPosition(config.x, config.y);
    container.add(this.graphics);

    this.isSelected = false;

    this.setupInteractive();
    this.draw();
  }

  setupInteractive() {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = Phaser.Math.DegToRad(60 * i);
      points.push({
        x: this.radius * Math.cos(angle),
        y: this.radius * Math.sin(angle),
      });
    }
    points.push(points[0]);

    const hitShape = new Phaser.Geom.Polygon(points);

    this.graphics.setInteractive(hitShape, Phaser.Geom.Polygon.Contains);

    this.graphics.on("pointerover", () => {
      if (!this.graphics.visible) return;
      this.scene.input.manager.canvas.style.cursor = "pointer";
      this.draw(0xffffff);
    });

    this.graphics.on("pointerout", () => {
      this.scene.input.manager.canvas.style.cursor = "default";
      this.draw();
    });

    this.graphics.on("pointerdown", (pointer, localX, localY, event) => {
      if (this.onSelect) this.onSelect(this.id);
    });
  }

  setSelected(state) {
    this.isSelected = state;
    this.draw();
  }

  draw(overrideColor = null) {
    const g = this.graphics;
    g.clear();

    let color = this.baseColor;
    let alpha = 1;
    let lineThick = 1;
    let lineColor = 0x000000;

    if (overrideColor !== null) {
      color = overrideColor;
      lineThick = 2;
      lineColor = 0xffffff;
    } else if (this.isSelected) {
      color = 0xffd700;
      lineThick = 3;
    }

    g.fillStyle(color, alpha);
    g.lineStyle(lineThick, lineColor, 1);

    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = Phaser.Math.DegToRad(60 * i);
      const px = this.radius * Math.cos(angle);
      const py = this.radius * Math.sin(angle);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();
    g.strokePath();
  }

  destroy() {
    this.graphics.destroy();
  }
}
