import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { CONFIG } from "./config";

/**
 * Creates and configures a new Phaser game instance
 */
export function createPhaserGame(parent: HTMLElement, roomCode: string): Phaser.Game {
  const gameConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: CONFIG.world.width,
    height: CONFIG.world.height,
    backgroundColor: "#191919",
    parent,
    physics: { default: "arcade" },
    pixelArt: true,
    scene: [GameScene],
    audio: {
      disableWebAudio: false,
      context: undefined, // Let Phaser create its own audio context
    },
  };

  const game = new Phaser.Game(gameConfig);
  
  // Store room code in game registry for access by scenes
  game.registry.set('roomCode', roomCode);
  
  return game;
}
