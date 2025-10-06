import React, { useState, useEffect, useRef } from 'react';
import './NicknameOverlay.css';

interface NicknameOverlayProps {
  isVisible: boolean;
  initialNickname?: string | null;
  onJoin: (nickname: string) => void;
}

const NICKNAME_REGEX = /^[A-Za-z0-9_-]{3,16}$/;

export function NicknameOverlay({ isVisible, initialNickname, onJoin }: NicknameOverlayProps) {
  const [nickname, setNickname] = useState(initialNickname?.trim() || '');
  const [isEditing, setIsEditing] = useState(nickname.length === 0);
  const [hasJoined, setHasJoined] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isValid = NICKNAME_REGEX.test(nickname.trim());

  // Focus input when overlay becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  // Save nickname to localStorage when it changes
  useEffect(() => {
    if (nickname.trim()) {
      localStorage.setItem('ddq_nick', nickname.trim());
    }
  }, [nickname]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 16) {
      setNickname(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isValid) {
      setIsEditing(false);
    }
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleJoinClick = () => {
    if (isValid && !hasJoined) {
      setHasJoined(true);
      onJoin(nickname.trim());
    }
  };

  if (!isVisible) return null;

  return (
    <div className="nickname-overlay">
      <div className="nickname-panel">
        <h2 className="nickname-title">Type in your nickname</h2>
        
        <div className="nickname-input-container">
          {isEditing ? (
            <div className="nickname-input-wrapper">
              <input
                ref={inputRef}
                type="text"
                value={nickname}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="nickname-input"
                placeholder="Enter nickname"
                maxLength={16}
              />
              <button
                className={`nickname-check ${isValid ? 'valid' : 'invalid'}`}
                onClick={() => setIsEditing(false)}
                disabled={!isValid}
                title={isValid ? 'Save nickname' : 'Nickname must be 3-16 characters (letters, numbers, _, -)'}
              >
                ✓
              </button>
            </div>
          ) : (
            <div className="nickname-display-wrapper">
              <span className="nickname-display">{nickname}</span>
              <button
                className="nickname-edit"
                onClick={handleEditClick}
                title="Edit nickname"
              >
                ✏️
              </button>
            </div>
          )}
        </div>

        {!isEditing && isValid && !hasJoined && (
          <button
            className="join-button"
            onClick={handleJoinClick}
            disabled={hasJoined}
          >
            Join
          </button>
        )}
      </div>
    </div>
  );
}
