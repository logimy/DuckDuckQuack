import Phaser from "phaser";
import { CONFIG } from "../config";
import type { Vec2, PlayerSprite } from "../types";
import { clampToWorldBounds } from "../entities/players";

/**
 * Handles player movement with target smoothing, velocity shaping, and local integration
 */
export class MovementSystem {
  private player?: PlayerSprite;
  private isLocked = false;

  private mouseWorld: Vec2 = { x: 0, y: 0 };
  private smoothedTarget: Vec2 = { x: 0, y: 0 };
  private previousVelocity: Vec2 = { x: 0, y: 0 };

  setPlayer(player?: PlayerSprite) { 
    this.player = player; 
  }

  setLocked(locked: boolean) { 
    this.isLocked = locked; 
    if (!locked) this.previousVelocity = { x: 0, y: 0 }; 
  }

  setMouseWorld(x: number, y: number) {
    this.mouseWorld.x = x; 
    this.mouseWorld.y = y;
  }

  /**
   * Performs one fixed timestep of movement simulation
   */
  step(): Vec2 {
    if (!this.player) return { x: 0, y: 0 };
    
    this.smoothTarget();
    const desiredVelocity = this.computeDesiredVelocity();
    const velocity = this.smoothVelocity(desiredVelocity);
    this.integrate(velocity);
    
    return velocity;
  }

  /**
   * Smoothly interpolates the target position
   */
  private smoothTarget() {
    const alpha = CONFIG.move.targetAlpha;
    
    if (this.smoothedTarget.x === 0 && this.smoothedTarget.y === 0) {
      this.smoothedTarget.x = this.mouseWorld.x; 
      this.smoothedTarget.y = this.mouseWorld.y; 
      return;
    }
    
    this.smoothedTarget.x = Phaser.Math.Linear(this.smoothedTarget.x, this.mouseWorld.x, alpha);
    this.smoothedTarget.y = Phaser.Math.Linear(this.smoothedTarget.y, this.mouseWorld.y, alpha);
  }

  /**
   * Computes desired velocity based on target position
   */
  private computeDesiredVelocity(): Vec2 {
    if (!this.isLocked || !this.player) return { x: 0, y: 0 };
    
    const player = this.player;
    const deltaX = this.smoothedTarget.x - player.x;
    const deltaY = this.smoothedTarget.y - player.y;
    const distance = Math.hypot(deltaX, deltaY);
    
    if (distance <= CONFIG.move.deadZone) return { x: 0, y: 0 };
    
    const normalizedX = deltaX / distance;
    const normalizedY = deltaY / distance;
    const speed = Math.min(CONFIG.move.maxSpeedPerTick, distance * CONFIG.move.followGain);
    
    return { 
      x: normalizedX * speed, 
      y: normalizedY * speed 
    };
  }

  /**
   * Smooths velocity changes to prevent jittery movement
   */
  private smoothVelocity(desired: Vec2): Vec2 {
    const alpha = CONFIG.move.velAlpha;
    const velocityX = Phaser.Math.Linear(this.previousVelocity.x, desired.x, alpha);
    const velocityY = Phaser.Math.Linear(this.previousVelocity.y, desired.y, alpha);
    
    this.previousVelocity = { x: velocityX, y: velocityY };
    return this.previousVelocity;
  }

  /**
   * Applies velocity to player position and clamps to world bounds
   */
  private integrate(velocity: Vec2) {
    if (!this.player) return;
    
    this.player.x += velocity.x; 
    this.player.y += velocity.y;
    clampToWorldBounds(this.player);
  }
}
