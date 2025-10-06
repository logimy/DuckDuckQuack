import { useEffect, useRef } from "react";
import { createPhaserGame } from "../phaser/createGame";

interface DuckDuckQuackGameProps {
  roomCode: string;
}

/**
 * Game container component that initializes and manages the Phaser game instance
 */
export default function DuckDuckQuackGame({ roomCode }: DuckDuckQuackGameProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const game = createPhaserGame(containerRef.current, roomCode);

    return () => {
      game.destroy(true);
    };
  }, [roomCode]);

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
