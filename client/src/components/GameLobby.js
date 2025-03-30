import React from 'react';

function GameLobby({ roomId, players, playerId, onReady }) {
  const currentPlayer = players.find(p => p.id === playerId);
  const isReady = currentPlayer?.ready;

  return (
    <div className="game-lobby">
      <h1>Game Lobby</h1>
      
      <div className="room-info">
        <h2>Room Code: {roomId}</h2>
        <p>Share this code with your friend to join the game</p>
      </div>
      
      <div className="players-list">
        <h3>Players:</h3>
        <ul>
          {players.map((player, index) => (
            <li key={player.id} className={player.id === playerId ? 'current-player' : ''}>
              Player {index + 1}: {player.id === playerId ? 'You' : 'Opponent'} 
              {player.ready ? ' (Ready)' : ' (Not Ready)'}
            </li>
          ))}
        </ul>
      </div>
      
      {!isReady && (
        <button onClick={onReady} className="ready-button">
          I'm Ready!
        </button>
      )}
      
      {isReady && (
        <p>Waiting for all players to be ready...</p>
      )}
    </div>
  );
}

export default GameLobby;