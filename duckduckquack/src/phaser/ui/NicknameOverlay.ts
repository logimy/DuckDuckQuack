/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";
import { SpawnButton } from "./SpawnButton";

type OnSpawn = (nickname: string) => void;

const NICK_RE = /^[A-Za-z0-9_-]{3,16}$/;

export class NicknameOverlay {
  private scene: Phaser.Scene;
  private container?: Phaser.GameObjects.Container;
  private bg?: Phaser.GameObjects.Graphics;
  private title?: Phaser.GameObjects.Text;
  private inputText?: Phaser.GameObjects.Text;
  private editText?: Phaser.GameObjects.Text;
  private checkText?: Phaser.GameObjects.Text;
  private cursor?: Phaser.GameObjects.Rectangle;
  private tween?: Phaser.Tweens.Tween;

  private isEditing = true;
  private nickname = "";
  private hasJoined = false;

  private onSpawn?: OnSpawn;
  private spawnBtn?: SpawnButton;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(initialNick: string | null, onSpawn: OnSpawn) {
    this.onSpawn = onSpawn;
    this.nickname = (initialNick ?? "").trim();
    this.isEditing = this.nickname.length === 0;

    const { add, cameras, input, scale } = this.scene;
    const cam = cameras.main;

    // Panel
    const pad = 18, r = 14, width = 420, height = 100;
    const bg = add.graphics();
    bg.fillStyle(0x000000, 0.65);
    bg.lineStyle(2, 0xffffff, 0.1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, r);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, r);

    const title = add
      .text(0, -height / 2 + pad, "Type in your nickname", {
        fontFamily: "Fredoka, sans-serif",
        fontSize: "18px",
        color: "#c0c0c0",
        stroke: "#000",
        strokeThickness: 2,
        shadow: { offsetX: 0, offsetY: 2, blur: 0, color: "#000", fill: true },
      })
      .setOrigin(0.5, 0);

    // Input / view
    const baseY = 12;
    const inputText = add
      .text(0, baseY, "", {
        fontFamily: "Fredoka, sans-serif",
        fontSize: "22px",
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 2,
        shadow: { offsetX: 0, offsetY: 2, blur: 0, color: "#000", fill: true },
      })
      .setOrigin(0.5, 0.5);

    const editText = add
      .text(0, baseY, "✏️", {
        fontFamily: "Fredoka, sans-serif",
        fontSize: "20px",
        color: "#f0f0f0",
        stroke: "#000",
        strokeThickness: 2,
        shadow: { offsetX: 0, offsetY: 2, blur: 0, color: "#000", fill: true },
      })
      .setOrigin(0, 0.5)
      .setVisible(false);

    const checkText = add
      .text(0, baseY, "✅", {
        fontFamily: "Fredoka, sans-serif",
        fontSize: "20px",
        color: "#f0f0f0",
        stroke: "#000",
        strokeThickness: 2,
        shadow: { offsetX: 0, offsetY: 2, blur: 0, color: "#000", fill: true },
      })
      .setOrigin(0, 0.5)   // will sit to the right of the input text
      .setVisible(false)
      .setInteractive();

    const cursor = add.rectangle(0, baseY - 0, 12, 22, 0xffffff, 0.9).setVisible(false);

    const container = add
      .container(cam.width / 2, cam.height / 2, [bg, title, inputText, editText, cursor, checkText])
      .setDepth(300)
      .setScrollFactor(0)
      .setAlpha(1);

    // Use size-based hit area for the container overlay
    container.setSize(width, height).setInteractive();

    // store refs
    this.container = container;
    this.bg = bg;
    this.title = title;
    this.inputText = inputText;
    this.editText = editText;
    this.cursor = cursor;
    this.checkText = checkText;

    // ----- prevent bubbling to GameScene (avoid pointer lock from overlay) -----
    const stop = (_p: Phaser.Input.Pointer, _lx?: number, _ly?: number, ev?: any) => ev?.stopPropagation?.();
    container.on("pointerover", (p: Phaser.Input.Pointer, lx?: number, ly?: number, ev?: any) => {
      stop(p, lx, ly, ev);
      input.setDefaultCursor("default");
    });
    container.on("pointerout", stop);
    container.on("pointerdown", stop);

    // Make inputText/editText interactive with default hit area (text bounds)
    inputText.setInteractive();
    editText.setInteractive();

    // Set pointer cursor on hover for editable items
    inputText.on("pointerover", (p: Phaser.Input.Pointer, lx?: number, ly?: number, ev?: any) => {
      stop(p, lx, ly, ev);
      if (this.isEditing) this.scene.input.setDefaultCursor("text");
      else this.scene.input.setDefaultCursor("default");
    });
    inputText.on("pointerout", (p: Phaser.Input.Pointer, lx?: number, ly?: number, ev?: any) => {
      stop(p, lx, ly, ev);
      this.scene.input.setDefaultCursor("default");
    });
    editText.on("pointerover", (p: Phaser.Input.Pointer, lx?: number, ly?: number, ev?: any) => {
      stop(p, lx, ly, ev);
      this.scene.input.setDefaultCursor("pointer");
    });
    editText.on("pointerout", (p: Phaser.Input.Pointer, lx?: number, ly?: number, ev?: any) => {
      stop(p, lx, ly, ev);
      this.scene.input.setDefaultCursor("default");
    });

