/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";
import { CONFIG } from "../config";
import type { PlayerMap, PlayerSprite, Vec2 } from "../types";
import { HelpOverlay } from "../ui/HelpOverlay";
import { CursorSystem } from "../systems/CursorSystem";
import { TetherSystem } from "../systems/TetherSystem";
import { MovementSystem } from "../systems/MovementSystem";
import { ReconcileSystem } from "../systems/ReconcileSystem";
import { interpolateRemotes } from "../systems/RemoteInterpolationSystem";
import { ColyseusBridge } from "../net/ColyseusBridge";

export class GameScene extends Phaser.Scene {
  // Net & entities
  private net = new ColyseusBridge();
  private players: PlayerMap = {};
  private me?: PlayerSprite;
  private remoteRef?: Phaser.GameObjects.Rectangle;

  // Systems / UI
  private help!: HelpOverlay;
  private cursor!: CursorSystem;
  private tether!: TetherSystem;
  private move!: MovementSystem;
  private reconcile!: ReconcileSystem;

  // Pointer-lock & virtual cursor
  private isLocked = false;
  private virtualCursor: Vec2 = { x: 0, y: 0 };

  // Fixed step
  private readonly fixedStep = 1000 / CONFIG.net.fixedHz;
  private acc = 0;

  /* ------------------------------ Lifecycle ------------------------------ */

  preload() {
    this.load.image(CONFIG.assets.ship, CONFIG.assets.shipUrl);
    this.help = new HelpOverlay(this);
    this.help.preload();
  }

  async create() {
    this.cursor = new CursorSystem(this);
    this.tether = new TetherSystem(this);
    this.move = new MovementSystem();
    this.reconcile = new ReconcileSystem();

    // Initial lock state (before UI/net)
    this.isLocked = this.isCanvasLocked();
    this.move.setLocked(this.isLocked);
    this.updateUnlockedClass();

    // UI
    this.help.create(this.isLocked);

    // Net
    await this.net.connect(this, this.players, {
      onLocalJoin: (sprite) => this.onLocalJoin(sprite),
      onLocalUpdate: (x, y) => this.onLocalUpdate(x, y),
      onRemoteJoin: () => {},
      onRemoteUpdate: (id, x, y) => this.onRemoteUpdate(id, x, y),
      onRemoteLeave: (id) => this.onRemoteLeave(id),
    });
    this.net.onLeave(() => this.cleanup());

    // Input
    this.wirePointerLock();
    this.wirePointerMove();

    // Blur releases lock and halts smoothing
    this.game.events.on(Phaser.Core.Events.BLUR, () => {
      if (this.isCanvasLocked()) document.exitPointerLock();
      this.move.setLocked(false);
    });
  }

  update(_t: number, dt: number) {
    if (!this.me) return;
    this.acc += dt;
    while (this.acc >= this.fixedStep) {
      this.acc -= this.fixedStep;

      const v = this.move.step();
      this.net.sendVelocity(v.x, v.y);

      this.reconcile.step();

      this.cursor.updateOpacity();
      const cp = this.cursor.position;
      if (this.isLocked && cp) this.tether.drawTo(cp.x, cp.y);

      interpolateRemotes(this.players, this.net.sessionId);
    }
  }

  /* ------------------------------ Net Hooks ------------------------------ */

  private onLocalJoin(sprite: PlayerSprite) {
    this.me = sprite;

    this.cursor.setPlayer(sprite);
    this.tether.setPlayer(sprite);
    this.move.setPlayer(sprite);
    this.reconcile.setPlayer(sprite);

    this.remoteRef = this.add
      .rectangle(0, 0, sprite.width, sprite.height)
      .setStrokeStyle(1, 0xff0000)
      .setDepth(91);

    // If page started locked, initialize cursor once we actually have a player
    if (this.isLocked) this.initCursorAtPointer();
    else this.hideCursorAndTether();
  }

  private onLocalUpdate(x: number, y: number) {
    this.reconcile.setServerPos(x, y);
    if (this.remoteRef) { this.remoteRef.x = x; this.remoteRef.y = y; }
  }

  private onRemoteUpdate(id: string, x: number, y: number) {
    const s = this.players[id]; if (!s) return;
    s.setData("serverX", x);
    s.setData("serverY", y);
  }

  private onRemoteLeave(id: string) {
    this.players[id]?.destroy();
    delete this.players[id];
  }

  /* ------------------------------ Input ------------------------------ */

  private wirePointerLock() {
    // Toggle on LMB
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!p.leftButtonDown()) return;
      const canvas = this.game.canvas as HTMLCanvasElement;
      if (this.isCanvasLocked()) document.exitPointerLock();
      else canvas.requestPointerLock?.();
    });

    document.addEventListener("pointerlockchange", () => {
      this.setLocked(this.isCanvasLocked());
    });
  }

  private wirePointerMove() {
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const cam = this.cameras.main;
      if (this.isLocked) {
        const dx = pointer.movementX / cam.zoom;
        const dy = pointer.movementY / cam.zoom;

        this.virtualCursor.x = Phaser.Math.Clamp(this.virtualCursor.x + dx, 0, CONFIG.world.width);
        this.virtualCursor.y = Phaser.Math.Clamp(this.virtualCursor.y + dy, 0, CONFIG.world.height);

        this.move.setMouseWorld(this.virtualCursor.x, this.virtualCursor.y);
        this.cursor.showAt(this.virtualCursor.x, this.virtualCursor.y);
        this.tether.drawTo(this.virtualCursor.x, this.virtualCursor.y);
      } else {
        const p = cam.getWorldPoint(pointer.x, pointer.y);
        this.move.setMouseWorld(p.x, p.y);
        this.hideCursorAndTether();
      }
    });
  }

  /* ------------------------------ Lock Helpers ------------------------------ */

  private isCanvasLocked(): boolean {
    return document.pointerLockElement === this.game.canvas;
  }

  private setLocked(locked: boolean) {
    this.isLocked = locked;
    this.move.setLocked(locked);
    this.help.setVisible(!locked);
    this.updateUnlockedClass();

    if (locked && this.me) this.initCursorAtPointer();
    else this.hideCursorAndTether();
  }

  private initCursorAtPointer() {
    this.virtualCursor.x = this.input.activePointer.worldX;
    this.virtualCursor.y = this.input.activePointer.worldY;
    this.cursor.showAt(this.virtualCursor.x, this.virtualCursor.y);
  }

  private hideCursorAndTether() {
    this.cursor.hide();
    this.tether.hide();
  }

  private updateUnlockedClass() {
    const el = document.getElementById(CONFIG.ui.containerId);
    if (!el) return;
    el.classList[this.isLocked ? "remove" : "add"](CONFIG.ui.unlockedClass);
  }

  /* ------------------------------ Cleanup ------------------------------ */

  private cleanup() {
    Object.values(this.players).forEach(s => s?.destroy());
    this.players = {};
    this.me = undefined;
    this.remoteRef?.destroy(); this.remoteRef = undefined;
    this.cursor?.destroy(); this.tether?.destroy(); this.help?.destroy();
  }
}
