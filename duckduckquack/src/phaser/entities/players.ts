import Phaser from "phaser";
import { CONFIG } from "../config";
import type { PlayerSprite } from "../types";

export function spawnPlayer(scene: Phaser.Scene, x: number, y: number): PlayerSprite {
  return scene.physics.add.image(x, y, CONFIG.assets.ship);
}

export function clampToWorldBounds(p: PlayerSprite): void {
  const { width, height } = CONFIG.world;
  if (p.x < 0) p.x = 0; else if (p.x > width) p.x = width;
  if (p.y < 0) p.y = 0; else if (p.y > height) p.y = height;
}
