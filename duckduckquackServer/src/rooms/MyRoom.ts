import { Room, Client } from "@colyseus/core";
import { MyRoomState, Player, Duck } from "./schema/MyRoomState";

/** ====================== Config & Types ====================== */
type InputVec = { vx: number; vy: number };

const CONFIG = {
  WORLD: { WIDTH: 800, HEIGHT: 800 },
  NET:   { FIXED_HZ: 60 },

  MOVE:  { MAX_SPEED_PER_TICK: 7, EPS: 1e-6 },

  DUCK: {
    RADIUS: 10,
    SPEED_SOLO: 0.4,
    SPEED_GROUP_EQUAL: 0.05,
    SPEED_GROUP_BIGGER: 0.1,
    SPEED_FLEE: 7,

    MAX_ACCEL: 0.15,
    FLEE_ACCEL: 0.35,
    FLEE_EASE_EXP: 2.0,
    FLEE_MIN_FACTOR: 0.0,

    MERGE_RADIUS: 16,
    STICK_RADIUS: 26,
    BORDER_BUFFER: 30,
    PANIC_RADIUS: 180,
    PANIC_COOLDOWN_MS: 200,
    MERGE_LOCK_MS: 600,
    COLORS: ["red", "green", "blue", "yellow"],
    START_PER_COLOR: 4,
    START_SPREAD: 40,
  },
} as const;

type Group = {
  id: number;
  members: string[];
  size: number;
  cx: number; cy: number;
  vx: number; vy: number;
  targetId?: number;
  lockUntil: number;
};

/** ====================== Small helpers ====================== */
const hypot = Math.hypot;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const norm2 = (x: number, y: number) => {
  const m = hypot(x, y) || 1;
  return [x / m, y / m, m] as const;
};
const accelToward = (vx: number, vy: number, tx: number, ty: number, cap: number) => {
  let ax = tx - vx, ay = ty - vy;
  const a = hypot(ax, ay);
  if (a > cap) { const k = cap / a; ax *= k; ay *= k; }
  return [vx + ax, vy + ay] as const;
};

export class MyRoom extends Room<MyRoomState> {
  maxClients = 4;

  private elapsedCarry = 0;
  private groupSeq = 1;

  /** ====================== Lifecycle ====================== */
  onCreate(): void {
    this.setState(new MyRoomState());
    this.spawnInitialDucks();

    const step = 1000 / CONFIG.NET.FIXED_HZ;
    this.setSimulationInterval((dt) => {
      this.elapsedCarry += dt;
      while (this.elapsedCarry >= step) {
        this.elapsedCarry -= step;
        this.fixedTick();
      }
    });

    this.onMessage<InputVec>(0, (client, payload) => this.handleInput(client, payload));
  }

  onJoin(client: Client): void {
    const p = new Player();
    p.x = Math.floor(Math.random() * CONFIG.WORLD.WIDTH);
    p.y = Math.floor(Math.random() * CONFIG.WORLD.HEIGHT);
    this.state.players.set(client.sessionId, p);
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
  }

  onDispose(): void {
    /* noop */
  }

  /** ====================== Players ====================== */
  private handleInput(client: Client, payload?: Partial<InputVec>): void {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;

    const vx = Number(payload?.vx), vy = Number(payload?.vy);
    if (!Number.isFinite(vx) || !Number.isFinite(vy)) return;

    const q = p.inputQueue as InputVec[];
    q.push({ vx, vy });
    if (q.length > 4) q.splice(0, q.length - 4);
  }

  private dequeueLatestInput(p: Player): InputVec | undefined {
    const q = p.inputQueue as InputVec[];
    return q.pop();
  }

  private sanitizeInput({ vx, vy }: InputVec): InputVec {
    const mag = hypot(vx, vy);
    if (mag < CONFIG.MOVE.EPS) return { vx: 0, vy: 0 };
    if (mag > CONFIG.MOVE.MAX_SPEED_PER_TICK) {
      const k = CONFIG.MOVE.MAX_SPEED_PER_TICK / mag;
      return { vx: vx * k, vy: vy * k };
    }
    return { vx, vy };
  }

  private movePlayer(p: Player, vx: number, vy: number) {
    p.x += vx; p.y += vy;
    this.clampToWorld(p);
  }

  private clampToWorld(p: Player): void {
    const { WIDTH: W, HEIGHT: H } = CONFIG.WORLD;
    p.x = clamp(p.x, 0, W);
    p.y = clamp(p.y, 0, H);
  }

  /** ====================== Ducks: spawn & grouping ====================== */
  private spawnInitialDucks(): void {
    const { WIDTH: W, HEIGHT: H } = CONFIG.WORLD;
    const cx = W / 2, cy = H / 2;
    const jitter = CONFIG.DUCK.START_SPREAD;

    for (const color of CONFIG.DUCK.COLORS) {
      for (let i = 0; i < CONFIG.DUCK.START_PER_COLOR; i++) {
        const d = new Duck();
        d.color = color;
        d.x = cx + (Math.random() * 2 - 1) * jitter;
        d.y = cy + (Math.random() * 2 - 1) * jitter;
        d.vx = 0; d.vy = 0; d.panicUntil = 0;
        this.state.ducks.set(`${color}-${i}-${Math.random().toString(36).slice(2, 6)}`, d);
      }
    }
  }

