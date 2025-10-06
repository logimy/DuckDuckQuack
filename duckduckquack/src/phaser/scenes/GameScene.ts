import Phaser from "phaser";
import { CONFIG } from "../config";
import type { PlayerMap, PlayerSprite, Vec2 } from "../types";
import { HelpOverlay } from "../ui/HelpOverlay";
import { SoundToggle } from "../ui/SoundToggle";
import { RoomCodeDisplay } from "../ui/RoomCodeDisplay";
import { TimerUI } from "../ui/TimerUI";
import { CursorSystem } from "../systems/CursorSystem";
import { TetherSystem } from "../systems/TetherSystem";
import { MovementSystem } from "../systems/MovementSystem";
import { ReconcileSystem } from "../systems/ReconcileSystem";
import { interpolateRemotes } from "../systems/RemoteInterpolationSystem";
import { ColyseusBridge } from "../net/ColyseusBridge";
import { DucksLayer } from "../entities/ducks";
import { NicknameOverlay } from "../ui/NicknameOverlay";
import quack01Url from "../../assets/sfx/quack01.ogg?url";
import quack02Url from "../../assets/sfx/quack02.ogg?url";
import quack03Url from "../../assets/sfx/quack03.ogg?url";

export class GameScene extends Phaser.Scene {
  private net = new ColyseusBridge();
  private players: PlayerMap = {};
  private localPlayer?: PlayerSprite;

  private helpOverlay!: HelpOverlay;
  private cursorSystem!: CursorSystem;
  private tetherSystem!: TetherSystem;
  private movementSystem!: MovementSystem;
  private reconcileSystem!: ReconcileSystem;
  private nicknameOverlay!: NicknameOverlay;

  private ducksLayer!: DucksLayer;

  private isPointerLocked = false;
  private virtualCursor: Vec2 = { x: 0, y: 0 };

  private soundToggle!: SoundToggle;
  private roomCodeDisplay!: RoomCodeDisplay;
  private timerUI!: TimerUI;

  private readonly fixedTimestep = 1000 / CONFIG.net.fixedHz;
  private accumulatedTime = 0;
  private isGameActive = false;

  preload() {
    this.load.audio("quack01", quack01Url);
    this.load.audio("quack02", quack02Url);
    this.load.audio("quack03", quack03Url);
    
    this.helpOverlay = new HelpOverlay(this);
    this.helpOverlay.preload();
  }

  async create() {
    this.initializeSystems();
    this.initializeUI();
    this.initializeInput();
    this.initializeNicknameGate();
    this.initializeAudio();
  }

  private initializeSystems() {
    this.cursorSystem = new CursorSystem(this);
    this.tetherSystem = new TetherSystem(this);
    this.movementSystem = new MovementSystem();
    this.reconcileSystem = new ReconcileSystem();
    this.ducksLayer = new DucksLayer(this);

    this.isPointerLocked = this.isCanvasLocked();
    this.movementSystem.setLocked(this.isPointerLocked);
    this.updateUnlockedClass();
  }

  private initializeUI() {
    this.helpOverlay.create(this.isPointerLocked);
    this.helpOverlay.setVisible(false, true);

    this.soundToggle = new SoundToggle(this);
    const initialMuted = localStorage.getItem("ddq_sound_muted") === "1";
    this.soundToggle.create(initialMuted, () => this.isPointerLocked, this.isPointerLocked);

    this.roomCodeDisplay = new RoomCodeDisplay(this);
    this.roomCodeDisplay.create(() => this.isPointerLocked, this.isPointerLocked);
    this.roomCodeDisplay.setVisible(false, true);

    this.timerUI = new TimerUI(this);
    this.timerUI.create();
  }

  private initializeInput() {
    this.wirePointerLock();
    this.wirePointerMove();

    this.game.events.on(Phaser.Core.Events.BLUR, () => {
      if (this.isCanvasLocked()) document.exitPointerLock();
      this.movementSystem.setLocked(false);
    });
  }

  private initializeNicknameGate() {
    this.nicknameOverlay = new NicknameOverlay(this);
    const savedNickname = localStorage.getItem("ddq_nick");
    this.nicknameOverlay.create(savedNickname, async (finalNickname) => {
      localStorage.setItem("ddq_nick", finalNickname);
      await this.connectToNetwork(finalNickname);
    });
  }

  private initializeAudio() {
    // Ensure audio context is ready
    const webAudioManager = this.sound as any;
    if (webAudioManager.context && webAudioManager.context.state === 'suspended') {
      // Audio context is suspended, will be resumed on user interaction
      webAudioManager.context.resume().catch(console.error);
    }
  }

