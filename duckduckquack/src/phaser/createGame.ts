import Phaser from "phaser";
import { GameScene, CONFIG } from "./scenes/GameScene";

export function createPhaserGame(parent: HTMLElement): Phaser.Game {
  const gameConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: CONFIG.world.width,
    height: CONFIG.world.height,
    backgroundColor: "#191919",
    parent,
    physics: { default: "arcade" },
    pixelArt: true,
    scene: [GameScene],
  };

  return new Phaser.Game(gameConfig);
}
