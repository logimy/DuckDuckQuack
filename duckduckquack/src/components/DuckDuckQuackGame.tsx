import { useEffect, useRef, useState, useCallback } from "react";
import { createPhaserGame } from "../phaser/createGame";
import { LobbyScreen } from "./LobbyScreen";
import { WinScreen } from "./WinScreen";
import { NicknameOverlay } from "./NicknameOverlay";
import type { PhaserGame } from "../phaser/types";

interface DuckDuckQuackGameProps {
  roomCode: string;
}

interface Player {
  nickname: string;
}

interface GameOptions {
  colors: string[];
  ducksCount: number;
}

const DEFAULT_GAME_OPTIONS: GameOptions = {
  colors: ["#ff4d4f", "#52c41a", "#1677ff", "#ffff00"],
  ducksCount: 4
};

export default function DuckDuckQuackGame({ roomCode }: DuckDuckQuackGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<PhaserGame | null>(null);
  
  const [isLobbyVisible, setIsLobbyVisible] = useState(false);
  const [isWinScreenVisible, setIsWinScreenVisible] = useState(false);
  const [isNicknameOverlayVisible, setIsNicknameOverlayVisible] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matchTime, setMatchTime] = useState(0);
  const [gameOptions, setGameOptions] = useState<GameOptions>(DEFAULT_GAME_OPTIONS);

  useEffect(() => {
    if (!containerRef.current) return;

    const game = createPhaserGame(containerRef.current, roomCode);
    gameRef.current = game;

    const handlePhaseChange = (phase: string) => {
      setIsLobbyVisible(phase === 'lobby');
      setIsWinScreenVisible(phase === 'ended');
    };

    const handlePlayersUpdate = (playerList: Player[]) => {
      setPlayers(playerList);
    };

    const handleGameOptionsUpdate = (options: GameOptions) => {
      setGameOptions(options);
    };

    const handleMatchTimeUpdate = (time: number) => {
      setMatchTime(time);
    };

    game.events.on('phaseChanged', handlePhaseChange);
    game.events.on('playersUpdated', handlePlayersUpdate);
    game.events.on('gameOptionsUpdated', handleGameOptionsUpdate);
    game.events.on('matchTimeUpdated', handleMatchTimeUpdate);

    return () => {
      game.events.off('phaseChanged', handlePhaseChange);
      game.events.off('playersUpdated', handlePlayersUpdate);
      game.events.off('gameOptionsUpdated', handleGameOptionsUpdate);
      game.events.off('matchTimeUpdated', handleMatchTimeUpdate);
      game.destroy(true);
      gameRef.current = null;
    };
  }, [roomCode]);

  const handleUpdateGameOptions = useCallback((options: Partial<GameOptions>) => {
    setGameOptions(prevOptions => {
      const newOptions = { ...prevOptions, ...options };
      gameRef.current?.events.emit('updateGameOptions', newOptions);
      return newOptions;
    });
  }, []);

  const handlePlayAgain = useCallback(() => {
    gameRef.current?.events.emit('playAgain');
  }, []);

  const handleStartGame = useCallback(() => {
    gameRef.current?.events.emit('startGame');
  }, []);

  const handleNicknameJoin = useCallback((nickname: string) => {
    setIsNicknameOverlayVisible(false);
    // Send the nickname to the Phaser game
    gameRef.current?.events.emit('nicknameEntered', nickname);
  }, []);

  return (
    <div style={{ position: 'relative', height: 800 }}>
      <div
        ref={containerRef}
        id="game-container"
        style={{
          width: "800px",
          height: "800px",
          position: "absolute",
          top: "0",
          left: "0",
          zIndex: 1,
        }}
      >
        <svg className="ants" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <rect className="ants__rect" x="0" y="0" width="100" height="100" />
        </svg>
      </div>
      
      <LobbyScreen
        isVisible={isLobbyVisible}
        players={players}
        gameOptions={gameOptions}
        onUpdateGameOptions={handleUpdateGameOptions}
        onStartGame={handleStartGame}
      />
      
      <WinScreen
        isVisible={isWinScreenVisible}
        players={players}
        matchTime={matchTime}
        onPlayAgain={handlePlayAgain}
      />
      
      <NicknameOverlay
        isVisible={isNicknameOverlayVisible}
        initialNickname={localStorage.getItem('ddq_nick')}
        onJoin={handleNicknameJoin}
      />
    </div>
  );
}
