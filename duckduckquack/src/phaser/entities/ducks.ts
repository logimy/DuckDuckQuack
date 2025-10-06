/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";
import { CONFIG } from "../config";

/**
 * Duck view data for client-side rendering and smoothing
 */
export type DuckView = {
  node: Phaser.GameObjects.Arc;
  tx: number;
  ty: number;
  panicUntil?: number;     // Server-sent panic window timestamp
  nextQuackAt?: number;    // Local schedule for next quack sound
};

/**
 * Manages duck rendering, smoothing, and audio effects
 */
export class DucksLayer {
  private scene: Phaser.Scene;
  private views: Record<string, DuckView> = {};
  private readonly quackKeys = ["quack01", "quack02", "quack03"];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Adds a new duck to the scene
   */
  onAdd = (key: string, duck: any) => {
    const circle = this.scene.add.circle(
      duck.x,
      duck.y,
      CONFIG.ducks.radius,
      colorToHex(duck.color),
      1
    );
    circle.setStrokeStyle(1, 0x000000, 0.5);
    circle.setDepth(CONFIG.ducks.depth);
    
    this.views[key] = {
      node: circle,
      tx: duck.x,
      ty: duck.y,
      panicUntil: duck.panicUntil ?? 0,
      nextQuackAt: undefined,
    };
    this.applyVisual(key, duck);
  };

  /**
   * Updates duck position and state
   */
  onChange = (key: string, duck: any) => {
    const view = this.views[key];
    if (!view) return;
    
    view.tx = duck.x;
    view.ty = duck.y;
    view.panicUntil = duck.panicUntil ?? 0;
    this.applyVisual(key, duck);
  };

  /**
   * Removes a duck from the scene
   */
  onRemove = (key: string) => {
    const view = this.views[key];
    if (!view) return;
    
    view.node.destroy();
    delete this.views[key];
  };

  /**
   * Smoothly interpolates all duck visuals toward server coordinates
   */
  tickLerp(alpha = CONFIG.ducks.lerpAlpha) {
    for (const view of Object.values(this.views)) {
      const newX = Phaser.Math.Linear(view.node.x, view.tx, alpha);
      const newY = Phaser.Math.Linear(view.node.y, view.ty, alpha);
      view.node.setPosition(newX, newY);
    }
  }

  /**
   * Plays quack sounds for panicking ducks with random timing
   */
  tickAudio() {
    const now = Date.now();
  
    for (const view of Object.values(this.views)) {
      const isPanicking = !!(view.panicUntil && view.panicUntil > now);
      
      if (!isPanicking) {
        // Reset schedule when panic ends
        view.nextQuackAt = undefined;
        continue;
      }
  
      if (view.nextQuackAt === undefined) {
        // First frame after entering panic - quack immediately
        this.playQuackFor(view);
        view.nextQuackAt = now + this.randInt(500, 1500);
        continue;
      }
  
      if (now >= view.nextQuackAt) {
        this.playQuackFor(view);
        view.nextQuackAt = now + this.randInt(500, 1500);
      }
    }
  }

  /**
   * Removes all ducks from the scene
   */
  clear() {
    for (const key of Object.keys(this.views)) {
      this.onRemove(key);
    }
  }

  /**
   * Applies visual effects based on duck state (panic animation)
   */
  private applyVisual(key: string, duck: any) {
    const view = this.views[key];
    if (!view) return;
    
    const now = Date.now();
    const isPanicking = duck.panicUntil && duck.panicUntil > now;
    
    if (isPanicking) {
      const pulse = 1 + 0.06 * Math.sin(now / 60);
      view.node.setScale(pulse);
      view.node.setAlpha(0.95);
    } else {
      view.node.setScale(1);
      view.node.setAlpha(1);
    }
  }

  /**
   * Plays a quack sound with randomized parameters for natural variation
   */
  private playQuackFor(view: DuckView) {
    const key = this.quackKeys[(Math.random() * this.quackKeys.length) | 0];
  
    // Randomize audio parameters for natural variation
    const volume = 0.08 + Math.random() * 0.07;  // 0.08-0.15
    const rate = 0.9 + Math.random() * 0.25;     // 0.9-1.15 (speed + pitch)
    const detune = (Math.random() * 400 - 200) | 0; // ±200 cents
  
    // Stereo pan based on duck position
    const pan = Phaser.Math.Clamp(
      (view.node.x / CONFIG.world.width) * 2 - 1,
      -1, 1
    ) * 0.6;
  
    const sound = this.scene.sound.add(key, { volume, rate, detune });
    (sound as any).setPan?.(pan);
  
    sound.once("complete", () => sound.destroy());
    sound.play();
  }

  /**
   * Generates a random integer between min and max (inclusive)
   */
  private randInt(minMs: number, maxMs: number): number {
    return (Math.random() * (maxMs - minMs) + minMs) | 0;
  }
}

/**
 * Converts color (hex string or name) to hex value
 */
function colorToHex(color: string): number {
  // If it's already a hex color, convert it
  if (color.startsWith('#')) {
    return parseInt(color.slice(1), 16);
  }
  
  // Fallback to color names for backward compatibility
  switch (color) {
    case "red":    return 0xff4d4f;
    case "green":  return 0x52c41a;
    case "blue":   return 0x1677ff;
    case "yellow": return 0xffff00;
    case "purple": return 0x722ed1;
    default:       return 0xaaaaaa;
  }
}
