/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";

type GetIsLocked = () => boolean;

/**
 * Room code display with click-to-copy functionality
 */
export class RoomCodeDisplay {
  private scene: Phaser.Scene;
  private container?: Phaser.GameObjects.Container;
  private background?: Phaser.GameObjects.Graphics;
  private text?: Phaser.GameObjects.Text;
  private tween?: Phaser.Tweens.Tween;
  private roomCode: string;
  private readonly marginLeft = 24;
  private getIsLocked: GetIsLocked = () => false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Get room code from URL or registry
    const urlRoomCode = window.location.pathname.split('/room/')[1];
    this.roomCode = urlRoomCode || scene.game.registry.get('roomCode') as string || 'UNKNOWN';
  }

  /**
   * Creates the room code display
   */
  create(getIsLocked: GetIsLocked, initialLocked: boolean) {
    const { add, cameras, scale } = this.scene;

    this.getIsLocked = getIsLocked;

    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "Fredoka, sans-serif",
      fontSize: "16px",
      color: "#f0f0f0",
      stroke: "#000",
      strokeThickness: 2,
      shadow: { offsetX: 0, offsetY: 2, blur: 0, color: "#000", fill: true },
    };

    const text = add.text(0, 0, `Room: ${this.roomCode}`, textStyle).setOrigin(0.5);
    const paddingHorizontal = 14;
    const paddingVertical = 8;
    const borderRadius = 12;

    const background = add.graphics();
    const totalWidth = Math.max(120, text.width + paddingHorizontal * 2);
    const totalHeight = Math.max(32, text.height + paddingVertical * 2);

    background.fillStyle(0x000000, 0.55);
    background.lineStyle(2, 0xffffff, 0.08);
    background.fillRoundedRect(-totalWidth / 2, -totalHeight / 2, totalWidth, totalHeight, borderRadius);
    background.strokeRoundedRect(-totalWidth / 2, -totalHeight / 2, totalWidth, totalHeight, borderRadius);

    const centerX = this.marginLeft + totalWidth / 2;
    const centerY = cameras.main.height - 64; // Same bottom padding as HelpOverlay

    const container = add.container(centerX, centerY, [background, text])
      .setDepth(200)
      .setScrollFactor(0);
    container.setSize(totalWidth, totalHeight).setInteractive({ useHandCursor: true });

    // Prevent event bubbling to GameScene
    const stopPropagation = (_p: Phaser.Input.Pointer, _lx?: number, _ly?: number, ev?: any) => 
      ev?.stopPropagation?.();
    
    container.on("pointerover", stopPropagation);
    container.on("pointerout", stopPropagation);
    container.on("pointerdown", (_p: Phaser.Input.Pointer, _lx, _ly, ev: any) => {
      ev?.stopPropagation?.();
      if (this.getIsLocked()) return; // Ignore when locked
      
      // Copy room code to clipboard
      navigator.clipboard?.writeText(this.roomCode).then(() => {
        // Show feedback
        const originalText = text.text;
        text.setText("Copied!");
        this.scene.time.delayedCall(1000, () => {
          text.setText(originalText);
        });
      });
    });

    scale.on("resize", (gameSize: Phaser.Structs.Size) => {
      container.setPosition(this.marginLeft + totalWidth / 2, gameSize.height - 64);
    });

    this.container = container;
    this.background = background;
    this.text = text;

    // Initial visibility mirrors HelpOverlay: hidden when locked, visible when unlocked
    this.setVisible(!initialLocked, true);
  }

  /**
   * Shows or hides the display with optional animation
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
        duration: 100,
        ease: "Sine.easeInOut",
      });
    } else {
      this.tween = this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 100,
        ease: "Sine.easeInOut",
        onComplete: () => this.container?.setVisible(false),
      });
    }
  }

  /**
   * Destroys the display and cleans up resources
   */
  destroy() {
    this.tween?.remove();
    this.container?.destroy();
    this.background?.destroy();
    this.text?.destroy();
    this.container = this.background = this.text = undefined;
  }
}
