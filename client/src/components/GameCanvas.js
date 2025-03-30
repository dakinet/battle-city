// client/src/components/GameCanvas.js
import React, { useRef, useEffect, useState } from 'react';
import spritesImage from '../assets/sprites.png';

function GameCanvas({ gameData, playerId }) {
  const canvasRef = useRef(null);
  const [animationFrame, setAnimationFrame] = useState(0);
  const [sprites, setSprites] = useState(null);
  const [explosions, setExplosions] = useState([]);
  
  // Load sprite sheet
  useEffect(() => {
    const img = new Image();
    img.src = spritesImage;
    img.onload = () => {
      console.log("Sprites loaded successfully");
      setSprites(img);
    };
    img.onerror = (err) => {
      console.error("Failed to load sprites:", err);
    };
  }, []);
  
  // Animation timer
  useEffect(() => {
    const timer = setInterval(() => {
      setAnimationFrame(prev => (prev + 1) % 2); // Toggle between 0 and 1 for tank animations
    }, 200); // Change animation frame every 200ms
    
    return () => clearInterval(timer);
  }, []);
  
  // Track and update explosions from game data
  useEffect(() => {
    if (!gameData) return;
    
    if (gameData.explosions && gameData.explosions.length > 0) {
      setExplosions(gameData.explosions);
    }
  }, [gameData]);
  
  // Main rendering function
  useEffect(() => {
    if (!gameData) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Clear the canvas
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // If sprites aren't loaded yet, draw placeholder shapes
    if (!sprites) {
      drawPlaceholders(ctx, gameData, playerId, animationFrame, explosions);
      return;
    }
    
    // Draw using sprites
    drawWithSprites(ctx, gameData, playerId, sprites, animationFrame, explosions);
    
  }, [gameData, playerId, animationFrame, sprites, explosions]);
  
  // Function to draw explosion animation
  const drawExplosion = (ctx, explosion, spriteImg) => {
    // If we have sprites, use them
    if (spriteImg) {
      // Calculate frame based on explosion age
      const frameIndex = Math.min(Math.floor(explosion.age / 2), 3);
      
      // Draw explosion sprite from sprite sheet
      // Source coordinates will depend on your sprite sheet layout
      ctx.drawImage(
        spriteImg,
        336 + (frameIndex * 16), 16, // Adjust based on your sprite sheet
        16, 16,
        explosion.x * 16, explosion.y * 16,
        16, 16
      );
    } else {
      // Fallback to colored circles if sprites aren't loaded
      const size = Math.min(explosion.age, 8);
      const colors = ['#FFF', '#FFD700', '#FF8C00', '#FF4500'];
      const colorIndex = Math.min(Math.floor(explosion.age / 2), colors.length - 1);
      
      ctx.fillStyle = colors[colorIndex];
      ctx.beginPath();
      ctx.arc(
        explosion.x * 16 + 8, 
        explosion.y * 16 + 8, 
        size, 
        0, 
        Math.PI * 2
      );
      ctx.fill();
    }
  };
  
  // Draw eagle/base
  const drawEagle = (ctx, basePosition, spriteImg) => {
    if (spriteImg) {
      // Draw eagle from sprite sheet
      ctx.drawImage(
        spriteImg,
        304, 32, // Eagle sprite location in sprite sheet - adjust based on your sprite sheet
        16, 16,
        basePosition.x * 16, basePosition.y * 16,
        16, 16
      );
    } else {
      // Fallback if sprites aren't loaded
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.moveTo(basePosition.x * 16 + 8, basePosition.y * 16);
      ctx.lineTo(basePosition.x * 16, basePosition.y * 16 + 16);
      ctx.lineTo(basePosition.x * 16 + 16, basePosition.y * 16 + 16);
      ctx.closePath();
      ctx.fill();
    }
  };
  
  // Function to draw using placeholder shapes (for debugging)
  const drawPlaceholders = (ctx, gameData, playerId, frame, explosions) => {
    // Draw map elements
    if (gameData.map) {
      // Draw brick walls
      ctx.fillStyle = '#963c08';
      if (gameData.map.walls) {
        gameData.map.walls.forEach(wall => {
          ctx.fillRect(wall.x * 16, wall.y * 16, 16, 16);
        });
      }
      
      // Draw steel walls
      ctx.fillStyle = '#b9b9b9';
      if (gameData.map.steelWalls) {
        gameData.map.steelWalls.forEach(wall => {
          ctx.fillRect(wall.x * 16, wall.y * 16, 16, 16);
        });
      }
      
      // Draw base/eagle
      if (gameData.map.basePosition) {
        drawEagle(ctx, gameData.map.basePosition);
      }
    }
    
    // Draw player tanks
    if (gameData.tanks) {
      gameData.tanks.forEach(tank => {
        // Draw tank body
        ctx.fillStyle = tank.id === playerId ? '#FFD700' : '#00FF00';
        ctx.fillRect(tank.x * 16, tank.y * 16, 16, 16);
        
        // Draw tank cannon based on direction
        ctx.fillStyle = '#000000';
        switch (tank.direction) {
          case 'up':
            ctx.fillRect(tank.x * 16 + 7, tank.y * 16 - 4, 2, 8);
            break;
          case 'down':
            ctx.fillRect(tank.x * 16 + 7, tank.y * 16 + 12, 2, 8);
            break;
          case 'left':
            ctx.fillRect(tank.x * 16 - 4, tank.y * 16 + 7, 8, 2);
            break;
          case 'right':
            ctx.fillRect(tank.x * 16 + 12, tank.y * 16 + 7, 8, 2);
            break;
          default:
            break;
        }
      });
    }
    
    // Draw enemy tanks
    if (gameData.enemyTanks) {
      gameData.enemyTanks.forEach(tank => {
        // Draw enemy tank body
        ctx.fillStyle = tank.type === 'fast' ? '#FF0000' : '#FF8C00';
        ctx.fillRect(tank.x * 16, tank.y * 16, 16, 16);
        
        // Draw tank cannon
        ctx.fillStyle = '#000000';
        switch (tank.direction) {
          case 'up':
            ctx.fillRect(tank.x * 16 + 7, tank.y * 16 - 4, 2, 8);
            break;
          case 'down':
            ctx.fillRect(tank.x * 16 + 7, tank.y * 16 + 12, 2, 8);
            break;
          case 'left':
            ctx.fillRect(tank.x * 16 - 4, tank.y * 16 + 7, 8, 2);
            break;
          case 'right':
            ctx.fillRect(tank.x * 16 + 12, tank.y * 16 + 7, 8, 2);
            break;
          default:
            break;
        }
      });
    }
    
    // Draw bullets
    if (gameData.bullets) {
      ctx.fillStyle = '#FFFFFF';
      gameData.bullets.forEach(bullet => {
        ctx.fillRect(bullet.x * 16 + 6, bullet.y * 16 + 6, 4, 4);
      });
    }
    
    // Draw explosions
    if (explosions && explosions.length > 0) {
      explosions.forEach(explosion => {
        drawExplosion(ctx, explosion);
      });
    }
  };
  
  // Function to draw using sprite sheet
  const drawWithSprites = (ctx, gameData, playerId, spriteImg, frame, explosions) => {
    // Draw map elements
    if (gameData.map) {
      // Draw brick walls
      if (gameData.map.walls) {
        gameData.map.walls.forEach(wall => {
          ctx.drawImage(
            spriteImg,
            256, 0, // Source x, y in sprite sheet - adjust based on your sprite sheet
            16, 16, // Source width, height
            wall.x * 16, wall.y * 16, // Destination x, y
            16, 16 // Destination width, height
          );
        });
      }
      
      // Draw steel walls
      if (gameData.map.steelWalls) {
        gameData.map.steelWalls.forEach(wall => {
          ctx.drawImage(
            spriteImg,
            272, 0, // Source x, y in sprite sheet - adjust based on your sprite sheet
            16, 16, // Source width, height
            wall.x * 16, wall.y * 16, // Destination x, y
            16, 16 // Destination width, height
          );
        });
      }
      
      // Draw base/eagle
      if (gameData.map.basePosition) {
        drawEagle(ctx, gameData.map.basePosition, spriteImg);
      }
    }
    
    // Draw player tanks
    if (gameData.tanks) {
      gameData.tanks.forEach(tank => {
        const isCurrentPlayer = tank.id === playerId;
        const yPos = isCurrentPlayer ? 0 : 16; // Player 1 or Player 2 sprites
        let xPos = 0;
        
        // Set x position based on direction and animation frame
        switch (tank.direction) {
          case 'up':
            xPos = frame * 16;
            break;
          case 'right':
            xPos = 32 + (frame * 16);
            break;
          case 'down':
            xPos = 64 + (frame * 16);
            break;
          case 'left':
            xPos = 96 + (frame * 16);
            break;
          default:
            xPos = 0;
        }
        
        // Draw tank sprite
        ctx.drawImage(
          spriteImg,
          xPos, yPos,
          16, 16,
          tank.x * 16, tank.y * 16,
          16, 16
        );
      });
    }
    
    // Draw enemy tanks
    if (gameData.enemyTanks) {
      gameData.enemyTanks.forEach(tank => {
        let yPos = 32; // Basic enemy tank
        
        // Different enemy types
        if (tank.type === 'fast') yPos = 48;
        else if (tank.type === 'power') yPos = 64;
        else if (tank.type === 'armor') yPos = 80;
        
        let xPos = 0;
        switch (tank.direction) {
          case 'up':
            xPos = frame * 16;
            break;
          case 'right':
            xPos = 32 + (frame * 16);
            break;
          case 'down':
            xPos = 64 + (frame * 16);
            break;
          case 'left':
            xPos = 96 + (frame * 16);
            break;
          default:
            xPos = 0;
        }
        
        // Draw enemy tank sprite
        ctx.drawImage(
          spriteImg,
          xPos, yPos,
          16, 16,
          tank.x * 16, tank.y * 16,
          16, 16
        );
      });
    }
    
    // Draw bullets
    if (gameData.bullets) {
      gameData.bullets.forEach(bullet => {
        let xPos = 320;
        
        switch (bullet.direction) {
          case 'up':
            xPos = 320;
            break;
          case 'right':
            xPos = 324;
            break;
          case 'down':
            xPos = 328;
            break;
          case 'left':
            xPos = 332;
            break;
        }
        
        // Draw bullet sprite
        ctx.drawImage(
          spriteImg,
          xPos, 16, // Source x, y in sprite sheet
          4, 4, // Source width, height
          bullet.x * 16 + 6, bullet.y * 16 + 6, // Destination x, y
          4, 4 // Destination width, height
        );
      });
    }
    
    // Draw explosions
    if (explosions && explosions.length > 0) {
      explosions.forEach(explosion => {
        drawExplosion(ctx, explosion, spriteImg);
      });
    }
    
    // Draw power-ups if they exist
    if (gameData.powerUps && gameData.powerUps.length > 0) {
      gameData.powerUps.forEach(powerUp => {
        // Position in sprite sheet depends on power-up type
        let xPos = 352;
        let yPos = 32;
        
        // Adjust based on power-up type
        switch (powerUp.type) {
          case 'star':
            xPos = 352;
            break;
          case 'helmet':
            xPos = 368;
            break;
          case 'shovel':
            xPos = 384;
            break;
          case 'timer':
            xPos = 400;
            break;
          case 'grenade':
            xPos = 416;
            break;
          default:
            xPos = 352;
        }
        
        // Make power-ups blink
        if (Math.floor(Date.now() / 200) % 2 === 0) {
          ctx.drawImage(
            spriteImg,
            xPos, yPos,
            16, 16,
            powerUp.x * 16, powerUp.y * 16,
            16, 16
          );
        }
      });
    }
  };

  return (
    <canvas 
      ref={canvasRef} 
      width={416} 
      height={416} 
      className="game-canvas"
    />
  );
}

export default GameCanvas;