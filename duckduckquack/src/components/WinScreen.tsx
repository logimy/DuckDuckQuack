import React from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import './WinScreen.css';

interface Player {
  nickname: string;
}

interface WinScreenProps {
  isVisible: boolean;
  players: Player[];
  matchTime: number; // Final game time in seconds
  onPlayAgain: () => void;
}

export const WinScreen: React.FC<WinScreenProps> = ({
  isVisible,
  players,
  matchTime,
  onPlayAgain
}) => {
  if (!isVisible) {
    return null;
  }

  // Format match time as MM:SS.mmm
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  return (
    <>
      {/* Confetti Animation - positioned relative to viewport */}
      <div className="confetti-container">
        <div className="confetti-wrapper">
          <DotLottieReact
            src="https://lottie.host/58a58fa8-04e3-44e3-9c2f-7070972e9db4/iLDMSTPpqJ.lottie"
            loop={false}
            autoplay
          />
        </div>
      </div>
      
      <div className="win-screen">
        <div className="win-content">
        <h2 className="win-title">🎉 You rock! 🎉</h2>
        
        <div className="win-main-content">
          {/* Match Time - Left Column */}
          <div className="match-time-section">
            <h3 className="section-title">Match Time</h3>
            <div className="time-display">
              <div className="time-value">{formatTime(matchTime)}</div>
              <div className="time-label">Total Time</div>
            </div>
          </div>

          {/* Player List - Right Column */}
          <div className="players-section">
            <h3 className="section-title">Players ({players.length})</h3>
            <div className="player-list">
              {players.length === 0 ? (
                <div className="no-players">No players</div>
              ) : (
                players.map((player, index) => (
                  <div key={index} className="player-item">
                    <div className="player-avatar">
                      {player.nickname.charAt(0).toUpperCase()}
                    </div>
                    <span className="player-name">{player.nickname}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Play Again Button */}
        <div className="play-again-section">
          <button 
            className="play-again-button"
            onClick={onPlayAgain}
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
    </>
  );
};
