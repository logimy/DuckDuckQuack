/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client, Room, getStateCallbacks } from "colyseus.js";
import type { PlayerSprite, PlayerMap } from "../types";
import { CONFIG } from "../config";
import { spawnPlayer, createNameLabel } from "../entities/players";

const MESSAGE_TYPES = { 
  INPUT: 0, 
  SET_NICK: 1,
  SET_PHASE: 2,
  SET_GAME_OPTIONS: 3
} as const;

export class ColyseusBridge {
  room!: Room;
  private client = new Client(CONFIG.server.url);
  private nameLabels = new Map<string, { 
    setText: (text: string) => void; 
    destroy: () => void; 
  }>();

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
    try {
      this.room = await this.connectToRoom(nickname, roomCode);
      scene.events.emit('roomConnected');
      
      this.setupMessageHandlers(scene);
      this.setupStateCallbacks(scene, players, playerHooks, duckHandlers);
      this.emitInitialState(scene);
    } catch (error) {
      console.error('Failed to connect to room:', error);
      throw error;
    }
  }

  private async connectToRoom(nickname?: string, roomCode?: string): Promise<Room> {
    if (!roomCode) {
      return await this.client.joinOrCreate(CONFIG.server.roomName, { nickname });
    }

    try {
      const serverHost = import.meta.env.VITE_SERVER_HOST || "localhost";
      const serverPort = import.meta.env.VITE_SERVER_PORT || "2567";
      const enableSSL = import.meta.env.VITE_ENABLE_SSL === "true";
      const protocol = enableSSL ? "https://" : "http://";
      const apiUrl = `${protocol}${serverHost}:${serverPort}`;
      
      const response = await fetch(`${apiUrl}/room/${roomCode}`);
      const data = await response.json();
      
      if (data.exists && data.roomId) {
        return await this.client.joinById(data.roomId, { nickname });
      } else {
        return await this.client.create(CONFIG.server.roomName, { nickname, roomCode });
      }
    } catch (error) {
      console.error('Failed to check room existence:', error);
      return await this.client.create(CONFIG.server.roomName, { nickname, roomCode });
    }
  }

  private setupMessageHandlers(scene: Phaser.Scene): void {
    this.room.onMessage(MESSAGE_TYPES.SET_GAME_OPTIONS, (message) => {
      scene.events.emit('gameOptionsUpdated', message);
    });
  }

  private setupStateCallbacks(
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
    }
  ): void {
    const stateCallbacks = getStateCallbacks(this.room);

    this.setupPlayerCallbacks(stateCallbacks, scene, players, playerHooks);
    this.setupDuckCallbacks(stateCallbacks, duckHandlers);
    this.setupPhaseCallbacks(stateCallbacks, scene, players, playerHooks);
    this.setupGameOptionsCallbacks(stateCallbacks, scene);
  }

  private setupPlayerCallbacks(
    stateCallbacks: any,
    scene: Phaser.Scene,
    players: PlayerMap,
    playerHooks: any
  ): void {
    stateCallbacks(this.room.state).players.onAdd((player: any, sessionId: string) => {
      if (this.room.state.phase === 'playing') {
        this.spawnPlayerSprite(scene, players, player, sessionId, playerHooks);
      } else {
        this.handleLobbyPlayerJoin(sessionId, playerHooks);
      }
    });

    stateCallbacks(this.room.state).players.onRemove((_player: any, sessionId: string) => {
      playerHooks.onRemoteLeave(sessionId);
      this.nameLabels.get(sessionId)?.destroy();
      this.nameLabels.delete(sessionId);
    });
  }

  private spawnPlayerSprite(
    scene: Phaser.Scene,
    players: PlayerMap,
    player: any,
    sessionId: string,
    playerHooks: any
  ): void {
    if (players[sessionId] || this.nameLabels.has(sessionId)) return;

    const sprite = spawnPlayer(scene, player.x, player.y);
    players[sessionId] = sprite;

    const label = createNameLabel(scene, sprite, player.nickname || "");
    this.nameLabels.set(sessionId, label);

    if (sessionId === this.room.sessionId) {
      sprite.setDepth(99);
      playerHooks.onLocalJoin(sprite);
      this.setupPlayerMovementCallback(player, playerHooks, label);
    } else {
      sprite.setDepth(92);
      playerHooks.onRemoteJoin(sessionId, sprite);
      this.setupPlayerMovementCallback(player, playerHooks, label, sessionId);
    }
  }

  private setupPlayerMovementCallback(
    player: any,
    playerHooks: any,
    label: any,
    sessionId?: string
  ): void {
    const stateCallbacks = getStateCallbacks(this.room);
    stateCallbacks(player).onChange(() => {
      if (sessionId) {
        playerHooks.onRemoteUpdate(sessionId, player.x, player.y);
      } else {
        playerHooks.onLocalUpdate(player.x, player.y);
      }
      label.setText(player.nickname || "");
    });
  }

  private handleLobbyPlayerJoin(sessionId: string, playerHooks: any): void {
    if (sessionId === this.room.sessionId) {
      playerHooks.onLocalJoin(null);
    } else {
      playerHooks.onRemoteJoin(sessionId, null);
    }
  }

  private setupDuckCallbacks(stateCallbacks: any, duckHandlers?: any): void {
    if (!duckHandlers) return;

    stateCallbacks(this.room.state).ducks.onAdd((duck: any, key: string) => {
      duckHandlers.onAdd?.(key, duck);
      stateCallbacks(duck).onChange?.(() => duckHandlers.onChange?.(key, duck));
    });

    stateCallbacks(this.room.state).ducks.onRemove((_duck: any, key: string) => {
      duckHandlers.onRemove?.(key);
    });
  }

  private setupPhaseCallbacks(
    stateCallbacks: any,
    scene: Phaser.Scene,
    players: PlayerMap,
    playerHooks: any
  ): void {
    const currentPhase = this.room.state.phase;
    if (currentPhase) {
      scene.events.emit('phaseChanged', currentPhase);
    }
    
    stateCallbacks(this.room.state).onChange(() => {
      const newPhase = this.room.state.phase;
      scene.events.emit('phaseChanged', newPhase);
      
      if (newPhase === 'playing') {
        this.spawnAllPlayersInPhase(scene, players, playerHooks);
      } else if (newPhase === 'lobby') {
        this.despawnAllPlayers(players);
      }
    });
  }

  private spawnAllPlayersInPhase(
    scene: Phaser.Scene,
    players: PlayerMap,
    playerHooks: any
  ): void {
    for (const [sessionId, player] of this.room.state.players) {
      if (!players[sessionId] && !this.nameLabels.has(sessionId)) {
        this.spawnPlayerSprite(scene, players, player, sessionId, playerHooks);
      }
    }
  }

  private despawnAllPlayers(players: PlayerMap): void {
    for (const [sessionId, sprite] of Object.entries(players)) {
      sprite.destroy();
      this.nameLabels.get(sessionId)?.destroy();
      this.nameLabels.delete(sessionId);
      delete players[sessionId];
    }
  }

  private setupGameOptionsCallbacks(stateCallbacks: any, scene: Phaser.Scene): void {
    const currentGameOptions = this.room.state.gameOptions;
    if (currentGameOptions) {
      scene.events.emit('gameOptionsUpdated', {
        colors: currentGameOptions.colors,
        ducksCount: currentGameOptions.ducksCount
      });
    }
    
    let lastGameOptionsString = JSON.stringify(currentGameOptions);
    
    stateCallbacks(this.room.state).onChange(() => {
      const newTimerStartTime = this.room.state.playingPhaseStartTime;
      scene.events.emit('timerStateChanged', newTimerStartTime);
      
      const newGameOptions = this.room.state.gameOptions;
      const newGameOptionsString = JSON.stringify(newGameOptions);
      
      if (newGameOptionsString !== lastGameOptionsString) {
        scene.events.emit('gameOptionsUpdated', {
          colors: newGameOptions.colors,
          ducksCount: newGameOptions.ducksCount
        });
        lastGameOptionsString = newGameOptionsString;
      }
    });
  }

  private emitInitialState(scene: Phaser.Scene): void {
    if (this.room.state.players) {
      const initialPlayers = Array.from(this.room.state.players.values()).map((player: any) => ({
        nickname: player.nickname
      }));
      scene.events.emit('playersUpdated', initialPlayers);
    } else {
      scene.events.emit('playersUpdated', []);
    }

    setTimeout(() => {
      if (this.room.state.players) {
        const players = Array.from(this.room.state.players.values()).map((player: any) => ({
          nickname: player.nickname
        }));
        scene.events.emit('playersUpdated', players);
      }
    }, 100);
  }

  setNickname(nickname: string): void { 
    this.room?.send(MESSAGE_TYPES.SET_NICK, nickname); 
  }

  sendVelocity(velocityX: number, velocityY: number): void { 
    this.room?.send(MESSAGE_TYPES.INPUT, { vx: velocityX, vy: velocityY }); 
  }

  setPhase(phase: string): void { 
    this.room?.send(MESSAGE_TYPES.SET_PHASE, phase); 
  }

  updateGameOptions(options: any): void { 
    this.room?.send(MESSAGE_TYPES.SET_GAME_OPTIONS, options); 
  }

  get sessionId(): string | undefined { 
    return this.room?.sessionId; 
  }

  onLeave(callback: () => void): void { 
    this.room?.onLeave(callback); 
  }
}
