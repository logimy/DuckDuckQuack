import Phaser from "phaser";

export type Vec2 = { x: number; y: number };
export type PlayerSprite = Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
export type PlayerMap = Record<string, PlayerSprite>;

export type DuckDTO = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: "red" | "green" | "blue" | "purple" | string;
  panicUntil: number;
};