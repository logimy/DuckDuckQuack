/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";

type GetIsLocked = () => boolean;

/**
 * Sound toggle button with mute/unmute functionality
 */
export class SoundToggle {
  private scene: Phaser.Scene;
  private container?: Phaser.GameObjects.Container;
  private background?: Phaser.GameObjects.Graphics;
  private text?: Phaser.GameObjects.Text;
  private tween?: Phaser.Tweens.Tween;
  private isMuted = false;
  private readonly marginRight = 24;
  private getIsLocked: GetIsLocked = () => false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Creates the sound toggle button
   */
  create(initialMuted: boolean, getIsLocked: GetIsLocked, initialLocked: boolean) {
    const { add, cameras, scale, sound } = this.scene;

    this.getIsLocked = getIsLocked;
    this.isMuted = initialMuted;
    sound.mute = this.isMuted;

    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "Fredoka, sans-serif",
      fontSize: "18px",
      color: "#f0f0f0",
      stroke: "#000",
      strokeThickness: 2,
      shadow: { offsetX: 0, offsetY: 2, blur: 0, color: "#000", fill: true },
    };

    const text = add.text(0, 0, this.isMuted ? "🔇" : "🔊", textStyle).setOrigin(0.5);
    const paddingHorizontal = 14;
    const paddingVertical = 8;
    const borderRadius = 12;

    const background = add.graphics();
    const totalWidth = Math.max(36, text.width + paddingHorizontal * 2);
    const totalHeight = Math.max(32, text.height + paddingVertical * 2);

    background.fillStyle(0x000000, 0.55);
    background.lineStyle(2, 0xffffff, 0.08);
    background.fillRoundedRect(-totalWidth / 2, -totalHeight / 2, totalWidth, totalHeight, borderRadius);
    background.strokeRoundedRect(-totalWidth / 2, -totalHeight / 2, totalWidth, totalHeight, borderRadius);

    const centerX = cameras.main.width - this.marginRight - totalWidth / 2;
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
      this.toggle();
    });

    scale.on("resize", (gameSize: Phaser.Structs.Size) => {
      container.setPosition(
        gameSize.width - this.marginRight - totalWidth / 2, 
        gameSize.height - 64
      );
    });

    this.container = container;
    this.background = background;
    this.text = text;

    // Initial visibility mirrors HelpOverlay: hidden when locked, visible when unlocked
    this.setVisible(!initialLocked, true);
  }

  /**
   * Shows or hides the toggle with optional animation
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
   * Toggles mute state and updates UI
   */
  private toggle() {
    this.isMuted = !this.isMuted;
    this.scene.sound.mute = this.isMuted;
    localStorage.setItem("ddq_sound_muted", this.isMuted ? "1" : "0");
    this.text?.setText(this.isMuted ? "🔇" : "🔊");

    // Add click animation
    this.container?.setScale(0.98);
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1, 
      scaleY: 1,
      duration: 100,
      ease: "Sine.easeInOut",
    });
  }

  /**
   * Destroys the toggle and cleans up resources
   */
  destroy() {
    this.tween?.remove();
    this.container?.destroy();
    this.background?.destroy();
    this.text?.destroy();
    this.container = this.background = this.text = undefined;
  }
}
