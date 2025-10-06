/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";
import { CONFIG } from "../config";
import type { PlayerMap, PlayerSprite, Vec2 } from "../types";
import { HelpOverlay } from "../ui/HelpOverlay";
import { SoundToggle } from "../ui/SoundToggle";
import { RoomCodeDisplay } from "../ui/RoomCodeDisplay";
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

/**
 * Main game scene that handles player movement, networking, and UI
 */

export class GameScene extends Phaser.Scene {
  // Networking and entities
  private net = new ColyseusBridge();
  private players: PlayerMap = {};
  private localPlayer?: PlayerSprite;
  private remoteReference?: Phaser.GameObjects.Rectangle;

  // Game systems
  private helpOverlay!: HelpOverlay;
  private cursorSystem!: CursorSystem;
  private tetherSystem!: TetherSystem;
  private movementSystem!: MovementSystem;
  private reconcileSystem!: ReconcileSystem;
  private nicknameOverlay!: NicknameOverlay;

  // Duck rendering
  private ducksLayer!: DucksLayer;

  // Input state
  private isPointerLocked = false;
  private virtualCursor: Vec2 = { x: 0, y: 0 };

  // UI components
  private soundToggle!: SoundToggle;
  private roomCodeDisplay!: RoomCodeDisplay;

  // Fixed timestep simulation
  private readonly fixedTimestep = 1000 / CONFIG.net.fixedHz;
  private accumulatedTime = 0;

  /**
   * Preloads audio assets and UI components
   */
  preload() {
    this.load.audio("quack01", quack01Url);
    this.load.audio("quack02", quack02Url);
    this.load.audio("quack03", quack03Url);
    
    this.helpOverlay = new HelpOverlay(this);
    this.helpOverlay.preload();
  }

  /**
   * Initializes the game scene with systems, UI, and input handling
   */
  async create() {
    this.initializeSystems();
    this.initializeUI();
    this.initializeInput();
    this.initializeNicknameGate();
  }

  /**
   * Initializes all game systems
   */
  private initializeSystems() {
    this.cursorSystem = new CursorSystem(this);
    this.tetherSystem = new TetherSystem(this);
    this.movementSystem = new MovementSystem();
    this.reconcileSystem = new ReconcileSystem();
    this.ducksLayer = new DucksLayer(this);

    // Set initial pointer lock state
    this.isPointerLocked = this.isCanvasLocked();
    this.movementSystem.setLocked(this.isPointerLocked);
    this.updateUnlockedClass();
  }

  /**
   * Initializes UI components
   */
  private initializeUI() {
    this.helpOverlay.create(this.isPointerLocked);
    // Keep help hidden until the local player actually spawns
    this.helpOverlay.setVisible(false, true);

    this.soundToggle = new SoundToggle(this);
    const initialMuted = localStorage.getItem("ddq_sound_muted") === "1";
    this.soundToggle.create(initialMuted, () => this.isPointerLocked, this.isPointerLocked);

    this.roomCodeDisplay = new RoomCodeDisplay(this);
    this.roomCodeDisplay.create(() => this.isPointerLocked, this.isPointerLocked);
    
    // Initially hide room code display until player spawns
    this.roomCodeDisplay.setVisible(false, true);
  }

  /**
   * Initializes input handling
   */
  private initializeInput() {
    this.wirePointerLock();
    this.wirePointerMove();

    // Blur releases lock and halts smoothing
    this.game.events.on(Phaser.Core.Events.BLUR, () => {
      if (this.isCanvasLocked()) document.exitPointerLock();
      this.movementSystem.setLocked(false);
    });
  }

  /**
   * Initializes nickname input gate
   */
  private initializeNicknameGate() {
    this.nicknameOverlay = new NicknameOverlay(this);
    const savedNickname = localStorage.getItem("ddq_nick");
    this.nicknameOverlay.create(savedNickname, async (finalNickname) => {
      // Persist chosen nickname
      localStorage.setItem("ddq_nick", finalNickname);
      await this.connectToNetwork(finalNickname);
    });
  }

