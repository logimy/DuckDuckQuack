/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";
import { Client, Room, getStateCallbacks } from "colyseus.js";

/* =========================================
 * Types & Config
 * =======================================*/

type Vec2 = { x: number; y: number };
type PlayerSprite = Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
type PlayerMap = Record<string, PlayerSprite>;

const CONFIG = {
  world: { width: 800, height: 800 },
  net:   { fixedHz: 60 },
  move:  {
    maxSpeedPerTick: 7,  // px per fixed tick (~9*60 = 540 px/s)
    deadZone: 4,
    followGain: 0.25,    // speed ∝ distance * gain (clamped)
    velAlpha: 0.35,      // velocity EMA blend
    targetAlpha: 0.25,   // mouse EMA blend
  },
  reconcile: {
    smallErrPx: 1.5,     // ignore micro error
    snapErrPx: 64,       // snap if very off
    alpha: 0.12,         // continuous gentle correction per tick
  },
  remote: { lerpAlpha: 0.2 },
  assets: {
    ship: "ship_0001",
    shipUrl: "https://cdn.glitch.global/3e033dcd-d5be-4db4-99e8-086ae90969ec/ship_0001.png",
  },
  server: { url: "ws://localhost:2567", roomName: "my_room" },
} as const;

/* =========================================
 * Scene
 * =======================================*/

export class GameScene extends Phaser.Scene {
  /* --- Colyseus --- */
  private room!: Room;
  private readonly client = new Client(CONFIG.server.url);

  /* --- World / Entities --- */
  private playerEntities: PlayerMap = {};
  private currentPlayer?: PlayerSprite;
  private remoteRef?: Phaser.GameObjects.Rectangle;

  /* --- Input & Movement Smoothing --- */
  private mouseWorld: Vec2 = { x: 0, y: 0 };       // raw mouse (world space)
  private smoothedMouse: Vec2 = { x: 0, y: 0 };    // EMA mouse target
  private prevVel: Vec2 = { x: 0, y: 0 };          // velocity EMA

  /* --- Reconciliation --- */
  private lastServerPos: Vec2 = { x: 0, y: 0 };
  private haveServerPos = false;

  /* --- Networking --- */
  private inputPayload: Vec2 = { x: 0, y: 0 };
  private fixedTimeStep = 1000 / CONFIG.net.fixedHz;
  private elapsedTime = 0;

  /* =========================================
   * Phaser lifecycle
   * =======================================*/

  preload() {
    this.load.image(CONFIG.assets.ship, CONFIG.assets.shipUrl);
  }

