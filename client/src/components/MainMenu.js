import React, { useState } from 'react';

function MainMenu({ onCreateGame, onJoinGame }) {
  const [roomId, setRoomId] = useState('');

  const handleCreateGame = () => {
    console.log("Create game button clicked");
    onCreateGame();
  };

  const handleJoinGame = (e) => {
    e.preventDefault();
    console.log("Join game form submitted with room ID:", roomId);
    if (roomId.trim()) {
      onJoinGame(roomId.trim());
    }
  };

  return (
    <div className="main-menu">
      <h1 className="game-title">Battle City Multiplayer</h1>
      <div className="menu-buttons">
        <button 
          onClick={handleCreateGame} 
          className="menu-button"
          style={{cursor: 'pointer'}}
        >
          Create New Game
        </button>
        
        <div className="join-game-form">
          <input
            type="text"
            placeholder="Enter Room Code"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button 
            onClick={handleJoinGame} 
            className="menu-button"
            style={{cursor: 'pointer'}}
          >
            Join Game
          </button>
        </div>
        
        {/* Debug buttons */}
        <div style={{marginTop: '40px', padding: '10px', border: '1px solid #333'}}>
          <p>Debug Buttons</p>
          <button 
            onClick={() => console.log("Debug create clicked")} 
            style={{
              padding: '10px', 
              margin: '5px', 
              background: 'blue', 
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Debug Create
          </button>
          <button 
            onClick={() => console.log("Debug join clicked")} 
            style={{
              padding: '10px', 
              margin: '5px', 
              background: 'green', 
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Debug Join
          </button>
        </div>
      </div>
    </div>
  );
}

export default MainMenu;