  /** Connected components by STICK_RADIUS (panicking ducks are excluded) */
  private buildGroups(now: number): Group[] {
    const keys = Array.from(this.state.ducks.keys());
    const seen = new Set<string>();
    const groups: Group[] = [];
    const R2 = CONFIG.DUCK.STICK_RADIUS * CONFIG.DUCK.STICK_RADIUS;

    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (seen.has(k)) continue;
      const d0 = this.state.ducks.get(k)!;
      if (d0.panicUntil > now) { seen.add(k); continue; }

      const q = [k];
      const members: string[] = [];
      seen.add(k);

      while (q.length) {
        const dk = q.pop()!;
        const di = this.state.ducks.get(dk)!;
        if (di.panicUntil > now) continue;

        members.push(dk);

        for (let j = 0; j < keys.length; j++) {
          const nk = keys[j];
          if (seen.has(nk)) continue;
          const dj = this.state.ducks.get(nk)!;
          if (dj.panicUntil > now) continue;

          const dx = dj.x - di.x, dy = dj.y - di.y;
          if (dx * dx + dy * dy <= R2) {
            seen.add(nk);
            q.push(nk);
          }
        }
      }

      if (members.length >= 2) {
        let sx = 0, sy = 0;
        for (const mk of members) { const m = this.state.ducks.get(mk)!; sx += m.x; sy += m.y; }
        const cx = sx / members.length, cy = sy / members.length;
        groups.push({ id: this.groupSeq++, members, size: members.length, cx, cy, vx: 0, vy: 0, lockUntil: 0 });
      }
    }
    return groups;
  }

  /** Nearest group with size >= mine (tie: larger size, then lower id) */
  private chooseTargetGroup(me: Group, groups: Group[], now: number): Group | undefined {
    let best: Group | undefined;
    let bestD2 = Infinity;

    for (const g of groups) {
      if (g.id === me.id || g.size < me.size) continue;
      const dx = g.cx - me.cx, dy = g.cy - me.cy;
      const d2 = dx * dx + dy * dy;

      if (d2 < bestD2) { bestD2 = d2; best = g; }
      else if (d2 === bestD2 && best && (g.size > best.size || (g.size === best.size && g.id < best.id))) {
        best = g;
      }
    }
    return best;
  }

  /** ====================== Ducks: physics & AI ====================== */
  private applyPerDuckFlee(now: number): void {
    const players = Array.from(this.state.players.values());
    if (!players.length) return;

    const PR = CONFIG.DUCK.PANIC_RADIUS;
    const fleeMax = CONFIG.DUCK.SPEED_FLEE;
    const accelCap = CONFIG.DUCK.FLEE_ACCEL;
    const exp = CONFIG.DUCK.FLEE_EASE_EXP;
    const minFactor = CONFIG.DUCK.FLEE_MIN_FACTOR;
    const minFlee = CONFIG.DUCK.SPEED_SOLO;

    for (const d of this.state.ducks.values()) {
      let rx = 0, ry = 0;
      let nearest = Infinity;
      let anyInPR = false;

      let sumPx = 0, sumPy = 0;

      for (const p of players) {
        const dx = d.x - p.x;
        const dy = d.y - p.y;
        const r = Math.hypot(dx, dy) || 1;

        sumPx += p.x; sumPy += p.y;

        if (r <= PR) anyInPR = true;
        if (r < nearest) nearest = r;

        // Quadratic falloff inside pr; zero outside
        // t = 1 at r=0, t = 0 at r=PR
        const t = clamp(1 - r / PR, 0, 1);
        const w = t * t;

        rx += (dx / r) * w;
        ry += (dy / r) * w;
      }

      if (anyInPR) d.panicUntil = now + CONFIG.DUCK.PANIC_COOLDOWN_MS;

      if (d.panicUntil > now) {
        if (Math.abs(rx) + Math.abs(ry) < 1e-3 && players.length > 1) {
          const cx = sumPx / players.length;
          const cy = sumPy / players.length;
          rx = d.x - cx;
          ry = d.y - cy;
        }

        if (rx !== 0 || ry !== 0) {
          const [nx, ny] = norm2(rx, ry);

          const tNear = clamp(1 - nearest / PR, 0, 1);
          const factor = Math.max(minFactor, Math.pow(tNear, exp));
          const targetSpeed = Math.max(minFlee, fleeMax * factor);

          const tx = nx * targetSpeed;
          const ty = ny * targetSpeed;

          [d.vx, d.vy] = accelToward(d.vx, d.vy, tx, ty, accelCap);
        }
      }
    }
  }

  /** Push apart overlapping ducks, apply border bias & clamps */
  private resolveDuckCollisionsAndBorders(): void {
    const keys = Array.from(this.state.ducks.keys());
    const R = CONFIG.DUCK.RADIUS;
    const sumR = R * 2, sumR2 = sumR * sumR;
    const { WIDTH: W, HEIGHT: H } = CONFIG.WORLD;
    const B = CONFIG.DUCK.BORDER_BUFFER;

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < keys.length; i++) {
        const ki = keys[i], di = this.state.ducks.get(ki)!;

        // duck-duck separation
        for (let j = i + 1; j < keys.length; j++) {
          const kj = keys[j], dj = this.state.ducks.get(kj)!;
          const dx = dj.x - di.x, dy = dj.y - di.y, d2 = dx * dx + dy * dy;
          if (d2 > 0 && d2 < sumR2) {
            const d = Math.sqrt(d2) || 1;
            const overlap = sumR - d;
            const nx = dx / d, ny = dy / d;
            const push = overlap * 0.5;
            di.x -= nx * push; di.y -= ny * push;
            dj.x += nx * push; dj.y += ny * push;
          }
        }

        // soft inward bias
        if (di.x < B) di.vx += (B - di.x) * 0.01;
        else if (di.x > W - B) di.vx -= (di.x - (W - B)) * 0.01;
        if (di.y < B) di.vy += (B - di.y) * 0.01;
        else if (di.y > H - B) di.vy -= (di.y - (H - B)) * 0.01;

        // hard clamp + damp outward velocity
        if (di.x < R) { di.x = R; if (di.vx < 0) di.vx *= 0.3; }
        if (di.x > W - R) { di.x = W - R; if (di.vx > 0) di.vx *= 0.3; }
        if (di.y < R) { di.y = R; if (di.vy < 0) di.vy *= 0.3; }
        if (di.y > H - R) { di.y = H - R; if (di.vy > 0) di.vy *= 0.3; }
      }
    }
  }

  /** ====================== Fixed update ====================== */
  private fixedTick(): void {
    const now = Date.now();

    // 1) Players
    this.state.players.forEach((p) => {
      const input = this.dequeueLatestInput(p);
      if (!input) return;
      const { vx, vy } = this.sanitizeInput(input);
      this.movePlayer(p, vx, vy);
    });

    // 2) Ducks: per-duck flee
    this.applyPerDuckFlee(now);

    // 3) Groups (exclude panicking ducks)
    const groups = this.buildGroups(now);

    // set group goals/velocities
    for (const g of groups) {
      if (g.lockUntil > now) continue;
      const tgt = this.chooseTargetGroup(g, groups, now);
      if (!tgt) { g.vx = 0; g.vy = 0; g.targetId = undefined; continue; }

      const [nx, ny] = norm2(tgt.cx - g.cx, tgt.cy - g.cy);
      const same = tgt.size === g.size;
      const speed = same ? CONFIG.DUCK.SPEED_GROUP_EQUAL : CONFIG.DUCK.SPEED_GROUP_BIGGER;
      g.vx = nx * speed; g.vy = ny * speed;
      g.targetId = tgt.id;
      g.lockUntil = now + CONFIG.DUCK.MERGE_LOCK_MS;
    }

    // 4) Solo seekers (non-panic, non-grouped) chase nearest duck/group
    const grouped = new Set(groups.flatMap((g) => g.members));
    const duckKeys = Array.from(this.state.ducks.keys());

    for (const dk of duckKeys) {
      const d = this.state.ducks.get(dk)!;
      if (d.panicUntil > now || grouped.has(dk)) continue;

      let bestX = 0, bestY = 0, bestD2 = Infinity;

      // nearest non-panicking duck
      for (const ok of duckKeys) {
        if (ok === dk) continue;
        const o = this.state.ducks.get(ok)!;
        if (o.panicUntil > now) continue;
        const dx = o.x - d.x, dy = o.y - d.y, d2 = dx * dx + dy * dy;
        if (d2 < bestD2) { bestD2 = d2; bestX = dx; bestY = dy; }
      }
      // nearest group centroid
      for (const g of groups) {
        const dx = g.cx - d.x, dy = g.cy - d.y, d2 = dx * dx + dy * dy;
        if (d2 < bestD2) { bestD2 = d2; bestX = dx; bestY = dy; }
      }

      if (bestD2 < Infinity) {
        const [nx, ny] = norm2(bestX, bestY);
        const tx = nx * CONFIG.DUCK.SPEED_SOLO;
        const ty = ny * CONFIG.DUCK.SPEED_SOLO;
        [d.vx, d.vy] = accelToward(d.vx, d.vy, tx, ty, CONFIG.DUCK.MAX_ACCEL);
      }
    }

    // 5) Apply group velocities to members (panicking members ignore)
    for (const g of groups) {
      for (const mk of g.members) {
        const m = this.state.ducks.get(mk)!;
        if (m.panicUntil > now) continue;
        [m.vx, m.vy] = accelToward(m.vx, m.vy, g.vx, g.vy, CONFIG.DUCK.MAX_ACCEL);
      }
    }

    // 6) Integrate duck positions
    for (const d of this.state.ducks.values()) { d.x += d.vx; d.y += d.vy; }

    // 7) Collisions & borders
    this.resolveDuckCollisionsAndBorders();
  }
}
