/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";
import { Client, Room, getStateCallbacks } from "colyseus.js";
import lmbUrl from "../../../src/assets/LMB.png";

/* ---------- Types & Config ---------- */

type Vec2 = { x: number; y: number };
type PlayerSprite = Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
type PlayerMap = Record<string, PlayerSprite>;

export const CONFIG = {
  world: { width: 800, height: 800 },
  net:   { fixedHz: 60 },
  move:  {
    maxSpeedPerTick: 7,
    deadZone: 4,
    followGain: 0.25,
    velAlpha: 0.35,
    targetAlpha: 0.25,
  },
  reconcile: {
    smallErrPx: 1.5,
    snapErrPx: 64,
    alpha: 0.12,
  },
  remote: { lerpAlpha: 0.2 },
  assets: {
    ship: "ship_0001",
    shipUrl:
      "https://cdn.glitch.global/3e033dcd-d5be-4db4-99e8-086ae90969ec/ship_0001.png",
    lmb: "lmb_icon",
    lmbUrl
  },
  server: {
    url: import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567",
    roomName: "my_room",
  },
  ui: {
    containerId: "game-container",
    unlockedClass: "is-unlocked",
  },
} as const;

/* ---------- Scene ---------- */

export class GameScene extends Phaser.Scene {
  private room!: Room;
  private readonly client = new Client(CONFIG.server.url);

  private playerEntities: PlayerMap = {};
  private currentPlayer?: PlayerSprite;
  private remoteRef?: Phaser.GameObjects.Rectangle;

  // target used by movement (world space) and its smoothed copy
  private mouseWorld: Vec2 = { x: 0, y: 0 };
  private smoothedMouse: Vec2 = { x: 0, y: 0 };
  private prevVel: Vec2 = { x: 0, y: 0 };

  // server reconciliation
  private lastServerPos: Vec2 = { x: 0, y: 0 };
  private haveServerPos = false;

  // fixed-step integration
  private fixedTimeStep = 1000 / CONFIG.net.fixedHz;
  private elapsedTime = 0;

  // pointer lock + virtual crosshair state
  private isLocked = false;
  private virtualCursor: Vec2 = { x: 0, y: 0 };
  private cursorGfx?: Phaser.GameObjects.Graphics;

  // help tooltip
  private helpContainer?: Phaser.GameObjects.Container;
  private helpTween?: Phaser.Tweens.Tween;

  // 
  private tetherGfx?: Phaser.GameObjects.Graphics;
  private readonly tetherA = { min: 0.25, max: 0.85, start: 8, end: 140 };

  
  private updateTether(): void {
    if (!this.isLocked || !this.cursorGfx?.visible || !this.currentPlayer) {
      this.tetherGfx?.setVisible(false);
      this.tetherGfx?.clear();
      return;
    }
  
    const g =
      this.tetherGfx ?? (this.tetherGfx = this.add.graphics().setDepth(90));
  
    const px = this.currentPlayer.x, py = this.currentPlayer.y;
    const cx = this.cursorGfx.x,       cy = this.cursorGfx.y;
  
    // independent alpha (linear clamp)
    const d = Math.hypot(cx - px, cy - py);
    const t = Phaser.Math.Clamp(
      (d - this.tetherA.start) / Math.max(1, this.tetherA.end - this.tetherA.start),
      0, 0.2
    );
    g.setVisible(true).setAlpha(Phaser.Math.Linear(this.tetherA.min, this.tetherA.max, t));
  
    // dashed line (inline, no helper)
    g.clear().lineStyle(2, 0xffffff, 1).beginPath();
    const dx = cx - px, dy = cy - py, dist = Math.max(1, d);
    const nx = dx / dist, ny = dy / dist;
    const dash = 8, gap = 6, seg = dash + gap;
  
    for (let s = 0; s < dist; s += seg) {
      const a = Math.min(dash, dist - s);
      g.moveTo(px + nx * s,       py + ny * s);
      g.lineTo(px + nx * (s + a), py + ny * (s + a));
    }
    g.strokePath();
  }

  private showHelp(instant = false) {
    if (!this.helpContainer) return;
    this.helpTween?.remove();

    this.helpContainer.setVisible(true);
    if (instant) {
      this.helpContainer.setAlpha(1);
      return;
    }
    this.helpContainer.setAlpha(this.helpContainer.alpha ?? 0);
    this.helpTween = this.tweens.add({
      targets: this.helpContainer,
      alpha: 1,
      duration: 100,
      ease: 'Sine.easeInOut'
    });
  }

