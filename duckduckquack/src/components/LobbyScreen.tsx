import React, { useState, useEffect, useCallback } from 'react';
import './LobbyScreen.css';

interface Player {
  nickname: string;
}

interface GameOptions {
  colors: string[];
  ducksCount: number;
}

interface LobbyScreenProps {
  isVisible: boolean;
  players: Player[];
  gameOptions: GameOptions;
  onUpdateGameOptions: (options: Partial<GameOptions>) => void;
  onStartGame: () => void;
}

// Predefined colors for easy selection
const PREDEFINED_COLORS = [
  '#ff4d4f', // Red
  '#52c41a', // Green
  '#1677ff', // Blue
  '#ffff00', // Yellow
  '#722ed1', // Purple
  '#fa8c16', // Orange
  '#13c2c2', // Cyan
  '#eb2f96', // Pink
  '#52c41a', // Lime
  '#faad14'  // Gold
];

// Helper function to get player avatar color
const getPlayerAvatarColor = (nickname: string): string => {
  const colors = ['#ff4d4f', '#52c41a', '#1677ff', '#722ed1', '#fa8c16', '#13c2c2', '#eb2f96', '#faad14'];
  const index = nickname.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
};

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  isVisible,
  players,
  gameOptions,
  onUpdateGameOptions,
  onStartGame
}) => {
  const [hoveredColorIndex, setHoveredColorIndex] = useState<number | null>(null);

  // Track players and game options changes
  useEffect(() => {
    // Players updated
  }, [players]);

  useEffect(() => {
    // Game options updated
  }, [gameOptions]);

  // Handle React StrictMode - cleanup effect
  useEffect(() => {
    return () => {
      // Cleanup function for StrictMode
    };
  }, []);

  const handleColorRemove = useCallback((index: number, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent color picker from opening
    // Harsher validation: prevent deletion if only 2 colors remain
    if (gameOptions.colors.length > 2) {
      const newColors = [...gameOptions.colors];
      newColors.splice(index, 1);
      onUpdateGameOptions({ colors: newColors });
    }
  }, [gameOptions.colors, onUpdateGameOptions]);

  const handleColorClick = useCallback((index: number, event: React.MouseEvent) => {
    // Get the click position
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    // Create a hidden color input and trigger it
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = gameOptions.colors[index];
    colorInput.style.position = 'fixed';
    colorInput.style.top = `${y}px`;
    colorInput.style.left = `${x}px`;
    colorInput.style.width = '1px';
    colorInput.style.height = '1px';
    colorInput.style.opacity = '0';
    colorInput.style.pointerEvents = 'none';
    colorInput.style.zIndex = '9999';
    colorInput.style.border = 'none';
    colorInput.style.outline = 'none';
    
            colorInput.onchange = (e) => {
              const newColor = (e.target as HTMLInputElement).value;
              const newColors = [...gameOptions.colors];
              newColors[index] = newColor;
              onUpdateGameOptions({ colors: newColors });
              if (document.body.contains(colorInput)) {
                document.body.removeChild(colorInput);
              }
            };
    
    colorInput.onblur = () => {
      if (document.body.contains(colorInput)) {
        document.body.removeChild(colorInput);
      }
    };
    
    document.body.appendChild(colorInput);
    colorInput.click();
  }, [gameOptions.colors, onUpdateGameOptions]);

  const handleAddColorClick = useCallback(() => {
    if (gameOptions.colors.length < 8) {
      // Find available colors from predefined list
      const availableColors = PREDEFINED_COLORS.filter(color => 
        !gameOptions.colors.includes(color)
      );
      
      // If no predefined colors are available, generate a random one
      const newColor = availableColors.length > 0 
        ? availableColors[Math.floor(Math.random() * availableColors.length)]
        : `#${Math.floor(Math.random()*16777215).toString(16)}`;
      
      const newColors = [...gameOptions.colors, newColor];
      onUpdateGameOptions({ colors: newColors });
    }
  }, [gameOptions.colors, onUpdateGameOptions]);

  const handleDucksCountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const count = parseInt(e.target.value);
    // Harsher validation: minimum 2 ducks per color, maximum 20
    if (!isNaN(count) && count >= 2 && count <= 20) {
      onUpdateGameOptions({ ducksCount: count });
    }
  }, [onUpdateGameOptions]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="lobby-screen">
      <div className="lobby-content">
        {/* Header Section */}
        <div className="lobby-header">
          <div className="lobby-title-section">
            <h2 className="lobby-title">🎮 Game Lobby</h2>
            <div className="lobby-subtitle">Waiting for players to join...</div>
          </div>
          <div className="player-count-badge">
            <span className="player-count">{players.length}</span>
            <span className="player-count-label">Players</span>
          </div>
        </div>
        
        <div className="lobby-main-content">
          {/* Player List - Left Column */}
          <div className="player-list-section">            
            <div className="player-list">
              {players.length === 0 ? (
                <div className="no-players">
                  <div className="no-players-icon">🦆</div>
                  <div className="no-players-text">No players in lobby</div>
                  <div className="no-players-hint">Share the room code to invite friends!</div>
                </div>
              ) : (
                players.map((player, index) => (
                  <div key={index} className="player-item">
                    <div 
                      className="player-avatar"
                      style={{ backgroundColor: getPlayerAvatarColor(player.nickname) }}
                    >
                      {player.nickname.charAt(0).toUpperCase()}
                    </div>
                    <div className="player-info">
                      <span className="player-name">{player.nickname}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Room Settings - Right Column */}
          <div className="room-settings-section">     
            {/* Duck Colors */}
            <div className="setting-group">
              <label className="setting-label">
                <span className="setting-icon">🎨</span>
                Duck Colors
              </label>
              <div className="color-picker">
                {gameOptions.colors.map((color, index) => (
                  <div key={index} className="color-item">
                    <div
                      className="color-circle"
                      style={{ backgroundColor: color }}
                      onMouseEnter={() => setHoveredColorIndex(index)}
                      onMouseLeave={() => setHoveredColorIndex(null)}
                      onClick={(e) => handleColorClick(index, e)}
                    >
                      {hoveredColorIndex === index && gameOptions.colors.length > 2 && (
                        <div 
                          className="color-remove-icon"
                          onClick={(e) => handleColorRemove(index, e)}
                          title="Remove color"
                        >
                          ×
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {gameOptions.colors.length < 8 && (
                  <button
                    className="color-add-button"
                    onClick={handleAddColorClick}
                    title="Add new color"
                  >
                    <span className="add-icon">+</span>
                  </button>
                )}
              </div>
            </div>

            {/* Duck Count */}
            <div className="setting-group">
              <label className="setting-label">
                <span className="setting-icon">🦆</span>
                Ducks per Color
              </label>
              <div className="ducks-count-input">
                <button 
                  className="count-button count-decrease"
                  onClick={() => {
                    if (gameOptions.ducksCount > 2) {
                      onUpdateGameOptions({ ducksCount: gameOptions.ducksCount - 1 });
                    }
                  }}
                  disabled={gameOptions.ducksCount <= 2}
                >
                  −
                </button>
                <input
                  type="number"
                  min="2"
                  max="20"
                  value={gameOptions.ducksCount}
                  onChange={handleDucksCountChange}
                  className="number-input"
                />
                <button 
                  className="count-button count-increase"
                  onClick={() => {
                    if (gameOptions.ducksCount < 20) {
                      onUpdateGameOptions({ ducksCount: gameOptions.ducksCount + 1 });
                    }
                  }}
                  disabled={gameOptions.ducksCount >= 20}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Start Game Button */}
        <div className="start-game-section">
          <button 
            className="start-game-button"
            onClick={onStartGame}
            disabled={players.length === 0}
          >
            <span className="button-icon">🚀</span>
            <span className="button-text">Start Game</span>
          </button>
          {players.length === 0 && (
            <div className="start-game-hint">Add players to start the game</div>
          )}
        </div>
      </div>
    </div>
  );
};
