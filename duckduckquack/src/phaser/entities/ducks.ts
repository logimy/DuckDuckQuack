/* eslint-disable @typescript-eslint/no-explicit-any */
/* Ducks rendering & client-side smoothing */
import Phaser from "phaser";
import { CONFIG } from "../config";

export type DuckView = {
  node: Phaser.GameObjects.Arc;
  tx: number;
  ty: number;
};

export class DucksLayer {
  private scene: Phaser.Scene;
  private views: Record<string, DuckView> = {};

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  onAdd = (key: string, duck: any) => {
    const c = this.scene.add.circle(
      duck.x,
      duck.y,
      CONFIG.ducks.radius,
      colorToHex(duck.color),
      1
    );
    c.setStrokeStyle(1, 0x000000, 0.5);
    c.setDepth(CONFIG.ducks.depth);
    this.views[key] = { node: c, tx: duck.x, ty: duck.y };
    this.applyVisual(key, duck);
  };

  onChange = (key: string, duck: any) => {
    const v = this.views[key];
    if (!v) return;
    v.tx = duck.x;
    v.ty = duck.y;
    this.applyVisual(key, duck);
  };

  onRemove = (key: string) => {
    const v = this.views[key];
    if (!v) return;
    v.node.destroy();
    delete this.views[key];
  };

  /** Lerp all duck visuals toward latest server coords */
  tickLerp(alpha = CONFIG.ducks.lerpAlpha) {
    for (const v of Object.values(this.views)) {
      const nx = Phaser.Math.Linear(v.node.x, v.tx, alpha);
      const ny = Phaser.Math.Linear(v.node.y, v.ty, alpha);
      v.node.setPosition(nx, ny);
    }
  }

  clear() {
    for (const k of Object.keys(this.views)) this.onRemove(k);
  }

  private applyVisual(key: string, duck: any) {
    const v = this.views[key];
    if (!v) return;
    const now = Date.now();
    if (duck.panicUntil && duck.panicUntil > now) {
      const pulse = 1 + 0.06 * Math.sin(now / 60);
      v.node.setScale(pulse);
      v.node.setAlpha(0.95);
    } else {
      v.node.setScale(1);
      v.node.setAlpha(1);
    }
  }
}

/* ---------- utils ---------- */

function colorToHex(color: string): number {
  switch (color) {
    case "red":    return 0xff4d4f;
    case "green":  return 0x52c41a;
    case "blue":   return 0x1677ff;
    case "yellow": return 0xffff00;
    case "purple": return 0x722ed1;
    default:       return 0xaaaaaa;
  }
}
