import Phaser from "phaser";
import type { PlayerSprite } from "../types";

/**
 * Renders a dashed tether line between player and cursor with distance-based alpha
 */
export class TetherSystem {
  private scene: Phaser.Scene;
  private graphics?: Phaser.GameObjects.Graphics;
  private player?: PlayerSprite;
  private readonly alphaConfig = { 
    min: 0.25, 
    max: 0.85, 
    start: 8, 
    end: 140 
  };

  constructor(scene: Phaser.Scene) { 
    this.scene = scene; 
  }

  setPlayer(player?: PlayerSprite) { 
    this.player = player; 
  }

  hide() { 
    this.graphics?.setVisible(false); 
    this.graphics?.clear(); 
  }

  /**
   * Draws a dashed line from player to cursor position
   */
  drawTo(cursorX: number, cursorY: number) {
    if (!this.player) return this.hide();
    
    const playerX = this.player.x;
    const playerY = this.player.y;
    const distance = Math.hypot(cursorX - playerX, cursorY - playerY);
    
    const alphaT = Phaser.Math.Clamp(
      (distance - this.alphaConfig.start) / Math.max(1, this.alphaConfig.end - this.alphaConfig.start), 
      0, 
      0.2
    );
    const alpha = Phaser.Math.Linear(this.alphaConfig.min, this.alphaConfig.max, alphaT);

    const graphics = this.graphics ?? (this.graphics = this.scene.add.graphics().setDepth(90));
    graphics.setVisible(true).setAlpha(alpha).clear().lineStyle(2, 0xffffff, 1).beginPath();

    const deltaX = cursorX - playerX;
    const deltaY = cursorY - playerY;
    const normalizedDistance = Math.max(1, distance);
    const normalizedX = deltaX / normalizedDistance;
    const normalizedY = deltaY / normalizedDistance;
    
    const dashLength = 8;
    const gapLength = 6;
    const segmentLength = dashLength + gapLength;

    for (let segment = 0; segment < distance; segment += segmentLength) {
      const currentDashLength = Math.min(dashLength, distance - segment);
      graphics.moveTo(
        playerX + normalizedX * segment, 
        playerY + normalizedY * segment
      );
      graphics.lineTo(
        playerX + normalizedX * (segment + currentDashLength), 
        playerY + normalizedY * (segment + currentDashLength)
      );
    }
    graphics.strokePath();
  }

  destroy() { 
    this.graphics?.destroy(); 
    this.graphics = undefined; 
  }
}
