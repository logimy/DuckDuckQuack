import Phaser from "phaser";
import type { PlayerSprite } from "../types";

/** Renders a dashed tether line between player and cursor with distance-based alpha. */
export class TetherSystem {
  private scene: Phaser.Scene;
  private gfx?: Phaser.GameObjects.Graphics;
  private player?: PlayerSprite;
  private alphaCfg = { min: 0.25, max: 0.85, start: 8, end: 140 };

  constructor(scene: Phaser.Scene) { this.scene = scene; }
  setPlayer(p?: PlayerSprite) { this.player = p; }

  hide() { this.gfx?.setVisible(false); this.gfx?.clear(); }

  drawTo(cx: number, cy: number) {
    if (!this.player) return this.hide();
    const px = this.player.x, py = this.player.y;
    const d = Math.hypot(cx - px, cy - py);
    const t = Phaser.Math.Clamp((d - this.alphaCfg.start) / Math.max(1, this.alphaCfg.end - this.alphaCfg.start), 0, 0.2);
    const a = Phaser.Math.Linear(this.alphaCfg.min, this.alphaCfg.max, t);

    const g = this.gfx ?? (this.gfx = this.scene.add.graphics().setDepth(90));
    g.setVisible(true).setAlpha(a).clear().lineStyle(2, 0xffffff, 1).beginPath();

    const dx = cx - px, dy = cy - py, dist = Math.max(1, d);
    const nx = dx / dist, ny = dy / dist;
    const dash = 8, gap = 6, seg = dash + gap;

    for (let s = 0; s < dist; s += seg) {
      const len = Math.min(dash, dist - s);
      g.moveTo(px + nx * s, py + ny * s);
      g.lineTo(px + nx * (s + len), py + ny * (s + len));
    }
    g.strokePath();
  }

  destroy() { this.gfx?.destroy(); this.gfx = undefined; }
}