  /**
   * Connects to the network with the given nickname
   */
  private async connectToNetwork(nickname: string) {
    const roomCode = this.game.registry.get('roomCode') as string;
    await this.net.connect(
      this,
      this.players,
      {
        onLocalJoin: (sprite) => this.onLocalPlayerJoin(sprite),
        onLocalUpdate: (x, y) => this.onLocalPlayerUpdate(x, y),
        onRemoteJoin: () => {},
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

  /**
   * Main update loop with fixed timestep simulation
   */
  update(_time: number, deltaTime: number) {
    if (!this.localPlayer) return;
    
    this.accumulatedTime += deltaTime;
    while (this.accumulatedTime >= this.fixedTimestep) {
      this.accumulatedTime -= this.fixedTimestep;
      this.fixedUpdate();
    }
  }

  /**
   * Fixed timestep update for consistent physics and networking
   */
  private fixedUpdate() {
    // Process player movement
    const velocity = this.movementSystem.step();
    this.net.sendVelocity(velocity.x, velocity.y);

    // Reconcile with server position
    this.reconcileSystem.step();

    // Update cursor and tether
    this.cursorSystem.updateOpacity();
    const cursorPosition = this.cursorSystem.position;
    if (this.isPointerLocked && cursorPosition) {
      this.tetherSystem.drawTo(cursorPosition.x, cursorPosition.y);
    }

    // Interpolate remote players
    interpolateRemotes(this.players, this.net.sessionId);

    // Update duck visuals and audio
    this.ducksLayer.tickLerp(CONFIG.ducks.lerpAlpha);
    this.ducksLayer.tickAudio();
  }

  /* ------------------------------ Network Event Handlers ------------------------------ */

  /**
   * Handles local player joining the game
   */
  private onLocalPlayerJoin(sprite: PlayerSprite) {
    this.localPlayer = sprite;

    // Set up systems for local player
    this.cursorSystem.setPlayer(sprite);
    this.tetherSystem.setPlayer(sprite);
    this.movementSystem.setPlayer(sprite);
    this.reconcileSystem.setPlayer(sprite);

    // Create debug reference for server position
    this.remoteReference = this.add
      .rectangle(0, 0, sprite.width, sprite.height)
      .setStrokeStyle(1, 0xff0000)
      .setDepth(91);

    // Show help if unlocked now that we spawned
    this.helpOverlay.setVisible(!this.isPointerLocked);

    // Hide spawn button once we've spawned
    this.nicknameOverlay?.["spawnBtn"]?.setVisible(false, true);
    
    // Show room code display now that spawn button is hidden
    this.roomCodeDisplay.setVisible(!this.isPointerLocked, true);

    if (this.isPointerLocked) {
      this.initializeCursorAtPointer();
    } else {
      this.hideCursorAndTether();
    }
  }

  /**
   * Handles local player position updates from server
   */
  private onLocalPlayerUpdate(x: number, y: number) {
    this.reconcileSystem.setServerPos(x, y);
    if (this.remoteReference) {
      this.remoteReference.x = x;
      this.remoteReference.y = y;
    }
  }

  /**
   * Handles remote player position updates
   */
  private onRemotePlayerUpdate(playerId: string, x: number, y: number) {
    const player = this.players[playerId];
    if (!player) return;
    player.setData("serverX", x);
    player.setData("serverY", y);
  }

  /**
   * Handles remote player leaving the game
   */
  private onRemotePlayerLeave(playerId: string) {
    this.players[playerId]?.destroy();
    delete this.players[playerId];
  }

  /* ------------------------------ Input Handling ------------------------------ */

  /**
   * Sets up pointer lock functionality
   */
  private wirePointerLock() {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      const canvas = this.game.canvas as HTMLCanvasElement;
      if (this.isCanvasLocked()) {
        document.exitPointerLock();
      } else {
        canvas.requestPointerLock?.();
      }
    });

    document.addEventListener("pointerlockchange", () => {
      this.setPointerLocked(this.isCanvasLocked());
    });
  }

  /**
   * Sets up pointer movement handling
   */
  private wirePointerMove() {
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const camera = this.cameras.main;
      
      if (this.isPointerLocked) {
        // Handle locked pointer movement
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
        // Handle unlocked pointer movement
        const worldPoint = camera.getWorldPoint(pointer.x, pointer.y);
        this.movementSystem.setMouseWorld(worldPoint.x, worldPoint.y);
        this.hideCursorAndTether();
      }
    });
  }

  /* ------------------------------ Pointer Lock Helpers ------------------------------ */

  /**
   * Checks if the canvas has pointer lock
   */
  private isCanvasLocked(): boolean {
    return document.pointerLockElement === this.game.canvas;
  }

  /**
   * Sets the pointer lock state and updates UI accordingly
   */
  private setPointerLocked(locked: boolean) {
    this.isPointerLocked = locked;
    this.movementSystem.setLocked(locked);

    // Only show help post-spawn
    const shouldShowHelp = !locked && !!this.localPlayer;
    this.helpOverlay.setVisible(shouldShowHelp);

    this.soundToggle?.setVisible(!locked);
    // Only show room code display when unlocked AND player has spawned
    this.roomCodeDisplay?.setVisible(!locked && !!this.localPlayer);
    this.updateUnlockedClass();

    if (locked && this.localPlayer) {
      this.initializeCursorAtPointer();
    } else {
      this.hideCursorAndTether();
    }
  }

  /**
   * Initializes cursor position at current pointer location
   */
  private initializeCursorAtPointer() {
    this.virtualCursor.x = this.input.activePointer.worldX;
    this.virtualCursor.y = this.input.activePointer.worldY;
    this.cursorSystem.showAt(this.virtualCursor.x, this.virtualCursor.y);
  }

  /**
   * Hides cursor and tether visuals
   */
  private hideCursorAndTether() {
    this.cursorSystem.hide();
    this.tetherSystem.hide();
  }

  /**
   * Updates the unlocked class on the game container
   */
  private updateUnlockedClass() {
    const element = document.getElementById(CONFIG.ui.containerId);
    if (!element) return;
    element.classList[this.isPointerLocked ? "remove" : "add"](CONFIG.ui.unlockedClass);
  }

  /* ------------------------------ Cleanup ------------------------------ */

  /**
   * Cleans up all resources when leaving the scene
   */
  private cleanup() {
    // Destroy all player sprites
    Object.values(this.players).forEach((sprite) => sprite?.destroy());
    this.players = {};
    this.localPlayer = undefined;
    
    // Destroy debug reference
    this.remoteReference?.destroy();
    this.remoteReference = undefined;
    
    // Destroy systems
    this.cursorSystem?.destroy();
    this.tetherSystem?.destroy();
    
    // Destroy UI components
    this.helpOverlay?.destroy();
    this.soundToggle?.destroy();
    this.roomCodeDisplay?.destroy();
    this.nicknameOverlay?.destroy();

    // Clear ducks
    this.ducksLayer?.clear();
  }
}
