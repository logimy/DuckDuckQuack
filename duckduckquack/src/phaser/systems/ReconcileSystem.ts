import Phaser from "phaser";
import { CONFIG } from "../config";
import type { Vec2, PlayerSprite } from "../types";

/** Soft reconciliation to server position with snap threshold. */
export class ReconcileSystem {
  private player?: PlayerSprite;
  private last: Vec2 = { x: 0, y: 0 };
  private have = false;

  setPlayer(p?: PlayerSprite) { this.player = p; }
  setServerPos(x: number, y: number) { this.last.x = x; this.last.y = y; this.have = true; }

  step() {
    if (!this.have || !this.player) return;
    const p = this.player;
    const { smallErrPx, snapErrPx, alpha } = CONFIG.reconcile;
    const err = Math.hypot(this.last.x - p.x, this.last.y - p.y);
    if (err > snapErrPx) { p.x = this.last.x; p.y = this.last.y; }
    else if (err > smallErrPx) {
      p.x = Phaser.Math.Linear(p.x, this.last.x, alpha);
      p.y = Phaser.Math.Linear(p.y, this.last.y, alpha);
    }
  }
}
