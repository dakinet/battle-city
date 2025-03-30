// client/src/components/Game.js
import React, { useEffect, useRef, useState } from 'react';
import GameCanvas from './GameCanvas';
import GameIntro from './GameIntro';
import GameOver from './GameOver';

function Game({ gameData, playerId, sendInput, socket }) {
  const keysPressed = useRef({});
  const [showIntro, setShowIntro] = useState(true);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [showLevelTransition, setShowLevelTransition] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState('');
  const [finalScore, setFinalScore] = useState(0);
  const [playerLives, setPlayerLives] = useState(3);
  const [enemiesLeft, setEnemiesLeft] = useState(20);
  const [playerScore, setPlayerScore] = useState(0);
  const [playerStars, setPlayerStars] = useState(0);

  // Simplified intro handler
  const handleIntroComplete = () => {
    console.log("Intro completed, starting game!");
    setShowIntro(false);
  };

  // Sound effects - more complete with all the new sounds
  const sounds = useRef({
    shoot: new Audio('/sounds/ShotBullet.wav'),
    explosion: new Audio('/sounds/EnemyDestroy.wav'),
    playerDeath: new Audio('/sounds/PlayerDeath.wav'),
    tankMove: new Audio('/sounds/TankMove.wav'),
    tankStay: new Audio('/sounds/TankStay.wav'),
    levelComplete: new Audio('/sounds/LevelComplete.wav'),
    wallHit: new Audio('/sounds/TankHit.wav'),
    lifeUp: new Audio('/sounds/Life.wav'),
    improvement: new Audio('/sounds/Improvement.wav')
  });

  // Preload all sounds
  useEffect(() => {
    Object.values(sounds.current).forEach(sound => {
      sound.load();
    });
  }, []);

  // Sound handler
  const playSound = (soundName) => {
    try {
      const sound = sounds.current[soundName];
      if (sound) {
        sound.currentTime = 0;
        sound.play().catch(e => console.log("Audio play error:", e));
      }
    } catch (error) {
      console.log(`Could not play ${soundName} sound:`, error);
    }
  };

  // Listen for server-triggered sounds
  useEffect(() => {
    if (!socket) return;
    
    const handlePlaySound = ({ sound }) => {
      playSound(sound);
    };
    
    socket.on('playSound', handlePlaySound);
    
    return () => {
      socket.off('playSound', handlePlaySound);
    };
  }, [socket]);

  // Update game state when data changes
  useEffect(() => {
    if (!gameData) return;
    
    // Update player stats if available
    if (gameData.tanks && gameData.tanks.length > 0) {
      const playerTank = gameData.tanks.find(tank => tank.id === playerId);
      if (playerTank && playerTank.lives !== undefined) {
        setPlayerLives(playerTank.lives);
      }
    }
    
    // Update enemy count
    if (gameData.enemyTanks !== undefined) {
      setEnemiesLeft(gameData.remainingEnemies + gameData.enemyTanks.length);
    }
    
    // Handle explosions for sound effects
    if (gameData.explosions && gameData.explosions.length > 0) {
      // Find new explosions (age 0)
      const newExplosions = gameData.explosions.filter(exp => exp.age === 0);
      if (newExplosions.length > 0) {
        playSound('explosion');
      }
    }
    
    // Handle level completion
    if (gameData.levelCompleted) {
      playSound('levelComplete');
    }
    
    // Handle game over
    if (gameData.gameOver && !isGameOver) {
      setIsGameOver(true);
      setGameOverReason(gameData.baseDestroyed ? 'Base Destroyed' : 'All Players Eliminated');
      
      // Calculate final score
      if (playerId && gameData.players) {
        const player = gameData.players.find(p => p.id === playerId);
        if (player) {
          setFinalScore(player.score);
        }
      }
    }
  }, [gameData, playerId, isGameOver]);

  // Listen for level changes
  useEffect(() => {
    if (!socket) return;
    
    const handleLevelChange = ({ level }) => {
      setCurrentLevel(level);
      // Show level transition
      setShowLevelTransition(true);
      setTimeout(() => setShowLevelTransition(false), 3000);
      playSound('levelComplete');
    };
    
    const handleGameOver = ({ reason }) => {
      setIsGameOver(true);
      setGameOverReason(reason);
      
      // Find player's final score
      if (gameData && gameData.players) {
        const player = gameData.players.find(p => p.id === playerId);
        if (player) {
          setFinalScore(player.score);
        }
      }
    };
    
    const handlePlayerHit = ({ playerId: hitPlayerId, lives }) => {
      if (hitPlayerId === playerId) {
        setPlayerLives(lives);
        playSound('playerDeath');
      }
    };
    
    const handleScoreUpdate = ({ playerId: scoringPlayerId, score }) => {
      if (scoringPlayerId === playerId) {
        setPlayerScore(score);
      }
    };
    
    const handlePowerUpCollected = ({ playerId: collectingPlayerId, powerUpType }) => {
      if (collectingPlayerId === playerId) {
        playSound('improvement');
        
        // Update stars if star powerup
        if (powerUpType === 'star') {
          setPlayerStars(prev => Math.min(prev + 1, 3));
        }
        
        // Extra life sound
        if (powerUpType === 'tank') {
          playSound('lifeUp');
        }
      }
    };
    
    const handleGamePaused = (isPaused) => {
      setIsPaused(isPaused);
    };
    
    socket.on('levelChanged', handleLevelChange);
    socket.on('gameOver', handleGameOver);
    socket.on('playerHit', handlePlayerHit);
    socket.on('scoreUpdate', handleScoreUpdate);
    socket.on('powerUpCollected', handlePowerUpCollected);
    socket.on('gamePaused', handleGamePaused);
    
    return () => {
      socket.off('levelChanged', handleLevelChange);
      socket.off('gameOver', handleGameOver);
      socket.off('playerHit', handlePlayerHit);
      socket.off('scoreUpdate', handleScoreUpdate);
      socket.off('powerUpCollected', handlePowerUpCollected);
      socket.off('gamePaused', handleGamePaused);
    };
  }, [socket, playerId, gameData]);

  // Handle keyboard input
  useEffect(() => {
    if (showIntro || isGameOver || isPaused) {
      return;
    }
    
    console.log("Setting up keyboard handlers");
    
    const handleKeyDown = (e) => {
      // Prevent default behavior for arrow keys and space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'p', 'P'].includes(e.key)) {
        e.preventDefault();
      }
      
      // Toggle pause
      if (e.key === 'p' || e.key === 'P') {
        socket.emit('togglePause', gameData.roomId);
        return;
      }
      
      keysPressed.current[e.key] = true;
      
      // Handle shooting with spacebar
      if (e.key === ' ' || e.code === 'Space') {
        playSound('shoot');
        sendInput({ shoot: true });
      }
    };
    
    const handleKeyUp = (e) => {
      keysPressed.current[e.key] = false;
      
      // Stop tank movement sound
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        try {
          sounds.current.tankMove.pause();
          sounds.current.tankMove.currentTime = 0;
          // When stopped, play idle sound
          sounds.current.tankStay.currentTime = 0;
          sounds.current.tankStay.play().catch(e => console.log("Audio play error:", e));
        } catch (error) {
          console.log("Could not handle sound transition:", error);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Input loop for continuous movement
    const inputInterval = setInterval(() => {
      if (isPaused) return;
      
      let direction = null;
      
      if (keysPressed.current['ArrowUp']) {
        direction = 'up';
      } else if (keysPressed.current['ArrowDown']) {
        direction = 'down';
      } else if (keysPressed.current['ArrowLeft']) {
        direction = 'left';
      } else if (keysPressed.current['ArrowRight']) {
        direction = 'right';
      }
      
      if (direction) {
        try {
          // Play movement sound if it's not already playing
          if (sounds.current.tankMove.paused) {
            sounds.current.tankStay.pause(); // Stop idle sound
            sounds.current.tankMove.currentTime = 0;
            sounds.current.tankMove.play().catch(e => console.log("Audio play error:", e));
          }
        } catch (error) {
          console.log("Could not play tank move sound:", error);
        }
        sendInput({ direction });
      }
    }, 30);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(inputInterval);
      
      // Clean up sounds
      Object.values(sounds.current).forEach(sound => {
        sound.pause();
        sound.currentTime = 0;
      });
    };
  }, [sendInput, showIntro, isGameOver, isPaused, socket, gameData]);

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    const gameContainer = document.getElementById('game-container');
    
    if (!document.fullscreenElement) {
      if (gameContainer.requestFullscreen) {
        gameContainer.requestFullscreen();
      } else if (gameContainer.mozRequestFullScreen) {
        gameContainer.mozRequestFullScreen();
      } else if (gameContainer.webkitRequestFullscreen) {
        gameContainer.webkitRequestFullscreen();
      } else if (gameContainer.msRequestFullscreen) {
        gameContainer.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };
  
  // Add fullscreen change handlers
  useEffect(() => {
    const handleFullscreenChange = () => {
      const gameContainer = document.getElementById('game-container');
      if (document.fullscreenElement) {
        gameContainer.classList.add('fullscreen');
      } else {
        gameContainer.classList.remove('fullscreen');
      }
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);
  
  // Force game to start after 10 seconds if intro doesn't complete
  useEffect(() => {
    if (!showIntro) return;
    
    const forceStartTimer = setTimeout(() => {
      console.log("Force starting game after timeout");
      setShowIntro(false);
    }, 10000);
    
    return () => clearTimeout(forceStartTimer);
  }, [showIntro]);

  // Add CSS for fullscreen
  useEffect(() => {
    // Add CSS for fullscreen to document head
    const style = document.createElement('style');
    style.textContent = `
      .game-container.fullscreen {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background-color: black !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        align-items: center !important;
        z-index: 1000 !important;
      }
      
      .game-container.fullscreen .game-canvas {
        width: 80vh !important;
        height: 80vh !important;
      }
      
      .game-container.fullscreen .game-score-display,
      .game-container.fullscreen .enemy-icons,
      .game-container.fullscreen .game-controls-info {
        transform: scale(2);
        margin: 20px 0;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Styles for UI elements
  const scoreDisplayStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    width: '416px',
    padding: '5px 0',
    backgroundColor: '#000',
    color: 'white',
    fontFamily: 'Courier New, monospace',
    marginTop: '5px'
  };
  
  const textStyle = {
    color: '#ffcc00',
    fontWeight: 'bold'
  };
  
  const starIconStyle = {
    color: '#ffcc00',
    marginLeft: '2px'
  };
  
  const enemyIconsStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    margin: '5px 0',
    justifyContent: 'center',
    width: '416px',
  };
  
  const iconStyle = {
    width: '8px',
    height: '8px',
    margin: '2px',
    backgroundColor: '#ff6666',
    display: 'inline-block'
  };
  
  const levelTransitionStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '416px',
    height: '416px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100
  };
  
  const levelTextStyle = {
    color: '#ffcc00',
    fontSize: '32px',
    fontWeight: 'bold',
    fontFamily: 'Courier New, monospace'
  };
  
  const pauseOverlayStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '416px',
    height: '416px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: isPaused ? 'flex' : 'none',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 101
  };
  
  const pauseTextStyle = {
    color: '#ffcc00',
    fontSize: '32px',
    fontWeight: 'bold',
    fontFamily: 'Courier New, monospace',
    marginBottom: '20px'
  };

  if (!gameData) {
    return <div>Loading game data...</div>;
  }
  
  if (isGameOver) {
    return (
      <GameOver 
        reason={gameOverReason}
        score={finalScore}
        level={currentLevel}
        socket={socket}
      />
    );
  }

  return (
    <div id="game-container" className="game-container">
      <div className="game-header">
        <h2>Battle City</h2>
        <button onClick={toggleFullscreen} className="fullscreen-button">
          Toggle Fullscreen
        </button>
      </div>
      
      {showIntro ? (
        <GameIntro onComplete={handleIntroComplete} />
      ) : (
        <>
          <div style={scoreDisplayStyle} className="game-score-display">
            <div style={textStyle}>
              P1: {playerLives}
              <span style={starIconStyle}>
                {playerStars > 0 ? "★".repeat(playerStars) : ""}
              </span>
            </div>
            <div style={textStyle}>STAGE {currentLevel || 1}</div>
            <div style={textStyle}>
              SCORE: {playerScore}
            </div>
          </div>
  
          <div style={enemyIconsStyle} className="enemy-icons">
            <div style={textStyle}>ENEMY: {enemiesLeft}</div>
            {Array.from({ length: Math.min(enemiesLeft, 20) }).map((_, i) => (
              <div key={i} style={iconStyle} className="enemy-icon"></div>
            ))}
          </div>
          
          <div style={{ position: 'relative' }}>
            <GameCanvas gameData={gameData} playerId={playerId} />
            
            {showLevelTransition && (
              <div style={levelTransitionStyle}>
                <div style={levelTextStyle}>STAGE {currentLevel}</div>
              </div>
            )}
            
            <div style={pauseOverlayStyle}>
              <div style={pauseTextStyle}>PAUSED</div>
              <p style={{color: 'white'}}>Press P to resume</p>
            </div>
          </div>
        </>
      )}
      
      <div className="game-controls-info">
        <p>Controls: Arrow keys to move, Space to shoot, P to pause</p>
      </div>
    </div>
  );
}

export default Game;