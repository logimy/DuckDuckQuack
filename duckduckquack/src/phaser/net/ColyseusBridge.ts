/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client, Room, getStateCallbacks } from "colyseus.js";
import type { PlayerSprite, PlayerMap } from "../types";
import { CONFIG } from "../config";
import { spawnPlayer, createNameLabel } from "../entities/players";

/**
 * Message types for client-server communication
 */
const MESSAGE_TYPES = { 
  INPUT: 0, 
  SET_NICK: 1 
} as const;

/**
 * Handles Colyseus client-server communication and state synchronization
 */
export class ColyseusBridge {
  room!: Room;
  private client = new Client(CONFIG.server.url);
  private nameLabels = new Map<string, { 
    setText: (text: string) => void; 
    destroy: () => void; 
  }>();

  /**
   * Connects to a Colyseus room and sets up state synchronization
   */
  async connect(
    scene: Phaser.Scene,
    players: PlayerMap,
    playerHooks: {
      onLocalJoin: (sprite: PlayerSprite) => void;
      onLocalUpdate: (x: number, y: number) => void;
      onRemoteJoin: (sessionId: string, sprite: PlayerSprite) => void;
      onRemoteUpdate: (sessionId: string, x: number, y: number) => void;
      onRemoteLeave: (sessionId: string) => void;
    },
    duckHandlers?: {
      onAdd?: (key: string, duck: any) => void;
      onChange?: (key: string, duck: any) => void;
      onRemove?: (key: string) => void;
    },
    nickname?: string,
    roomCode?: string,
  ): Promise<void> {
    // Connect to room by code or create new one
    console.log('Connecting to room with options:', { nickname, roomCode });
    
    if (roomCode) {
      try {
        // Check if room exists by calling our API
        const response = await fetch(`http://localhost:2567/room/${roomCode}`);
        const data = await response.json();
        
        if (data.exists && data.roomId) {
          // Join existing room by its actual room ID
          this.room = await this.client.joinById(data.roomId, { nickname });
          console.log('Joined existing room:', roomCode, data.roomId);
        } else {
          // Room doesn't exist, create a new one
          console.log('Room not found, creating new room with code:', roomCode);
          this.room = await this.client.create(CONFIG.server.roomName, { nickname, roomCode });
          console.log('Created new room:', roomCode);
        }
      } catch (error) {
        // Fallback: create new room
        console.log('Error checking room, creating new room with code:', roomCode);
        console.log('Error:', error)
        this.room = await this.client.create(CONFIG.server.roomName, { nickname, roomCode });
        console.log('Created new room:', roomCode);
      }
    } else {
      // Fallback to default behavior
      this.room = await this.client.joinOrCreate(CONFIG.server.roomName, { nickname });
    }
    const stateCallbacks = getStateCallbacks(this.room);

    // Set up player state synchronization
    stateCallbacks(this.room.state).players.onAdd((player: any, sessionId: string) => {
      const sprite = spawnPlayer(scene, player.x, player.y);
      players[sessionId] = sprite;

      const label = createNameLabel(scene, sprite, player.nickname || "");
      this.nameLabels.set(sessionId, label);

      if (sessionId === this.room.sessionId) {
        // Local player
        sprite.setDepth(99);
        playerHooks.onLocalJoin(sprite);
        stateCallbacks(player).onChange(() => {
          playerHooks.onLocalUpdate(player.x, player.y);
          label.setText(player.nickname || "");
        });
      } else {
        // Remote player
        sprite.setDepth(92);
        playerHooks.onRemoteJoin(sessionId, sprite);
        stateCallbacks(player).onChange(() => {
          playerHooks.onRemoteUpdate(sessionId, player.x, player.y);
          label.setText(player.nickname || "");
        });
      }
    });

    stateCallbacks(this.room.state).players.onRemove((_player: any, sessionId: string) => {
      playerHooks.onRemoteLeave(sessionId);
      this.nameLabels.get(sessionId)?.destroy();
      this.nameLabels.delete(sessionId);
    });

    // Set up duck state synchronization
    if (duckHandlers) {
      stateCallbacks(this.room.state).ducks.onAdd((duck: any, key: string) => {
        duckHandlers.onAdd?.(key, duck);
        stateCallbacks(duck).onChange?.(() => duckHandlers.onChange?.(key, duck));
      });
      stateCallbacks(this.room.state).ducks.onRemove((_duck: any, key: string) => {
        duckHandlers.onRemove?.(key);
      });
    }
  }

  /**
   * Sends nickname update to server
   */
  setNickname(nickname: string) { 
    this.room?.send(MESSAGE_TYPES.SET_NICK, nickname); 
  }

  /**
   * Sends player velocity to server
   */
  sendVelocity(velocityX: number, velocityY: number) { 
    this.room?.send(MESSAGE_TYPES.INPUT, { vx: velocityX, vy: velocityY }); 
  }

  /**
   * Gets the current session ID
   */
  get sessionId(): string | undefined { 
    return this.room?.sessionId; 
  }

  /**
   * Sets up callback for when player leaves the room
   */
  onLeave(callback: () => void) { 
    this.room?.onLeave(callback); 
  }
}