    // Click handlers (stop propagation so GameScene doesn't toggle pointer-lock)
    inputText.on("pointerdown", (_: Phaser.Input.Pointer, _lx?: number, _ly?: number, ev?: any) => {
      ev?.stopPropagation?.();
      if (!this.isEditing) return;
      this.blinkCursor(true);
    });
    editText.on("pointerdown", (_: Phaser.Input.Pointer, _lx?: number, _ly?: number, ev?: any) => {
      ev?.stopPropagation?.();
      this.isEditing = true;
      this.updateVisuals();
      this.blinkCursor(true);
    });

    // Check handlers
    checkText.on("pointerover", (p: Phaser.Input.Pointer, lx?: number, ly?: number, ev?: any) => {
      stop(p, lx, ly, ev);
      // pointer cursor only when nickname is valid, else default (or "not-allowed")
      if (this.isNicknameValid(this.nickname)) this.scene.input.setDefaultCursor("pointer");
      else this.scene.input.setDefaultCursor("default");
    });
    checkText.on("pointerout", (p: Phaser.Input.Pointer, lx?: number, ly?: number, ev?: any) => {
      stop(p, lx, ly, ev);
      this.scene.input.setDefaultCursor("default");
    });
    checkText.on("pointerdown", (_: Phaser.Input.Pointer, _lx?: number, _ly?: number, ev?: any) => {
      ev?.stopPropagation?.();
      if (!this.isNicknameValid(this.nickname)) return;
      // "Save" nickname: exit edit mode, show pencil
      this.isEditing = false;
      this.updateVisuals();
    });

    // Keyboard handling for typing
    this.scene.input.keyboard!.on("keydown", this.onKeyDown);

    this.scene.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        if (this.isEditing) this.cursor!.setVisible(!this.cursor!.visible);
      },
    });

    // Spawn button (separate component), appears once nickname valid
    this.spawnBtn = new SpawnButton(this.scene);
    this.spawnBtn.create(() => {
      if (!this.isNicknameValid(this.nickname)) return;
      this.hasJoined = true;
      this.onSpawn?.(this.nickname.trim());
      this.setVisible(false);
    });

    // Resize
    scale.on("resize", (gs: Phaser.Structs.Size) => {
      container.setPosition(gs.width / 2, gs.height / 2);
      this.spawnBtn?.positionToBottomLeft(gs.width, gs.height);
    });

    // Initialize visuals
    this.updateVisuals();
  }

  private onKeyDown = (ev: KeyboardEvent) => {
    if (!this.isEditing) return;
    if (!this.inputText) return;

    if (ev.key === "Enter") {
      if (this.isNicknameValid(this.nickname)) {
        this.isEditing = false;
        this.updateVisuals();
      }
      return;
    }
    if (ev.key === "Backspace") {
      this.nickname = this.nickname.slice(0, -1);
    } else if (ev.key.length === 1) {
      const next = (this.nickname + ev.key).trim();
      if (next.length <= 16) this.nickname = next;
    }
    this.updateVisuals(true);
  };

  private isNicknameValid(n: string) {
    return NICK_RE.test(n.trim());
  }

  private updateVisuals(forceShowCursor = false) {
    if (!this.container || !this.inputText || !this.editText || !this.cursor) return;

    if (this.isEditing) {
      const display = this.nickname || "";
      this.inputText.setText(display || "");
      this.inputText.setVisible(true);
      this.editText.setVisible(false);
    
      this.cursor.setVisible(true);
      this.cursor.x = this.inputText.x + this.inputText.width / 2 + 6;
      if (forceShowCursor) this.blinkCursor(true);
      if (this.checkText) {
        this.checkText.setVisible(true);
        this.checkText.setPosition(this.inputText.x + this.inputText.width / 2 + 10, this.inputText.y);
        // dim when invalid, full when valid
        this.checkText.setAlpha(this.isNicknameValid(this.nickname) ? 1 : 0.35);
      }
    } else {
      this.inputText.setText(this.nickname);
      this.inputText.setVisible(true);
    
      this.editText.setVisible(true);
      this.editText.setPosition(this.inputText.x + this.inputText.width / 2 + 10, this.inputText.y);
    
      this.cursor.setVisible(false);
      this.checkText?.setVisible(false);
    }
    

    // spawn button visibility
    const canSpawn = this.isNicknameValid(this.nickname) && !this.isEditing && !this.hasJoined;
    this.spawnBtn?.setVisible(canSpawn);
  }

  private blinkCursor(show = false) {
    if (!this.cursor) return;
    this.cursor.setVisible(show);
  }

  setVisible(visible: boolean) {
    if (!this.container) return;
    this.tween?.remove();
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
   * Hides the spawn button
   */
  hideSpawnButton() {
    this.hasJoined = true;
    this.spawnBtn?.setVisible(false, true);
  }

  destroy() {
    this.tween?.remove();
    this.scene.input.setDefaultCursor("default");
    this.scene.input.keyboard?.off("keydown", this.onKeyDown);
    this.spawnBtn?.destroy();
    this.container?.destroy();
    this.bg?.destroy();
    this.title?.destroy();
    this.inputText?.destroy();
    this.editText?.destroy();
    this.cursor?.destroy();
    this.container =
      this.bg =
      this.title =
      this.inputText =
      this.editText =
      this.cursor =
      this.spawnBtn =
        undefined;
  }
}