  private resumeAudioContext() {
    const webAudioManager = this.sound as any;
    if (webAudioManager.context) {
      if (webAudioManager.context.state === 'suspended') {
        webAudioManager.context.resume().then(() => {
          console.log('Audio context resumed');
        }).catch(console.error);
      }
    } else {
      // If context doesn't exist yet, try to create it
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioContext = new AudioContextClass();
          if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
              console.log('Audio context created and resumed');
            }).catch(console.error);
          }
        }
      } catch (error) {
        console.error('Failed to create audio context:', error);
      }
    }
  }

  private async connectToNetwork(nickname: string) {
    const roomCode = this.game.registry.get('roomCode') as string;
    
    this.setupEventListeners();
    
    await this.net.connect(
      this,
      this.players,
      {
        onLocalJoin: (sprite) => this.onLocalPlayerJoin(sprite),
        onLocalUpdate: (x, y) => this.onLocalPlayerUpdate(x, y),
        onRemoteJoin: (sessionId, sprite) => this.onRemotePlayerJoin(sessionId, sprite),
        onRemoteUpdate: (id, x, y) => this.onRemotePlayerUpdate(id, x, y),
        onRemoteLeave: (id) => this.onRemotePlayerLeave(id),
      },
      {
        onAdd: this.ducksLayer.onAdd,
        onChange: this.ducksLayer.onChange,
        onRemove: this.ducksLayer.onRemove,
      },
      nickname,
      roomCode
    );
    this.net.onLeave(() => this.cleanup());
  }

  private setupEventListeners() {
    this.events.on('phaseChanged', (phase: string) => {
      if (phase === 'playing') {
        this.UIGameState(true);
      } else if (phase === 'lobby' || phase === 'ended') {
        this.UIGameState(false);
      }
      
      this.game.events.emit('phaseChanged', phase);
      
      if (phase === 'ended') {
        const finalTime = this.net.room?.state?.finalGameTime || 0;
        this.game.events.emit('matchTimeUpdated', finalTime);
      }
    });

    this.events.on('timerStateChanged', (startTime: number) => {
      this.timerUI.setTimerState(startTime);
    });

    this.events.on('roomConnected', () => {
      this.nicknameOverlay?.hideSpawnButton();
    });

    this.game.events.on('updateGameOptions', (options: any) => {
      this.net.updateGameOptions(options);
    });

    this.game.events.on('playAgain', () => {
      this.net.setPhase('lobby');
    });

    this.game.events.on('startGame', () => {
      this.net.setPhase('playing');
    });

    this.events.on('gameOptionsUpdated', (options: any) => {
      this.game.events.emit('gameOptionsUpdated', options);
    });
  }

  update(_time: number, deltaTime: number) {
    if (!this.localPlayer) return;
    
    this.accumulatedTime += deltaTime;
    while (this.accumulatedTime >= this.fixedTimestep) {
      this.accumulatedTime -= this.fixedTimestep;
      this.fixedUpdate();
    }
  }

  private fixedUpdate() {
    const velocity = this.movementSystem.step();
    this.net.sendVelocity(velocity.x, velocity.y);

    this.reconcileSystem.step();

    this.cursorSystem.updateOpacity();
    const cursorPosition = this.cursorSystem.position;
    if (this.isPointerLocked && cursorPosition) {
      this.tetherSystem.drawTo(cursorPosition.x, cursorPosition.y);
    }

    interpolateRemotes(this.players, this.net.sessionId);

    this.ducksLayer.tickLerp(CONFIG.ducks.lerpAlpha);
    this.ducksLayer.tickAudio();

    this.timerUI.update();
  }

  private onLocalPlayerJoin(sprite: PlayerSprite | null) {
    if (sprite) {
      this.localPlayer = sprite;

      this.cursorSystem.setPlayer(sprite);
      this.tetherSystem.setPlayer(sprite);
      this.movementSystem.setPlayer(sprite);
      this.reconcileSystem.setPlayer(sprite);

      this.helpOverlay.setVisible(!this.isPointerLocked);
      this.nicknameOverlay?.hideSpawnButton();
      this.roomCodeDisplay.setVisible(!this.isPointerLocked, true);

      if (this.isPointerLocked) {
        this.initializeCursorAtPointer();
      } else {
        this.hideCursorAndTether();
      }
    } else {
      this.nicknameOverlay?.hideSpawnButton();
      this.roomCodeDisplay.setVisible(!this.isPointerLocked, true);
    }

    this.emitPlayersUpdate();
  }

  private onLocalPlayerUpdate(x: number, y: number) {
    this.reconcileSystem.setServerPos(x, y);
  }

  private onRemotePlayerJoin(_sessionId: string, _sprite: PlayerSprite | null) {
    this.emitPlayersUpdate();
  }

  private onRemotePlayerUpdate(playerId: string, x: number, y: number) {
    const player = this.players[playerId];
    if (!player) return;
    player.setData("serverX", x);
    player.setData("serverY", y);
  }

  private onRemotePlayerLeave(playerId: string) {
    this.players[playerId]?.destroy();
    delete this.players[playerId];
    
    if (playerId === this.net.sessionId) {
      this.localPlayer = undefined;
      this.nicknameOverlay?.hideSpawnButton();
    }

    this.emitPlayersUpdate();
  }

  private wirePointerLock() {
    this.input.off("pointerdown");
    
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      // Resume audio context on user interaction
      this.resumeAudioContext();
      
      const canvas = this.game.canvas as HTMLCanvasElement;
      if (this.isCanvasLocked()) {
        document.exitPointerLock();
      } else {
        canvas.requestPointerLock?.();
      }
    });

    document.removeEventListener("pointerlockchange", this.handlePointerLockChange);
    document.addEventListener("pointerlockchange", this.handlePointerLockChange);
  }

  private handlePointerLockChange = () => {
    this.setPointerLocked(this.isCanvasLocked());
    // Resume audio context on user interaction
    this.resumeAudioContext();
  };

  private wirePointerMove() {
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      // Resume audio context on any user interaction
      this.resumeAudioContext();
      
      const camera = this.cameras.main;
      
      if (this.isPointerLocked) {
        const deltaX = pointer.movementX / camera.zoom;
        const deltaY = pointer.movementY / camera.zoom;

        this.virtualCursor.x = Phaser.Math.Clamp(
          this.virtualCursor.x + deltaX, 
          0, 
          CONFIG.world.width
        );
        this.virtualCursor.y = Phaser.Math.Clamp(
          this.virtualCursor.y + deltaY, 
          0, 
          CONFIG.world.height
        );

        this.movementSystem.setMouseWorld(this.virtualCursor.x, this.virtualCursor.y);
        this.cursorSystem.showAt(this.virtualCursor.x, this.virtualCursor.y);
        this.tetherSystem.drawTo(this.virtualCursor.x, this.virtualCursor.y);
      } else {
        const worldPoint = camera.getWorldPoint(pointer.x, pointer.y);
        this.movementSystem.setMouseWorld(worldPoint.x, worldPoint.y);
        this.hideCursorAndTether();
      }
    });
  }

  private isCanvasLocked(): boolean {
    return document.pointerLockElement === this.game.canvas;
  }

  private setPointerLocked(locked: boolean) {
    this.isPointerLocked = locked;
    this.movementSystem.setLocked(locked);

    const shouldShowHelp = !locked && !!this.localPlayer && this.isGameActive;
    this.helpOverlay.setVisible(shouldShowHelp);

    this.soundToggle?.setVisible(!locked);
    this.roomCodeDisplay?.setVisible(!locked && !!this.localPlayer);
    this.updateUnlockedClass();

    if (locked && this.localPlayer) {
      this.initializeCursorAtPointer();
    } else {
      this.hideCursorAndTether();
    }
  }

  private initializeCursorAtPointer() {
    this.virtualCursor.x = this.input.activePointer.worldX;
    this.virtualCursor.y = this.input.activePointer.worldY;
    this.cursorSystem.showAt(this.virtualCursor.x, this.virtualCursor.y);
  }

  private hideCursorAndTether() {
    this.cursorSystem.hide();
    this.tetherSystem.hide();
  }

  private updateUnlockedClass() {
    const element = document.getElementById(CONFIG.ui.containerId);
    if (!element) return;
    
    if (!this.isGameActive) {
      element.classList.remove(CONFIG.ui.unlockedClass);
      return;
    }
    
    element.classList[this.isPointerLocked ? "remove" : "add"](CONFIG.ui.unlockedClass);
  }

  UIGameState(isActive: boolean) {
    this.isGameActive = isActive;
    
    if (!isActive) {
      this.helpOverlay.setVisible(false, true);
      
      this.input.off("pointerdown");
      document.removeEventListener("pointerlockchange", this.handlePointerLockChange);
      
      if (this.isCanvasLocked()) {
        document.exitPointerLock();
      }
      
      this.setPointerLocked(false);
      this.updateUnlockedClass();
    } else {
      this.wirePointerLock();
      
      if (!this.isPointerLocked && this.localPlayer) {
        this.helpOverlay.setVisible(true);
      }
      
      this.updateUnlockedClass();
    }
  }

  private emitPlayersUpdate() {
    const playerList = Array.from(this.net.room?.state.players.values() || []).map((player: any) => ({
      nickname: player.nickname
    }));
    this.game.events.emit('playersUpdated', playerList);
  }

  private cleanup() {
    Object.values(this.players).forEach((sprite) => sprite?.destroy());
    this.players = {};
    this.localPlayer = undefined;
    
    this.cursorSystem?.destroy();
    this.tetherSystem?.destroy();
    
    this.helpOverlay?.destroy();
    this.soundToggle?.destroy();
    this.roomCodeDisplay?.destroy();
    this.nicknameOverlay?.destroy();
    this.timerUI?.destroy();

    this.ducksLayer?.clear();
  }
}
