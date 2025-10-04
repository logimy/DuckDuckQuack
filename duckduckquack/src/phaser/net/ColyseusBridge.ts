/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client, Room, getStateCallbacks } from "colyseus.js";
import type { PlayerSprite, PlayerMap } from "../types";
import { CONFIG } from "../config";
import { spawnPlayer } from "../entities/players";

type Hooks = {
  onLocalJoin: (sprite: PlayerSprite) => void;
  onLocalUpdate: (x: number, y: number) => void;
  onRemoteJoin: (sessionId: string, sprite: PlayerSprite) => void;
  onRemoteUpdate: (sessionId: string, x: number, y: number) => void;
  onRemoteLeave: (sessionId: string) => void;
};

export class ColyseusBridge {
  room!: Room;
  private client = new Client(CONFIG.server.url);

  async connect(scene: Phaser.Scene, players: PlayerMap, hooks: Hooks): Promise<void> {
    this.room = await this.client.joinOrCreate(CONFIG.server.roomName);
    const $ = getStateCallbacks(this.room);

    $(this.room.state).players.onAdd((player: any, sessionId: string) => {
      const sprite = spawnPlayer(scene, player.x, player.y);
      players[sessionId] = sprite;

      if (sessionId === this.room.sessionId) {
        sprite.setDepth(99);
        hooks.onLocalJoin(sprite);
        $(player).onChange(() => {
          hooks.onLocalUpdate(player.x, player.y);
        });
      } else {
        sprite.setDepth(92);
        hooks.onRemoteJoin(sessionId, sprite);
        $(player).onChange(() => hooks.onRemoteUpdate(sessionId, player.x, player.y));
      }
    });

    $(this.room.state).players.onRemove((_player: any, sessionId: string) => {
      hooks.onRemoteLeave(sessionId);
    });
  }

  sendVelocity(vx: number, vy: number) { this.room?.send(0, { vx, vy }); }
  get sessionId(): string | undefined { return this.room?.sessionId; }
  onLeave(cb: () => void) { this.room?.onLeave(cb); }
}
