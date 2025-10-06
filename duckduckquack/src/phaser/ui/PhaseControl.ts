/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";

type GetIsLocked = () => boolean;
type OnPhaseChange = (phase: string) => void;

/**
 * Phase control buttons for changing room state (lobby, playing, ended)
 */
export class PhaseControl {
  private scene: Phaser.Scene;
  private container?: Phaser.GameObjects.Container;
  private background?: Phaser.GameObjects.Graphics;
  private buttons: Phaser.GameObjects.Text[] = [];
  private tween?: Phaser.Tweens.Tween;
  private currentPhase: string = "lobby";
  private getIsLocked: GetIsLocked = () => false;
  private onPhaseChange: OnPhaseChange = () => {};
  private readonly phases = [
    { key: "lobby", label: "Lobby", color: 0x4CAF50 },
    { key: "playing", label: "Playing", color: 0x2196F3 },
    { key: "ended", label: "Ended", color: 0xF44336 }
  ];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Creates the phase control buttons
   */
  create(getIsLocked: GetIsLocked, onPhaseChange: OnPhaseChange, initialLocked: boolean) {
    const { add, cameras, scale } = this.scene;

    this.getIsLocked = getIsLocked;
    this.onPhaseChange = onPhaseChange;

    const buttonStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "Fredoka, sans-serif",
      fontSize: "14px",
      color: "#f0f0f0",
      stroke: "#000",
      strokeThickness: 1,
      shadow: { offsetX: 0, offsetY: 1, blur: 0, color: "#000", fill: true },
    };

    const buttonWidth = 80;
    const buttonHeight = 32;
    const buttonSpacing = 8;
    const totalWidth = this.phases.length * buttonWidth + (this.phases.length - 1) * buttonSpacing;
    const paddingHorizontal = 16;
    const paddingVertical = 8;
    const borderRadius = 8;

    const background = add.graphics();
    background.fillStyle(0x000000, 0.55);
    background.lineStyle(2, 0xffffff, 0.08);
    background.fillRoundedRect(-totalWidth / 2 - paddingHorizontal, -buttonHeight / 2 - paddingVertical, 
      totalWidth + paddingHorizontal * 2, buttonHeight + paddingVertical * 2, borderRadius);
    background.strokeRoundedRect(-totalWidth / 2 - paddingHorizontal, -buttonHeight / 2 - paddingVertical, 
      totalWidth + paddingHorizontal * 2, buttonHeight + paddingVertical * 2, borderRadius);

    // Create buttons
    const buttonContainers: Phaser.GameObjects.Container[] = [];
    this.phases.forEach((phase, index) => {
      const x = -totalWidth / 2 + buttonWidth / 2 + index * (buttonWidth + buttonSpacing);
      const button = add.text(0, 0, phase.label, buttonStyle).setOrigin(0.5);
      
      // Create button background
      const buttonBg = add.graphics();
      buttonBg.fillStyle(phase.color, 0.3);
      buttonBg.lineStyle(1, phase.color, 0.6);
      buttonBg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, borderRadius);
      buttonBg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, borderRadius);
      
      button.setDepth(201);
      buttonBg.setDepth(200);
      
      this.buttons.push(button);
      
      // Make button interactive
      const buttonContainer = add.container(x, 0, [buttonBg, button])
        .setSize(buttonWidth, buttonHeight)
        .setInteractive({ useHandCursor: true });

      buttonContainers.push(buttonContainer);

      // Prevent event bubbling to GameScene
      const stopPropagation = (_p: Phaser.Input.Pointer, _lx?: number, _ly?: number, ev?: any) => 
        ev?.stopPropagation?.();
      
      buttonContainer.on("pointerover", stopPropagation);
      buttonContainer.on("pointerout", stopPropagation);
      buttonContainer.on("pointerdown", (_p: Phaser.Input.Pointer, _lx, _ly, ev: any) => {
        ev?.stopPropagation?.();
        if (this.getIsLocked()) return; // Ignore when locked
        this.setPhase(phase.key);
      });
    });

    const centerX = cameras.main.width / 2;
    const centerY = cameras.main.height - 32; // Position at bottom center

    const container = add.container(centerX, centerY, [background, ...buttonContainers])
      .setDepth(200)
      .setScrollFactor(0);

    scale.on("resize", (gameSize: Phaser.Structs.Size) => {
      container.setPosition(gameSize.width / 2, gameSize.height - 32);
    });

    this.container = container;
    this.background = background;

    // Initial visibility: hidden when locked, visible when unlocked
    this.setVisible(!initialLocked, true);
    
    // Set initial phase state
    this.updateButtonStyles();
  }

  /**
   * Shows or hides the phase control with optional animation
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
   * Updates the current phase and highlights the active button
   */
  updatePhase(phase: string) {
    this.currentPhase = phase;
    this.updateButtonStyles();
  }

  /**
   * Sets a new phase and notifies the callback
   */
  private setPhase(phase: string) {
    if (phase === this.currentPhase) return;
    
    this.currentPhase = phase;
    this.updateButtonStyles();
    this.onPhaseChange(phase);
  }

  /**
   * Updates button styles to highlight the active phase
   */
  private updateButtonStyles() {
    this.phases.forEach((phase, index) => {
      const button = this.buttons[index];
      if (!button) return;
      
      const isActive = phase.key === this.currentPhase;
      button.setStyle({
        color: isActive ? "#ffffff" : "#f0f0f0",
        strokeThickness: isActive ? 2 : 1,
      });
    });
  }

  /**
   * Destroys the phase control and cleans up resources
   */
  destroy() {
    this.tween?.remove();
    this.container?.destroy();
    this.background?.destroy();
    this.buttons.forEach(button => button.destroy());
    this.buttons = [];
    this.container = this.background = undefined;
  }
}
