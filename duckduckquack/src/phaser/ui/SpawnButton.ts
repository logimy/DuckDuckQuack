/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";

/**
 * Bottom-left anchored green "Spawn" button with click animation
 */
export class SpawnButton {
  private scene: Phaser.Scene;
  private container?: Phaser.GameObjects.Container;
  private background?: Phaser.GameObjects.Graphics;
  private label?: Phaser.GameObjects.Text;
  private tween?: Phaser.Tweens.Tween;

  // Layout constants
  private readonly marginLeft = 24;
  private readonly bottomPadding = 64;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Creates the spawn button
   */
  create(onClick: () => void) {
    const { add, cameras, scale, input } = this.scene;

    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "Fredoka, sans-serif",
      fontSize: "18px",
      color: "#f0fff0",
      stroke: "#000",
      strokeThickness: 2,
      shadow: { offsetX: 0, offsetY: 2, blur: 0, color: "#000", fill: true },
    };

    const label = add.text(0, 0, "Join", textStyle).setOrigin(0.5);
    const paddingHorizontal = 18;
    const paddingVertical = 10;
    const borderRadius = 12;
    const totalWidth = Math.max(100, label.width + paddingHorizontal * 2);
    const totalHeight = Math.max(36, label.height + paddingVertical * 2);

    const background = add.graphics();
    background.fillStyle(0x1a8f2a, 0.9);
    background.lineStyle(2, 0xffffff, 0.15);
    background.fillRoundedRect(-totalWidth / 2, -totalHeight / 2, totalWidth, totalHeight, borderRadius);
    background.strokeRoundedRect(-totalWidth / 2, -totalHeight / 2, totalWidth, totalHeight, borderRadius);

    const container = add
      .container(0, 0, [background, label])
      .setDepth(200)
      .setScrollFactor(0)
      .setSize(totalWidth, totalHeight)
      .setAlpha(0)
      .setVisible(false);

    // Use size-based hit area
    container.setInteractive();

    // Pointer cursor and event handling
    const stopPropagation = (_p: Phaser.Input.Pointer, _lx?: number, _ly?: number, ev?: any) => 
      ev?.stopPropagation?.();
    
    container.on("pointerover", (p: Phaser.Input.Pointer, lx?: number, ly?: number, ev?: any) => {
      stopPropagation(p, lx, ly, ev);
      input.setDefaultCursor("pointer");
    });
    
    container.on("pointerout", (p: Phaser.Input.Pointer, lx?: number, ly?: number, ev?: any) => {
      stopPropagation(p, lx, ly, ev);
      input.setDefaultCursor("default");
    });
    
    container.on("pointerdown", (_p: Phaser.Input.Pointer, _lx, _ly, ev: any) => {
      ev?.stopPropagation?.();
      
      // Click animation
      container.setScale(0.98);
      this.scene.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
        ease: "Sine.easeInOut",
      });
      
      onClick();
    });

    // Initial positioning
    this.container = container;
    this.background = background;
    this.label = label;
    this.positionToBottomLeft(cameras.main.width, cameras.main.height);

    // Keep position on resize
    scale.on("resize", (gameSize: Phaser.Structs.Size) => {
      this.positionToBottomLeft(gameSize.width, gameSize.height);
    });
  }

  /**
   * Positions the button at the bottom left of the screen
   */
  positionToBottomLeft(_width: number, height: number) {
    if (!this.container) return;
    const halfWidth = this.container.width / 2;
    this.container.setPosition(this.marginLeft + halfWidth, height - this.bottomPadding);
  }

  /**
   * Shows or hides the button with optional animation
   */
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
        duration: 120,
        ease: "Sine.easeInOut",
      });
    } else {
      this.tween = this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 120,
        ease: "Sine.easeInOut",
        onComplete: () => this.container?.setVisible(false),
      });
    }
  }

  /**
   * Destroys the button and cleans up resources
   */
  destroy() {
    this.tween?.remove();
    this.container?.destroy();
    this.background?.destroy();
    this.label?.destroy();
    this.container = this.background = this.label = undefined;
  }
}
