import './App.css';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import DuckDuckQuackGame from './components/DuckDuckQuackGame';
import { useEffect } from 'react';

/**
 * Generates a random 6-character room code
 */
const generateRoomCode = (): string => 
  Math.random().toString(36).substring(2, 8).toUpperCase();

/**
 * Validates room code format (6 characters)
 */
const isValidRoomCode = (code: string | undefined): boolean => 
  Boolean(code && code.length === 6);

/**
 * Home page component that redirects to a random room
 */
function HomePage() {
  const navigate = useNavigate();
  
  useEffect(() => {
    const roomCode = generateRoomCode();
    navigate(`/room/${roomCode}`, { replace: true });
  }, [navigate]);
  
  return <div>Creating new room...</div>;
}

/**
 * Room page component that validates room code and renders the game
 */
function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!isValidRoomCode(roomCode)) {
      navigate('/', { replace: true });
    }
  }, [roomCode, navigate]);
  
  if (!isValidRoomCode(roomCode)) {
    return <div>Invalid room code, redirecting...</div>;
  }
  
  return <DuckDuckQuackGame roomCode={roomCode!} />;
}

/**
 * Main application component with routing
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/room/:roomCode" element={<RoomPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
