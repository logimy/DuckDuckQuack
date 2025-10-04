import { Room, Client } from "@colyseus/core";
import { MyRoomState, Player } from "./schema/MyRoomState";

/** ============================================================
 * Types & Config
 * ========================================================== */
type InputVec = { vx: number; vy: number }; // client sends { vx, vy }

const CONFIG = {
  WORLD: { WIDTH: 800, HEIGHT: 800 },
  NET: { FIXED_HZ: 60 },                       // server fixed-step
  MOVE: { MAX_SPEED_PER_TICK: 7, EPS: 1e-6 },  // authoritative limits
  INPUT: { MAX_QUEUE: 4 },                     // keep last few inputs only
} as const;

/** ============================================================
 * Room
 * ========================================================== */
export class MyRoom extends Room<MyRoomState> {
  maxClients = 4;

  /** carry-over time for fixed-step integration */
  private elapsedCarry = 0;

  onCreate(): void {
    // prefer setState over field initializer for clarity
    this.setState(new MyRoomState());

    // fixed-step simulation at CONFIG.NET.FIXED_HZ
    const fixedTimeStep = 1000 / CONFIG.NET.FIXED_HZ;
    this.setSimulationInterval((deltaMs) => {
      this.elapsedCarry += deltaMs;
      while (this.elapsedCarry >= fixedTimeStep) {
        this.elapsedCarry -= fixedTimeStep;
        this.fixedTick();
      }
    });

    // handle player input (authoritative server: don't move here)
    this.onMessage<InputVec>(0, (client, payload) => this.handleInput(client, payload));
  }

  /** Core deterministic update executed at fixed Hz */
  private fixedTick(): void {
    this.state.players.forEach((player) => {
      const input = this.dequeueLatestInput(player);
      if (!input) return;

      const { vx, vy } = this.sanitizeInput(input);

      // Apply movement
      player.x += vx;
      player.y += vy;

      // Keep inside world bounds
      this.clampToWorld(player);
    });
  }

  /** ==========================================================
   * Message / Input handling
   * ======================================================== */
  private handleInput(client: Client, payload: Partial<InputVec> | undefined): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    // Coerce to numbers, drop nonsense early
    const vx = Number(payload?.vx);
    const vy = Number(payload?.vy);
    if (!Number.isFinite(vx) || !Number.isFinite(vy)) return;

    // Cap input queue size (keep last few freshest inputs)
    const q = player.inputQueue as InputVec[];
    if (q.length >= CONFIG.INPUT.MAX_QUEUE) {
      // drop the oldest
      q.shift();
    }
    q.push({ vx, vy });
  }

  /** Pull only the latest input for this tick (coalesces bursts) */
  private dequeueLatestInput(player: Player): InputVec | undefined {
    const q = player.inputQueue as InputVec[];
    if (q.length === 0) return undefined;

    // discard all but last
    while (q.length > 1) q.shift();
    return q.shift();
  }

  /** Sanitize, clamp magnitude to server's authoritative limit */
  private sanitizeInput(input: InputVec): InputVec {
    let { vx, vy } = input;

    // clamp vector magnitude
    const max = CONFIG.MOVE.MAX_SPEED_PER_TICK;
    const mag = Math.hypot(vx, vy);

    if (mag > max) {
      const k = max / mag;
      vx *= k;
      vy *= k;
    } else if (mag < CONFIG.MOVE.EPS) {
      vx = 0;
      vy = 0;
    }

    return { vx, vy };
  }

  /** Keep player within world rectangle */
  private clampToWorld(player: Player): void {
    const W = CONFIG.WORLD.WIDTH;
    const H = CONFIG.WORLD.HEIGHT;

    if (player.x < 0) player.x = 0;
    else if (player.x > W) player.x = W;

    if (player.y < 0) player.y = 0;
    else if (player.y > H) player.y = H;
  }

  /** ==========================================================
   * Lifecycle
   * ======================================================== */
  onJoin(client: Client /*, options: any */): void {
    console.log(client.sessionId, "joined!");

    const p = new Player();
    p.x = Math.floor(Math.random() * CONFIG.WORLD.WIDTH);
    p.y = Math.floor(Math.random() * CONFIG.WORLD.HEIGHT);

    this.state.players.set(client.sessionId, p);
  }

  onLeave(client: Client /*, consented: boolean */): void {
    console.log(client.sessionId, "left!");
    this.state.players.delete(client.sessionId);
  }

  onDispose(): void {
    console.log("room", this.roomId, "disposing...");
  }
}