  private hideHelp(instant = false) {
    if (!this.helpContainer) return;
    this.helpTween?.remove();

    if (instant) {
      this.helpContainer.setAlpha(0).setVisible(false);
      return;
    }
    this.helpTween = this.tweens.add({
      targets: this.helpContainer,
      alpha: 0,
      duration: 100,
      ease: 'Sine.easeInOut',
      onComplete: () => this.helpContainer?.setVisible(false)
    });
  }

  private createHelpOverlay(): void {
    // Container positioned near bottom-center
    const padH = 14;
    const padV = 8;
    const gap = 10;
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'system-ui, Arial, sans-serif',
      fontSize: "16px",
      color: "#f0f0f0",
      stroke: "#000000",
      strokeThickness: 2,
      shadow: { offsetX: 0, offsetY: 2, blur: 0, color: "#000000", fill: true },
    };
  
    const left = this.add.text(0, 0, "Click", textStyle);
    left.setOrigin(0, 0.5);
  
    const icon = this.add.image(0, 0, CONFIG.assets.lmb).setOrigin(0, 0.5);
    // Scale icon to fit ~24px height while preserving aspect
    const targetIconH = 24;
    const scale = targetIconH / icon.height;
    icon.setScale(scale);
  
    const right = this.add.text(0, 0, "inside game field to move", textStyle);
    right.setOrigin(0, 0.5);
  
    // Measure row width
    const rowW = left.width + gap + icon.displayWidth + gap + right.width;
    const rowH = Math.max(left.height, targetIconH, right.height);
  
    // Background pill
    const bg = this.add.graphics();
    const radius = 12;
    const totalW = rowW + padH * 2;
    const totalH = rowH + padV * 2;
  
    bg.fillStyle(0x000000, 0.55);           // semi-transparent dark
    bg.lineStyle(2, 0xffffff, 0.08);        // subtle edge
    bg.fillRoundedRect(-totalW / 2, -totalH / 2, totalW, totalH, radius);
    bg.strokeRoundedRect(-totalW / 2, -totalH / 2, totalW, totalH, radius);
  
    // Layout elements centered in the pill
    let x = -rowW / 2;
    const y = 0;
    left.setPosition(x, y);
    x += left.width + gap;
    icon.setPosition(x, y);
    x += icon.displayWidth + gap;
    right.setPosition(x, y);
  
    // Build a container so we can reposition easily
    const container = this.add.container(
      this.cameras.main.centerX,
      this.cameras.main.height - 64,
      [bg, left, icon, right]
    );
    container.setDepth(200).setScrollFactor(0);
    this.helpContainer = container;
    
    // Position on resize remains the same...
    this.scale.on("resize", (gameSize: Phaser.Structs.Size) => {
      this.helpContainer?.setPosition(gameSize.width / 2, gameSize.height - 64);
    });
    
