// client/src/components/GameHUD.js
import React from 'react';
import '../assets/sprites.css';

function GameHUD({ players, level, enemiesLeft }) {
  return (
    <div className="game-hud">
      <div className="player-stats">
        <div className="player1">
          <div className="player-label">1P</div>
          <div className="player-lives">
            {Array.from({ length: players[0]?.lives || 0 }).map((_, i) => (
              <div key={i} className="life-icon"></div>
            ))}
          </div>
        </div>
        
        {players.length > 1 && (
          <div className="player2">
            <div className="player-label">2P</div>
            <div className="player-lives">
              {Array.from({ length: players[1]?.lives || 0 }).map((_, i) => (
                <div key={i} className="life-icon"></div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="stage-info">
        <div className="stage-label">STAGE {level}</div>
      </div>
      
      <div className="enemies-left">
        <div className="enemies-label">ENEMY</div>
        <div className="enemy-icons">
          {Array.from({ length: Math.min(enemiesLeft, 20) }).map((_, i) => (
            <div key={i} className="enemy-icon"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GameHUD;