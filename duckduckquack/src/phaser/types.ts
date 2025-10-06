import Phaser from "phaser";

/**
 * 2D vector type
 */
export type Vec2 = { 
  x: number; 
  y: number; 
};

/**
 * Player sprite type with physics body
 */
export type PlayerSprite = Phaser.Types.Physics.Arcade.ImageWithDynamicBody;

/**
 * Map of player session IDs to their sprites
 */
export type PlayerMap = Record<string, PlayerSprite>;

/**
 * Duck data transfer object from server
 */
export type DuckDTO = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: "red" | "green" | "blue" | "purple" | string;
  panicUntil: number;
};