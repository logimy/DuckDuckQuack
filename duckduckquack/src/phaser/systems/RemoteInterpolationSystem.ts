import Phaser from "phaser";
import { CONFIG } from "../config";
import type { PlayerMap } from "../types";

/**
 * Performs linear interpolation of remote players toward their last server positions
 */
export function interpolateRemotes(players: PlayerMap, localId: string | undefined): void {
  const alpha = CONFIG.remote.lerpAlpha;
  
  for (const playerId in players) {
    if (!players[playerId] || playerId === localId) continue;
    
    const player = players[playerId];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerData = player.data?.values as any;
    const serverX = playerData?.serverX;
    const serverY = playerData?.serverY;
    
    if (typeof serverX !== "number" || typeof serverY !== "number") continue;
    
    player.x = Phaser.Math.Linear(player.x, serverX, alpha);
    player.y = Phaser.Math.Linear(player.y, serverY, alpha);
  }
}
