import Phaser from "phaser";
import { CONFIG } from "../config";

/** Self-contained overlay (build, show/hide, resize, destroy). */
export class HelpOverlay {
  private scene: Phaser.Scene;
  private container?: Phaser.GameObjects.Container;
  private tween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  preload() {
    this.scene.load.image(CONFIG.assets.lmb, CONFIG.assets.lmbUrl);
  }

  create(initialLocked: boolean) {
    const { add, cameras, scale } = this.scene;

    const padH = 14, padV = 8, gap = 10;
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "system-ui, Arial, sans-serif",
      fontSize: "16px",
      color: "#f0f0f0",
      stroke: "#000",
      strokeThickness: 2,
      shadow: { offsetX: 0, offsetY: 2, blur: 0, color: "#000", fill: true },
    };

    const left = add.text(0, 0, "Click", style).setOrigin(0, 0.5);
    const icon = add.image(0, 0, CONFIG.assets.lmb).setOrigin(0, 0.5);
    const targetH = 24, s = targetH / icon.height; icon.setScale(s);
    const right = add.text(0, 0, "inside game field to move", style).setOrigin(0, 0.5);

    const rowW = left.width + gap + icon.displayWidth + gap + right.width;
    const rowH = Math.max(left.height, targetH, right.height);

    const bg = add.graphics();
    const totalW = rowW + padH * 2, totalH = rowH + padV * 2, r = 12;
    bg.fillStyle(0x000000, 0.55);
    bg.lineStyle(2, 0xffffff, 0.08);
    bg.fillRoundedRect(-totalW/2, -totalH/2, totalW, totalH, r);
    bg.strokeRoundedRect(-totalW/2, -totalH/2, totalW, totalH, r);

    let x = -rowW / 2
    const y = 0;
    left.setPosition(x, y); x += left.width + gap;
    icon.setPosition(x, y); x += icon.displayWidth + gap;
    right.setPosition(x, y);

    this.container = add.container(cameras.main.centerX, cameras.main.height - 64, [bg, left, icon, right])
      .setDepth(200).setScrollFactor(0);

    scale.on("resize", (gs: Phaser.Structs.Size) => {
      this.container?.setPosition(gs.width / 2, gs.height - 64);
    });

    // start state
    this.setVisible(!initialLocked, true);
  }

  setVisible(visible: boolean, instant = false) {
    if (!this.container) return;
    this.tween?.remove();

    if (instant) {
      this.container.setAlpha(visible ? 1 : 0).setVisible(visible);
      return;
    }
    if (visible) {
      this.container.setVisible(true);
      this.tween = this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 100, ease: "Sine.easeInOut" });
    } else {
      this.tween = this.scene.tweens.add({
        targets: this.container, alpha: 0, duration: 100, ease: "Sine.easeInOut",
        onComplete: () => this.container?.setVisible(false)
      });
    }
  }

  destroy() {
    this.tween?.remove();
    this.container?.destroy();
    this.container = undefined;
  }
}
