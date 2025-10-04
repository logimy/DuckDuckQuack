import Phaser from "phaser";
import { CONFIG } from "../config";
import type { Vec2, PlayerSprite } from "../types";
import { clampToWorldBounds } from "../entities/players";

/** Handles target smoothing, velocity shaping and local integration. */
export class MovementSystem {
  private player?: PlayerSprite;
  private locked = false;

  private mouseWorld: Vec2 = { x: 0, y: 0 };
  private smoothed: Vec2 = { x: 0, y: 0 };
  private prevVel: Vec2 = { x: 0, y: 0 };

  setPlayer(p?: PlayerSprite) { this.player = p; }
  setLocked(v: boolean) { this.locked = v; if (!v) this.prevVel = { x:0, y:0 }; }

  setMouseWorld(x: number, y: number) {
    this.mouseWorld.x = x; this.mouseWorld.y = y;
  }

  /** One fixed tick: returns velocity applied to the player. */
  step(): Vec2 {
    if (!this.player) return { x: 0, y: 0 };
    this.smoothTarget();
    const desired = this.computeDesiredVelocity();
    const vel = this.smoothVelocity(desired);
    this.integrate(vel);
    return vel;
  }

  private smoothTarget() {
    const a = CONFIG.move.targetAlpha;
    if (this.smoothed.x === 0 && this.smoothed.y === 0) {
      this.smoothed.x = this.mouseWorld.x; this.smoothed.y = this.mouseWorld.y; return;
    }
    this.smoothed.x = Phaser.Math.Linear(this.smoothed.x, this.mouseWorld.x, a);
    this.smoothed.y = Phaser.Math.Linear(this.smoothed.y, this.mouseWorld.y, a);
  }

  private computeDesiredVelocity(): Vec2 {
    if (!this.locked || !this.player) return { x: 0, y: 0 };
    const p = this.player, dx = this.smoothed.x - p.x, dy = this.smoothed.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= CONFIG.move.deadZone) return { x: 0, y: 0 };
    const nx = dx / dist, ny = dy / dist;
    const speed = Math.min(CONFIG.move.maxSpeedPerTick, dist * CONFIG.move.followGain);
    return { x: nx * speed, y: ny * speed };
    }

  private smoothVelocity(desired: Vec2): Vec2 {
    const a = CONFIG.move.velAlpha;
    const vx = Phaser.Math.Linear(this.prevVel.x, desired.x, a);
    const vy = Phaser.Math.Linear(this.prevVel.y, desired.y, a);
    this.prevVel = { x: vx, y: vy };
    return this.prevVel;
  }

  private integrate(vel: Vec2) {
    if (!this.player) return;
    this.player.x += vel.x; this.player.y += vel.y;
    clampToWorldBounds(this.player);
  }
}
