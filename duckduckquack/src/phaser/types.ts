import Phaser from "phaser";

export type Vec2 = { x: number; y: number };
export type PlayerSprite = Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
export type PlayerMap = Record<string, PlayerSprite>;