import Phaser from "phaser";
import { CONFIG } from "../config";
import type { Vec2, PlayerSprite } from "../types";

/**
 * Handles client-server position reconciliation with snap threshold
 */
export class ReconcileSystem {
  private player?: PlayerSprite;
  private lastServerPosition: Vec2 = { x: 0, y: 0 };
  private hasServerPosition = false;

  setPlayer(player?: PlayerSprite) { 
    this.player = player; 
  }

  setServerPos(x: number, y: number) { 
    this.lastServerPosition.x = x; 
    this.lastServerPosition.y = y; 
    this.hasServerPosition = true; 
  }

  /**
   * Performs one step of position reconciliation
   */
  step() {
    if (!this.hasServerPosition || !this.player) return;
    
    const player = this.player;
    const { smallErrPx, snapErrPx, alpha } = CONFIG.reconcile;
    const error = Math.hypot(
      this.lastServerPosition.x - player.x, 
      this.lastServerPosition.y - player.y
    );
    
    if (error > snapErrPx) {
      // Snap to server position for large errors
      player.x = this.lastServerPosition.x; 
      player.y = this.lastServerPosition.y; 
    } else if (error > smallErrPx) {
      // Smoothly interpolate for medium errors
      player.x = Phaser.Math.Linear(player.x, this.lastServerPosition.x, alpha);
      player.y = Phaser.Math.Linear(player.y, this.lastServerPosition.y, alpha);
    }
  }
}
