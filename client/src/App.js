import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

import MainMenu from './components/MainMenu';
import GameLobby from './components/GameLobby';
import Game from './components/Game';

const ENDPOINT = 'http://localhost:5001';
function App() {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState('menu'); // menu, lobby, playing
  const [roomId, setRoomId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    console.log("Attempting to connect to Socket.io server at:", ENDPOINT);
    const newSocket = io(ENDPOINT, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log("Socket connected successfully with ID:", newSocket.id);
      setIsConnected(true);
      setSocket(newSocket);
    });

    newSocket.on('connect_error', (err) => {
      console.error("Socket connection error:", err);
      setError("Failed to connect to game server. Please try again.");
    });

    newSocket.on('disconnect', () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    return () => {
      console.log("Cleaning up socket connection");
      newSocket.disconnect();
    };
  }, []);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;

    console.log("Setting up game event listeners");

    socket.on('roomCreated', (data) => {
      console.log("Room created:", data);
      setRoomId(data.roomId);
      setPlayerId(data.playerId);
      setPlayers([{ id: data.playerId, ready: false }]);
      setGameState('lobby');
    });

    socket.on('roomJoined', (data) => {
      console.log("Room joined:", data);
      setRoomId(data.roomId);
      setPlayerId(data.playerId);
      setGameState('lobby');
    });

    socket.on('playerJoined', (data) => {
      console.log("Player joined:", data);
      setPlayers(prev => [...prev, { id: data.playerId, ready: false }]);
    });

    socket.on('playerStatusUpdate', (updatedPlayers) => {
      console.log("Player status update:", updatedPlayers);
      setPlayers(updatedPlayers);
    });

    socket.on('playerLeft', (data) => {
      console.log("Player left:", data);
      setPlayers(prev => prev.filter(p => p.id !== data.playerId));
    });

    socket.on('gameStart', (initialGameState) => {
      console.log("Game started with initial state:", initialGameState);
      setGameData(initialGameState);
      setGameState('playing');
    });

    socket.on('gameStateUpdate', (updatedGameState) => {
      setGameData(updatedGameState);
    });

    socket.on('gameEnded', (data) => {
      console.log("Game ended:", data);
      alert(`Game ended: ${data.reason}`);
      setGameState('menu');
    });

    socket.on('error', (data) => {
      console.error("Game error:", data);
      setError(data.message);
      setTimeout(() => setError(null), 3000);
    });

    return () => {
      console.log("Removing game event listeners");
      socket.off('roomCreated');
      socket.off('roomJoined');
      socket.off('playerJoined');
      socket.off('playerStatusUpdate');
      socket.off('playerLeft');
      socket.off('gameStart');
      socket.off('gameStateUpdate');
      socket.off('gameEnded');
      socket.off('error');
    };
  }, [socket]);

  const createRoom = () => {
    console.log("Create room function called");
    if (socket && isConnected) {
      console.log("Emitting createRoom event");
      socket.emit('createRoom');
    } else {
      console.error("Cannot create room: Socket not connected");
      setError("Cannot connect to game server. Please refresh the page.");
    }
  };

  const joinRoom = (id) => {
    console.log("Join room function called with ID:", id);
    if (socket && isConnected && id) {
      console.log("Emitting joinRoom event with ID:", id);
      socket.emit('joinRoom', id);
    } else {
      console.error("Cannot join room: Socket not connected or ID missing");
      setError("Cannot connect to game server or room ID is invalid.");
    }
  };

  const setReady = () => {
    console.log("Set ready function called");
    if (socket && roomId) {
      console.log("Emitting playerReady event for room:", roomId);
      socket.emit('playerReady', roomId);
    }
  };

  const sendInput = (input) => {
    if (socket && roomId) {
      socket.emit('playerInput', { roomId, input });
    }
  };

  // Simple debug component to show connection status
  const ConnectionStatus = ({ isConnected }) => (
    <div style={{ 
      position: 'fixed', 
      bottom: '10px', 
      right: '10px', 
      padding: '5px', 
      background: isConnected ? '#4CAF50' : '#f44336',
      color: 'white',
      borderRadius: '4px',
      fontSize: '12px'
    }}>
      Server: {isConnected ? 'Connected' : 'Disconnected'}
    </div>
  );

  // Render different components based on game state
  const renderContent = () => {
    switch (gameState) {
      case 'menu':
        return <MainMenu onCreateGame={createRoom} onJoinGame={joinRoom} />;
      case 'lobby':
        return (
          <GameLobby
            roomId={roomId}
            players={players}
            playerId={playerId}
            onReady={setReady}
          />
        );
      case 'playing':
        return (
          <Game
            gameData={gameData}
            playerId={playerId}
            sendInput={sendInput}
          />
        );
      default:
        return <div>Loading...</div>;
    }
  };

  return (
    <div className="App">
      {error && <div className="error-message">{error}</div>}
      {renderContent()}
      <ConnectionStatus isConnected={isConnected} />
    </div>
  );
}

export default App;