    // Initialize alpha/visibility based on pointer lock state (no animation on boot)
    if (this.isLocked) this.hideHelp(true);
    else this.showHelp(true);
  }

  private updateContainerClass(): void {
    const el = document.getElementById(CONFIG.ui.containerId);
    if (!el) return;
  
    if (this.isLocked) {
      el.classList.remove(CONFIG.ui.unlockedClass);
    } else {
      el.classList.add(CONFIG.ui.unlockedClass);
    }
  }

  preload() {
    this.load.image(CONFIG.assets.ship, CONFIG.assets.shipUrl);
    this.load.image(CONFIG.assets.lmb, CONFIG.assets.lmbUrl);
  }

  async create() {
    await this.connectToRoom();

    this.createHelpOverlay();

    // Toggle pointer lock on LMB click.
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      const canvas = this.game.canvas as HTMLCanvasElement;
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      } else {
        canvas.requestPointerLock?.();
      }
    });

    // Pointer move:
    // - locked  : accumulate relative deltas into a virtual world cursor
    // - unlocked: track absolute world coords (for when user locks later)
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const cam = this.cameras.main;

      if (this.isLocked) {
        const worldDx = pointer.movementX / cam.zoom;
        const worldDy = pointer.movementY / cam.zoom;

        this.virtualCursor.x = Phaser.Math.Clamp(
          this.virtualCursor.x + worldDx, 0, CONFIG.world.width
        );
        this.virtualCursor.y = Phaser.Math.Clamp(
          this.virtualCursor.y + worldDy, 0, CONFIG.world.height
        );

        this.mouseWorld.x = this.virtualCursor.x;
        this.mouseWorld.y = this.virtualCursor.y;

        this.ensureCursorGfx();
        this.cursorGfx!.setVisible(true).setPosition(this.virtualCursor.x, this.virtualCursor.y);
        this.updateCursorOpacity();
        this.updateTether();
      } else {
        const p = cam.getWorldPoint(pointer.x, pointer.y);
        this.mouseWorld.x = p.x;
        this.mouseWorld.y = p.y;
        this.cursorGfx?.setVisible(false);
      }
    });

    this.updateContainerClass();

    // Keep scene state aligned with pointer lock lifecycle (ESC, blur, etc.)
    document.addEventListener("pointerlockchange", () => {
      const nowLocked = document.pointerLockElement === this.game.canvas;
      this.isLocked = nowLocked;

      if (nowLocked) this.hideHelp(); else this.showHelp();

      if (nowLocked) {
        this.virtualCursor.x = this.mouseWorld.x;
        this.virtualCursor.y = this.mouseWorld.y;
        this.ensureCursorGfx();
        this.cursorGfx!.setVisible(true).setPosition(this.virtualCursor.x, this.virtualCursor.y);
        this.updateCursorOpacity();
      } else {
        this.prevVel.x = 0; this.prevVel.y = 0;
        this.cursorGfx?.setVisible(false);
        this.tetherGfx?.setVisible(false);
        this.tetherGfx?.clear();
      }

      this.updateContainerClass();
    });

    if (this.isLocked) this.hideHelp(true); else this.showHelp(true);

    // Release lock and halt on tab blur.
    this.game.events.on(Phaser.Core.Events.BLUR, () => {
      if (document.pointerLockElement === this.game.canvas) {
        document.exitPointerLock();
      }
      this.prevVel.x = 0; this.prevVel.y = 0;
    });

    this.room.onLeave(() => this.cleanupAll());
    this.updateContainerClass();
  }

  update(_time: number, delta: number): void {
    if (!this.currentPlayer || !this.room) return;
    this.elapsedTime += delta;
    while (this.elapsedTime >= this.fixedTimeStep) {
      this.elapsedTime -= this.fixedTimeStep;
      this.fixedTick();
    }
  }

  /* ---------- Fixed step ---------- */

  private fixedTick(): void {
    this.smoothMouseTarget();
    const desired = this.computeDesiredVelocity();
    const vel = this.applyVelocitySmoothing(desired);
    this.applyLocalMove(vel);
    this.sendInput(vel);
    this.reconcileSelf();

    // Opacity needs to follow the player as well (even if mouse isn't moving).
    if (this.isLocked && this.cursorGfx?.visible) this.updateCursorOpacity();
    this.updateTether();

    this.interpolateRemotes();
  }

  /* ---------- Colyseus wiring ---------- */

  private async connectToRoom(): Promise<void> {
    this.room = await this.client.joinOrCreate(CONFIG.server.roomName);
    const $ = getStateCallbacks(this.room);

    $(this.room.state).players.onAdd((player: any, sessionId: string) => {
      const sprite = this.spawnPlayerSprite(player.x, player.y);

      // Local player above crosshair; remotes under crosshair.
      if (sessionId === this.room.sessionId) {
        sprite.setDepth(99);
      } else {
        sprite.setDepth(92);
      }

      this.playerEntities[sessionId] = sprite;

      if (sessionId === this.room.sessionId) {
        this.currentPlayer = sprite;
        this.remoteRef = this.add
          .rectangle(0, 0, sprite.width, sprite.height)
          .setStrokeStyle(1, 0xff0000)
          .setDepth(91);

        $(player).onChange(() => {
          this.lastServerPos.x = player.x;
          this.lastServerPos.y = player.y;
          this.haveServerPos = true;

          this.remoteRef!.x = player.x;
          this.remoteRef!.y = player.y;
        });
      } else {
        $(player).onChange(() => {
          sprite.setData("serverX", player.x);
          sprite.setData("serverY", player.y);
        });
      }
    });

    $(this.room.state).players.onRemove((_player: any, sessionId: string) => {
      this.removePlayerSprite(sessionId);
    });
  }

  /* ---------- Movement helpers ---------- */

  private smoothMouseTarget(): void {
    const a = CONFIG.move.targetAlpha;
    if (this.smoothedMouse.x === 0 && this.smoothedMouse.y === 0) {
      this.smoothedMouse.x = this.mouseWorld.x;
      this.smoothedMouse.y = this.mouseWorld.y;
      return;
    }
    this.smoothedMouse.x = Phaser.Math.Linear(this.smoothedMouse.x, this.mouseWorld.x, a);
    this.smoothedMouse.y = Phaser.Math.Linear(this.smoothedMouse.y, this.mouseWorld.y, a);
  }

  private computeDesiredVelocity(): Vec2 {
    // Move only while pointer is locked.
    if (!this.isLocked) return { x: 0, y: 0 };

    const p = this.currentPlayer!;
    const dx = this.smoothedMouse.x - p.x;
    const dy = this.smoothedMouse.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= CONFIG.move.deadZone) return { x: 0, y: 0 };

    const nx = dx / dist, ny = dy / dist;
    const desiredSpeed = Math.min(CONFIG.move.maxSpeedPerTick, dist * CONFIG.move.followGain);
    return { x: nx * desiredSpeed, y: ny * desiredSpeed };
  }

  private applyVelocitySmoothing(desired: Vec2): Vec2 {
    const a = CONFIG.move.velAlpha;
    const vx = Phaser.Math.Linear(this.prevVel.x, desired.x, a);
    const vy = Phaser.Math.Linear(this.prevVel.y, desired.y, a);
    this.prevVel.x = vx; this.prevVel.y = vy;
    return { x: vx, y: vy };
  }

  private applyLocalMove(vel: Vec2): void {
    const p = this.currentPlayer!;
    p.x += vel.x; p.y += vel.y;
    this.clampToWorldBounds(p);
  }

  private sendInput(vel: Vec2): void {
    // server expects { vx, vy }
    this.room.send(0, { vx: vel.x, vy: vel.y });
  }

  private reconcileSelf(): void {
    if (!this.haveServerPos || !this.currentPlayer) return;
    const p = this.currentPlayer;
    const { smallErrPx, snapErrPx, alpha } = CONFIG.reconcile;
    const err = Math.hypot(this.lastServerPos.x - p.x, this.lastServerPos.y - p.y);

    if (err > snapErrPx) {
      p.x = this.lastServerPos.x;
      p.y = this.lastServerPos.y;
      this.prevVel.x = 0; this.prevVel.y = 0;
    } else if (err > smallErrPx) {
      p.x = Phaser.Math.Linear(p.x, this.lastServerPos.x, alpha);
      p.y = Phaser.Math.Linear(p.y, this.lastServerPos.y, alpha);
    }
  }

  private interpolateRemotes(): void {
    const a = CONFIG.remote.lerpAlpha;
    for (const id in this.playerEntities) {
      if (id === this.room.sessionId) continue;
      const e = this.playerEntities[id];
      if (!e) continue;

      const data = e.data?.values as any;
      const serverX = data?.serverX;
      const serverY = data?.serverY;
      if (typeof serverX !== "number" || typeof serverY !== "number") continue;

      e.x = Phaser.Math.Linear(e.x, serverX, a);
      e.y = Phaser.Math.Linear(e.y, serverY, a);
    }
  }

  /* ---------- Crosshair (locked mode) ---------- */

  private ensureCursorGfx(): void {
    if (this.cursorGfx) return;
    const g = this.add.graphics();
    g.lineStyle(2, 0xffffff, 1);
    g.beginPath(); g.moveTo(-18, 0); g.lineTo(18, 0); g.strokePath();   // horizontal
    g.beginPath(); g.moveTo(0, -18); g.lineTo(0, 18); g.strokePath();   // vertical
    g.setDepth(98); // above remotes (92), below local (99) if you prefer
    this.cursorGfx = g;
  }

  // Alpha scales linearly with distance to the local player: 0 at 8px, 1 at 120px.
  private updateCursorOpacity(): number {
    if (!this.currentPlayer || !this.cursorGfx) return 0;
    const cx = this.cursorGfx.x, cy = this.cursorGfx.y;
    const px = this.currentPlayer.x, py = this.currentPlayer.y;
  
    const dist = Math.hypot(cx - px, cy - py);
    const t = Phaser.Math.Clamp((dist - 2) / Math.max(1, 80 - 2), 0.4, 0.8);
    this.cursorGfx.setAlpha(t);
    return t;
  }

  /* ---------- Entities ---------- */

  private spawnPlayerSprite(x: number, y: number): PlayerSprite {
    return this.physics.add.image(x, y, CONFIG.assets.ship);
  }

  private removePlayerSprite(sessionId: string): void {
    const sprite = this.playerEntities[sessionId];
    sprite?.destroy();
    delete this.playerEntities[sessionId];

    if (sessionId === this.room.sessionId) {
      this.currentPlayer = undefined;
      this.remoteRef?.destroy();
      this.cursorGfx?.destroy();
      this.cursorGfx = undefined;
    }
  }

  private clampToWorldBounds(p: PlayerSprite): void {
    const { width, height } = CONFIG.world;
    if (p.x < 0) p.x = 0; else if (p.x > width) p.x = width;
    if (p.y < 0) p.y = 0; else if (p.y > height) p.y = height;
  }

  private cleanupAll(): void {
    Object.values(this.playerEntities).forEach((e) => e?.destroy());
    this.playerEntities = {};
    this.remoteRef?.destroy();
    this.cursorGfx?.destroy();
    this.cursorGfx = undefined;
    this.currentPlayer = undefined;
    this.tetherGfx?.destroy();
    this.tetherGfx = undefined;
  }
}
