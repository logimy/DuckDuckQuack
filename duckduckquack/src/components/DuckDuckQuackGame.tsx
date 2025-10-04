import { useEffect, useRef } from "react";
import { createPhaserGame } from "../phaser/createGame";

export default function DuckDuckQuackGame() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let game = createPhaserGame(containerRef.current);

    return () => {
      if (game) {
        game.destroy(true);
        game = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="game-container"
      style={{
        width: "800px",
        height: "800px",
        margin: "0 auto",
      }}
    >
      <svg className="ants" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect className="ants__rect" x="0" y="0" width="100" height="100" />
      </svg>
    </div>
  );
}