  async create() {
    await this.connectToRoom();

    // Pointer → world coords (robust to camera transforms)
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.mouseWorld.x = p.x;
      this.mouseWorld.y = p.y;
    });

    this.room.onLeave(() => this.cleanupAll());
  }

  update(_time: number, delta: number): void {
    if (!this.currentPlayer || !this.room) return;

    this.elapsedTime += delta;
    while (this.elapsedTime >= this.fixedTimeStep) {
      this.elapsedTime -= this.fixedTimeStep;
      this.fixedTick();
    }
  }

  /* =========================================
   * Fixed update (deterministic)
   * =======================================*/

  private fixedTick(): void {
    // 1) Smooth target (EMA on mouse)
    this.smoothMouseTarget();

    // 2) Compute desired velocity toward target
    const desired = this.computeDesiredVelocity();

    // 3) Smooth velocity (EMA)
    const vel = this.applyVelocitySmoothing(desired);

    // 4) Client-side prediction move + bounds
    this.applyLocalMove(vel);

    // 5) Send input to server
    this.sendInput(vel);

    // 6) Continuous reconciliation toward last server pos
    this.reconcileSelf();

    // 7) Interpolate remote players
    this.interpolateRemotes();
  }

  /* =========================================
   * Setup / Colyseus wiring
   * =======================================*/

  private async connectToRoom(): Promise<void> {
    this.room = await this.client.joinOrCreate(CONFIG.server.roomName);
    const $ = getStateCallbacks(this.room);

    $(this.room.state).players.onAdd((player: any, sessionId: string) => {
      const sprite = this.spawnPlayerSprite(player.x, player.y);
      this.playerEntities[sessionId] = sprite;

      if (sessionId === this.room.sessionId) {
        this.currentPlayer = sprite;
        this.remoteRef = this.add.rectangle(0, 0, sprite.width, sprite.height)
          .setStrokeStyle(1, 0xff0000);

        // Record server truth but reconcile inside fixedTick for smoothness
        $(player).onChange(() => {
          this.lastServerPos.x = player.x;
          this.lastServerPos.y = player.y;
          this.haveServerPos = true;

          if (this.remoteRef) {
            this.remoteRef.x = player.x;
            this.remoteRef.y = player.y;
          }
        });
      } else {
        // Remote players: store server target positions inside sprite data
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

  /* =========================================
   * Movement helpers
   * =======================================*/

  private smoothMouseTarget(): void {
    const a = CONFIG.move.targetAlpha;

    // Initialize on first frame to avoid a jump
    if (this.smoothedMouse.x === 0 && this.smoothedMouse.y === 0) {
      this.smoothedMouse.x = this.mouseWorld.x;
      this.smoothedMouse.y = this.mouseWorld.y;
      return;
    }

    this.smoothedMouse.x = Phaser.Math.Linear(this.smoothedMouse.x, this.mouseWorld.x, a);
    this.smoothedMouse.y = Phaser.Math.Linear(this.smoothedMouse.y, this.mouseWorld.y, a);
  }

  private computeDesiredVelocity(): Vec2 {
    const p = this.currentPlayer!;
    const dx = this.smoothedMouse.x - p.x;
    const dy = this.smoothedMouse.y - p.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= CONFIG.move.deadZone) return { x: 0, y: 0 };

    const nx = dx / dist;
    const ny = dy / dist;
    const desiredSpeed = Math.min(CONFIG.move.maxSpeedPerTick, dist * CONFIG.move.followGain);

    return { x: nx * desiredSpeed, y: ny * desiredSpeed };
  }

  private applyVelocitySmoothing(desired: Vec2): Vec2 {
    const a = CONFIG.move.velAlpha;
    const vx = Phaser.Math.Linear(this.prevVel.x, desired.x, a);
    const vy = Phaser.Math.Linear(this.prevVel.y, desired.y, a);
    this.prevVel.x = vx;
    this.prevVel.y = vy;
    return { x: vx, y: vy };
  }

  private applyLocalMove(vel: Vec2): void {
    const p = this.currentPlayer!;
    p.x += vel.x;
    p.y += vel.y;
    this.clampToWorldBounds(p);
  }

  private sendInput(vel: Vec2): void {
    this.inputPayload.x = vel.x; // keep payload shape simple & typed
    this.inputPayload.y = vel.y;
    // But server expects vx/vy; send as such to avoid breaking server code
    this.room.send(0, { vx: vel.x, vy: vel.y });
  }

  private reconcileSelf(): void {
    if (!this.haveServerPos || !this.currentPlayer) return;

    const p = this.currentPlayer;
    const sx = this.lastServerPos.x;
    const sy = this.lastServerPos.y;
    const err = Math.hypot(sx - p.x, sy - p.y);

    const { smallErrPx, snapErrPx, alpha } = CONFIG.reconcile;

    if (err > snapErrPx) {
      // Big divergence → snap & kill momentum
      p.x = sx; p.y = sy;
      this.prevVel.x = 0; this.prevVel.y = 0;
      return;
    }
    if (err > smallErrPx) {
      // Gentle continuous blend toward server
      p.x = Phaser.Math.Linear(p.x, sx, alpha);
      p.y = Phaser.Math.Linear(p.y, sy, alpha);
    }
  }

  private interpolateRemotes(): void {
    const a = CONFIG.remote.lerpAlpha;
    for (const id in this.playerEntities) {
      if (id === this.room.sessionId) continue;
      const e = this.playerEntities[id];
      if (!e) continue;

      // these were set in onChange above
      const data = e.data?.values as any;
      const serverX = data?.serverX;
      const serverY = data?.serverY;
      if (typeof serverX !== "number" || typeof serverY !== "number") continue;

      e.x = Phaser.Math.Linear(e.x, serverX, a);
      e.y = Phaser.Math.Linear(e.y, serverY, a);
    }
  }

  /* =========================================
   * Entity helpers
   * =======================================*/

  private spawnPlayerSprite(x: number, y: number): PlayerSprite {
    const sprite = this.physics.add.image(x, y, CONFIG.assets.ship);
    return sprite;
  }

  private removePlayerSprite(sessionId: string): void {
    const sprite = this.playerEntities[sessionId];
    if (sprite) sprite.destroy();
    delete this.playerEntities[sessionId];

    if (sessionId === this.room.sessionId) {
      this.currentPlayer = undefined;
      if (this.remoteRef) this.remoteRef.destroy();
    }
  }

  private clampToWorldBounds(p: PlayerSprite): void {
    const { width, height } = CONFIG.world;
    if (p.x < 0) p.x = 0; else if (p.x > width) p.x = width;
    if (p.y < 0) p.y = 0; else if (p.y > height) p.y = height;
  }

  private cleanupAll(): void {
    Object.values(this.playerEntities).forEach((e) => e && e.destroy());
    this.playerEntities = {};
    if (this.remoteRef) this.remoteRef.destroy();
    this.currentPlayer = undefined;
  }
}

/* =========================================
 * Game bootstrap
 * =======================================*/

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: CONFIG.world.width,
  height: CONFIG.world.height,
  backgroundColor: "#b6d53c",
  parent: "phaser-example",
  physics: { default: "arcade" },
  pixelArt: true,
  scene: [GameScene],
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const game = new Phaser.Game(config);
