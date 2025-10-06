import Phaser from "phaser";
import { CONFIG } from "../config";
import type { PlayerSprite } from "../types";

/**
 * Ensures the player circle texture exists in the scene
 */
function ensurePlayerCircleTexture(scene: Phaser.Scene): void {
  const { textureKey, radius, strokeWidth, fill, stroke } = CONFIG.player;
  if (scene.textures.exists(textureKey)) return;

  const padding = strokeWidth;
  const size = radius * 2 + padding * 2;

  const graphics = scene.make.graphics({ x: 0, y: 0 });
  scene.add.existing(graphics);
  graphics.fillStyle(fill, 1);
  graphics.lineStyle(strokeWidth, stroke, 1);
  graphics.fillCircle(radius + padding, radius + padding, radius);
  graphics.strokeCircle(radius + padding, radius + padding, radius);

  graphics.generateTexture(textureKey, size, size);
  graphics.destroy();
}

/**
 * Creates and configures a new player sprite
 */
export function spawnPlayer(scene: Phaser.Scene, x: number, y: number): PlayerSprite {
  ensurePlayerCircleTexture(scene);

  const textureKey = CONFIG.player.textureKey;
  const player = scene.physics.add.image(x, y, textureKey) as PlayerSprite;
  
  player.setCircle(CONFIG.player.radius + CONFIG.player.strokeWidth / 2);
  player.setDepth(CONFIG.player.depth);
  player.setOrigin(0.5, 0.5);
  player.setCollideWorldBounds(false);

  return player;
}

/**
 * Clamps player position to world boundaries
 */
export function clampToWorldBounds(player: PlayerSprite): void {
  const { width, height } = CONFIG.world;
  
  if (player.x < 0) player.x = 0; 
  else if (player.x > width) player.x = width;
    
  if (player.y < 0) player.y = 0; 
  else if (player.y > height) player.y = height;
}

/**
 * Creates a name label that follows a sprite
 */
export function createNameLabel(
  scene: Phaser.Scene, 
  sprite: Phaser.GameObjects.Image, 
  text: string
) {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: "system-ui, Arial, sans-serif",
    fontSize: "14px",
    color: "#f0f0f0",
    stroke: "#000",
    strokeThickness: 2,
    shadow: { offsetX: 0, offsetY: 2, blur: 0, color: "#000", fill: true },
    align: "center",
  };
  
  const label = scene.add.text(
    sprite.x, 
    sprite.y + CONFIG.player.radius + 14, 
    text || "", 
    style
  )
    .setOrigin(0.5, 0)
    .setDepth((CONFIG.player.depth ?? 92) + 1)
    .setScrollFactor(1, 1);

  const updatePosition = () => {
    label.x = sprite.x;
    label.y = sprite.y + CONFIG.player.radius + 14;
  };

  const onUpdate = () => updatePosition();
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);

  return {
    setText: (newText: string) => label.setText(newText || ""),
    destroy: () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
      label.destroy();
    }
  };
}
