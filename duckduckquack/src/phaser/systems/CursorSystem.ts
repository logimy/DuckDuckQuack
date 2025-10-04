import Phaser from "phaser";
import type { Vec2, PlayerSprite } from "../types";

/** Draws a simple crosshair and manages opacity based on distance to player. */
export class CursorSystem {
  private scene: Phaser.Scene;
  private gfx?: Phaser.GameObjects.Graphics;
  private player?: PlayerSprite;

  constructor(scene: Phaser.Scene) { this.scene = scene; }

  setPlayer(p?: PlayerSprite) { this.player = p; }
  hide() { this.gfx?.setVisible(false); }
  showAt(x: number, y: number) {
    this.ensure();
    this.gfx!.setVisible(true).setPosition(x, y);
    this.updateOpacity();
  }

  private ensure() {
    if (this.gfx) return;
    const g = this.scene.add.graphics();
    g.lineStyle(2, 0xffffff, 1);
    g.beginPath(); g.moveTo(-18, 0); g.lineTo(18, 0); g.strokePath();
    g.beginPath(); g.moveTo(0, -18); g.lineTo(0, 18); g.strokePath();
    g.setDepth(98);
    this.gfx = g;
  }

  /** Returns alpha for external use if needed. */
  updateOpacity(): number {
    if (!this.gfx || !this.player) return 0;
    const d = Phaser.Math.Distance.Between(this.gfx.x, this.gfx.y, this.player.x, this.player.y);
    const t = Phaser.Math.Clamp((d - 2) / Math.max(1, 80 - 2), 0.4, 0.8);
    this.gfx.setAlpha(t);
    return t;
  }

  get position(): Vec2 | undefined {
    return this.gfx ? { x: this.gfx.x, y: this.gfx.y } : undefined;
  }

  destroy() { this.gfx?.destroy(); this.gfx = undefined; }
}
