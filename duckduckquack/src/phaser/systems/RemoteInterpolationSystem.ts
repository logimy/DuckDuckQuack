import Phaser from "phaser";
import { CONFIG } from "../config";
import type { PlayerMap } from "../types";

/** Linear interpolation of remote players towards last server positions. */
export function interpolateRemotes(players: PlayerMap, localId: string | undefined) {
  const a = CONFIG.remote.lerpAlpha;
  for (const id in players) {
    if (!players[id] || id === localId) continue;
    const e = players[id];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = e.data?.values as any;
    const sx = data?.serverX, sy = data?.serverY;
    if (typeof sx !== "number" || typeof sy !== "number") continue;
    e.x = Phaser.Math.Linear(e.x, sx, a);
    e.y = Phaser.Math.Linear(e.y, sy, a);
  }
}
