import Phaser from "phaser";
import { CONFIG } from "../config";

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

    const paddingHorizontal = 14;
    const paddingVertical = 8;
    const gap = 10;
    const borderRadius = 12;
    const targetIconHeight = 24;
    
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "Fredoka, sans-serif",
      fontSize: "16px",
      color: "#f0f0f0",
      stroke: "#000",
      strokeThickness: 2,
      shadow: { offsetX: 0, offsetY: 2, blur: 0, color: "#000", fill: true },
    };

    const leftText = add.text(0, 0, "Click", textStyle).setOrigin(0, 0.5);
    const icon = add.image(0, 0, CONFIG.assets.lmb).setOrigin(0, 0.5);
    const rightText = add.text(0, 0, "inside game field to move", textStyle).setOrigin(0, 0.5);

    const iconScale = targetIconHeight / icon.height;
    icon.setScale(iconScale);

    const rowWidth = leftText.width + gap + icon.displayWidth + gap + rightText.width;
    const rowHeight = Math.max(leftText.height, targetIconHeight, rightText.height);
    const totalWidth = rowWidth + paddingHorizontal * 2;
    const totalHeight = rowHeight + paddingVertical * 2;

    const background = add.graphics();
    background.fillStyle(0x000000, 0.55);
    background.lineStyle(2, 0xffffff, 0.08);
    background.fillRoundedRect(-totalWidth / 2, -totalHeight / 2, totalWidth, totalHeight, borderRadius);
    background.strokeRoundedRect(-totalWidth / 2, -totalHeight / 2, totalWidth, totalHeight, borderRadius);

    let currentX = -rowWidth / 2;
    const currentY = 0;
    
    leftText.setPosition(currentX, currentY);
    currentX += leftText.width + gap;
    
    icon.setPosition(currentX, currentY);
    currentX += icon.displayWidth + gap;
    
    rightText.setPosition(currentX, currentY);

    this.container = add.container(
      cameras.main.centerX, 
      cameras.main.height - 64, 
      [background, leftText, icon, rightText]
    ).setDepth(200).setScrollFactor(0);

    scale.on("resize", (gameSize: Phaser.Structs.Size) => {
      this.container?.setPosition(gameSize.width / 2, gameSize.height - 64);
    });

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
      this.tween = this.scene.tweens.add({ 
        targets: this.container, 
        alpha: 1, 
        duration: 100, 
        ease: "Sine.easeInOut" 
      });
    } else {
      this.tween = this.scene.tweens.add({
        targets: this.container, 
        alpha: 0, 
        duration: 100, 
        ease: "Sine.easeInOut",
        onComplete: () => this.container?.setVisible(false)
      });
    }
  }

  /**
   * Destroys the overlay and cleans up resources
   */
  destroy() {
    this.tween?.remove();
    this.container?.destroy();
    this.container = undefined;
  }
}
