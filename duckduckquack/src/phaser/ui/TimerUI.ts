import Phaser from "phaser";
import { CONFIG } from "../config";

/**
 * Timer UI component that displays elapsed seconds since playing phase started
 */
export class TimerUI {
  private scene: Phaser.Scene;
  private timerText?: Phaser.GameObjects.Text;
  private playingPhaseStartTime = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Creates the timer text element
   */
  create() {
    this.timerText = this.scene.add.text(
      CONFIG.world.width / 2,
      CONFIG.world.height / 2,
      "0",
      {
        fontSize: "128px",
        color: "#404040",
        stroke: "#000000",
        strokeThickness: 0,
        fontFamily: "Fredoka, sans-serif"
      }
    );
    this.timerText.setOrigin(0.5, 0.5);
    this.timerText.setDepth(2);
    this.timerText.setVisible(false);
  }

  /**
   * Updates the timer state from server
   */
  setTimerState(startTime: number) {
    this.playingPhaseStartTime = startTime;
    this.updateVisibility();
  }

  /**
   * Updates the timer display with current elapsed seconds
   */
  update() {
    if (!this.timerText || this.playingPhaseStartTime === 0) return;

    const currentTime = Date.now();
    const elapsedMs = currentTime - this.playingPhaseStartTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    
    // Easter egg: show "nice ;)" when timer reaches 69 seconds
    if (elapsedSeconds === 69) {
      this.timerText.setText("Nice");
    } else {
      this.timerText.setText(elapsedSeconds.toString());
    }
  }

  /**
   * Updates timer visibility based on current state
   */
  private updateVisibility() {
    if (!this.timerText) return;

    const shouldShow = this.playingPhaseStartTime > 0;
    this.timerText.setVisible(shouldShow);
  }

  /**
   * Sets the visibility of the timer
   */
  setVisible(visible: boolean) {
    this.timerText?.setVisible(visible);
  }

  /**
   * Destroys the timer UI component
   */
  destroy() {
    this.timerText?.destroy();
    this.timerText = undefined;
  }
}
