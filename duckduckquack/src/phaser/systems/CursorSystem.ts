import Phaser from "phaser";
import type { Vec2, PlayerSprite } from "../types";

/**
 * Manages cursor crosshair rendering and opacity based on distance to player
 */
export class CursorSystem {
  private scene: Phaser.Scene;
  private graphics?: Phaser.GameObjects.Graphics;
  private player?: PlayerSprite;

  constructor(scene: Phaser.Scene) { 
    this.scene = scene; 
  }

  setPlayer(player?: PlayerSprite) { 
    this.player = player; 
  }

  hide() { 
    this.graphics?.setVisible(false); 
  }

  showAt(x: number, y: number) {
    this.ensureGraphics();
    this.graphics!.setVisible(true).setPosition(x, y);
    this.updateOpacity();
  }

  /**
   * Creates the crosshair graphics if they don't exist
   */
  private ensureGraphics() {
    if (this.graphics) return;
    
    const graphics = this.scene.add.graphics();
    graphics.lineStyle(2, 0xffffff, 1);
    
    // Draw horizontal line
    graphics.beginPath(); 
    graphics.moveTo(-18, 0); 
    graphics.lineTo(18, 0); 
    graphics.strokePath();
    
    // Draw vertical line
    graphics.beginPath(); 
    graphics.moveTo(0, -18); 
    graphics.lineTo(0, 18); 
    graphics.strokePath();
    
    graphics.setDepth(98);
    this.graphics = graphics;
  }

  /**
   * Updates cursor opacity based on distance to player
   */
  updateOpacity(): number {
    if (!this.graphics || !this.player) return 0;
    
    const distance = Phaser.Math.Distance.Between(
      this.graphics.x, 
      this.graphics.y, 
      this.player.x, 
      this.player.y
    );
    
    const alpha = Phaser.Math.Clamp((distance - 2) / Math.max(1, 80 - 2), 0.4, 0.8);
    this.graphics.setAlpha(alpha);
    return alpha;
  }

  get position(): Vec2 | undefined {
    return this.graphics ? { x: this.graphics.x, y: this.graphics.y } : undefined;
  }

  destroy() { 
    this.graphics?.destroy(); 
    this.graphics = undefined; 
  }
}
