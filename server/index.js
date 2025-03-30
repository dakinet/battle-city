const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

// Initialize Express app
const app = express();
app.use(cors());

// Create HTTP server and Socket.io instance
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Game state storage
const rooms = {};
// Track active game loops
const activeRooms = {};
// Game update rate (20 times per second)
const GAME_TICK_RATE = 50;

// Constants for game mechanics (more faithful to original)
const TANK_SPEEDS = {
  player: 0.05,     // Original has slower tank movement
  playerPowered: 0.08,
  enemyBasic: 0.04,
  enemyFast: 0.07,
  enemyPower: 0.04,
  enemyArmor: 0.03
};

const BULLET_SPEEDS = {
  player: 0.3,
  playerPowered: 0.4,
  enemy: 0.25
};

// Power-up types from original game
const POWERUP_TYPES = [
  'helmet',    // Temporary invincibility
  'clock',     // Freeze enemies temporarily
  'shovel',    // Upgrade base walls temporarily
  'star',      // Upgrade tank (faster, shoot faster)
  'grenade',   // Destroy all enemies on screen
  'tank'       // Extra life
];

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Create a new game room
  socket.on('createRoom', () => {
    const roomId = generateRoomId();
    rooms[roomId] = {
      id: roomId,
      players: [{ id: socket.id, ready: false, tankType: 'player1', lives: 3, score: 0, stars: 0 }],
      gameState: {
        tanks: [],
        bullets: [],
        map: generateDefaultMap(),
        enemyTanks: [],
        powerUps: [],
        explosions: [],
        remainingEnemies: 20, // Total enemies per level (original game had 20)
        level: 1,
        baseDestroyed: false,
        gameOver: false,
        isPaused: false
      },
      status: 'waiting',
      timers: {
        powerUpSpawn: null,
        enemySpawn: null
      }
    };
    
    socket.join(roomId);
    socket.emit('roomCreated', { roomId, playerId: socket.id });
    console.log(`Room created: ${roomId}`);
  });

  // Join an existing game room
  socket.on('joinRoom', (roomId) => {
    const room = rooms[roomId];
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }
    
    room.players.push({ 
      id: socket.id, 
      ready: false, 
      tankType: 'player2', 
      lives: 3, 
      score: 0, 
      stars: 0 
    });
    
    socket.join(roomId);
    socket.emit('roomJoined', { roomId, playerId: socket.id });
    io.to(roomId).emit('playerJoined', { playerId: socket.id });
    console.log(`Player ${socket.id} joined room ${roomId}`);
  });

  // Player is ready to start
  socket.on('playerReady', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (player) player.ready = true;
    
    io.to(roomId).emit('playerStatusUpdate', room.players);
    
    // Start game if all players are ready
    if ((room.players.length === 2 && room.players.every(p => p.ready)) || 
        (room.players.length === 1 && room.players[0].ready)) {
      room.status = 'playing';
      initializeGameState(room);
      
      // Start the game loop for this room
      startGameLoop(roomId);
      
      io.to(roomId).emit('gameStart', room.gameState);
      console.log(`Game started in room ${roomId}`);
    }
  });

  // Player input (movement and shooting)
  socket.on('playerInput', ({ roomId, input }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing' || room.gameState.isPaused) return;
    
    // Process player input and update game state
    processPlayerInput(room, socket.id, input);
  });
  
  // Pause/Resume game
  socket.on('togglePause', (roomId) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;
    
    room.gameState.isPaused = !room.gameState.isPaused;
    io.to(roomId).emit('gamePaused', room.gameState.isPaused);
  });

  // Handle player disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Find and clean up any rooms this player was in
    Object.keys(rooms).forEach(roomId => {
      const room = rooms[roomId];
      if (!room || !room.players) return;
      
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        io.to(roomId).emit('playerLeft', { playerId: socket.id });
        
        // Remove room if empty
        if (room.players.length === 0) {
          // Stop the game loop if it's running
          if (activeRooms[roomId]) {
            clearInterval(activeRooms[roomId]);
            delete activeRooms[roomId];
          }
          
          // Clear any other timers
          if (room.timers.powerUpSpawn) clearTimeout(room.timers.powerUpSpawn);
          if (room.timers.enemySpawn) clearTimeout(room.timers.enemySpawn);
          
          delete rooms[roomId];
          console.log(`Room ${roomId} removed`);
        } else if (room.status === 'playing') {
          // End game if a player leaves during gameplay
          room.status = 'ended';
          
          // Stop the game loop
          if (activeRooms[roomId]) {
            clearInterval(activeRooms[roomId]);
            delete activeRooms[roomId];
          }
          
          // Clear any other timers
          if (room.timers.powerUpSpawn) clearTimeout(room.timers.powerUpSpawn);
          if (room.timers.enemySpawn) clearTimeout(room.timers.enemySpawn);
          
          io.to(roomId).emit('gameEnded', { reason: 'Player disconnected' });
        }
      }
    });
  });
  
  // New endpoint to get high scores
  socket.on('getHighScores', () => {
    // In a real implementation, this would come from a database
    const highScores = [
      { name: 'AAA', score: 20000 },
      { name: 'BBB', score: 15000 },
      { name: 'CCC', score: 12000 },
      { name: 'DDD', score: 10000 },
      { name: 'EEE', score: 8000 }
    ];
    
    socket.emit('highScores', highScores);
  });
  
  // Save high score
  socket.on('saveHighScore', ({ name, score }) => {
    // In a real implementation, this would be saved to a database
    console.log(`New high score: ${name} - ${score}`);
    socket.emit('highScoreSaved');
  });
});

// Function to start the game loop for a room
function startGameLoop(roomId) {
  console.log(`Starting game loop for room ${roomId}`);
  
  if (activeRooms[roomId]) {
    console.log(`Game loop already running for room ${roomId}`);
    return;
  }
  
  const room = rooms[roomId];
  
  // Schedule first enemy spawn
  scheduleEnemySpawn(room);
  
  // Schedule first power-up spawn (30-60 seconds)
  schedulePowerUpSpawn(room);
  
  let frameCount = 0;
  
  activeRooms[roomId] = setInterval(() => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') {
      console.log(`Stopping game loop for room ${roomId} - game no longer active`);
      clearInterval(activeRooms[roomId]);
      delete activeRooms[roomId];
      return;
    }
    
    // Skip updates if game is paused
    if (room.gameState.isPaused) return;
    
    // Log every 100 frames (5 seconds)
    if (frameCount % 100 === 0) {
      console.log(`Game loop running - frame ${frameCount} for room ${roomId}`);
      console.log(`Remaining enemies: ${room.gameState.remainingEnemies}, Active enemies: ${room.gameState.enemyTanks.length}`);
      
      // Log player stats
      room.players.forEach((player, index) => {
        console.log(`Player ${index + 1}: Lives: ${player.lives}, Score: ${player.score}, Stars: ${player.stars}`);
      });
    }
    
    // Update game state
    updateGameState(room);
    
    // Check victory conditions
    checkVictoryConditions(room);
    
    // Broadcast updated game state to all players in the room
    io.to(roomId).emit('gameStateUpdate', room.gameState);
    
    frameCount++;
  }, GAME_TICK_RATE);
}

// Victory condition check
function checkVictoryConditions(room) {
  const gameState = room.gameState;
  
  // Check if base is destroyed (game over)
  if (gameState.baseDestroyed && !gameState.gameOver) {
    gameState.gameOver = true;
    room.status = 'gameOver';
    io.to(room.id).emit('gameOver', { reason: 'Base destroyed' });
    return;
  }
  
  // Check if all players are dead (game over)
  const allPlayersDead = room.players.every(player => player.lives <= 0);
  if (allPlayersDead && !gameState.gameOver) {
    gameState.gameOver = true;
    room.status = 'gameOver';
    io.to(room.id).emit('gameOver', { reason: 'All players eliminated' });
    return;
  }
  
  // Check for level completion (no remaining enemies and none on screen)
  if (gameState.remainingEnemies <= 0 && gameState.enemyTanks.length === 0 && !gameState.levelCompleted) {
    gameState.levelCompleted = true;
    
    // Notify clients of level completion
    io.to(room.id).emit('levelComplete', { 
      level: gameState.level,
      playerStats: room.players.map(p => ({
        id: p.id,
        score: p.score,
        lives: p.lives
      }))
    });
    
    // Schedule next level start after 5 seconds
    setTimeout(() => {
      if (!rooms[room.id]) return; // Room might have been deleted
      
      gameState.level++;
      gameState.levelCompleted = false;
      gameState.remainingEnemies = 20; // Reset enemy count for new level
      gameState.map = generateMap(gameState.level); // Generate new map based on level
      
      // Reposition player tanks
      repositionPlayerTanks(room);
      
      // Clear existing enemies, bullets, power-ups
      gameState.enemyTanks = [];
      gameState.bullets = [];
      gameState.powerUps = [];
      gameState.explosions = [];
      
      // Notify clients of new level
      io.to(room.id).emit('levelChanged', { 
        level: gameState.level,
        map: gameState.map
      });
      
      // Schedule first enemy spawn for new level
      scheduleEnemySpawn(room);
    }, 5000);
  }
}

// Function to reposition player tanks at start of new level
function repositionPlayerTanks(room) {
  const gameState = room.gameState;
  
  gameState.tanks = room.players.map((player, index) => {
    // Find a tank with matching id or create a new one
    const existingTank = gameState.tanks.find(t => t.id === player.id);
    const tankSpeed = TANK_SPEEDS.player * (1 + (player.stars * 0.2)); // Speed increases with stars
    
    return {
      id: player.id,
      x: index === 0 ? 8 : 16, // Player 1 and Player 2 positions
      y: 24,                   // Bottom of map
      direction: 'up',
      speed: tankSpeed,
      shootSpeed: 1 + (player.stars * 0.2), // Shoot speed increases with stars
      invincible: true,        // Brief invincibility at level start
      invincibleUntil: Date.now() + 3000, // 3 seconds of invincibility
      canShootMultiple: player.stars >= 2, // Can shoot multiple bullets with 2+ stars
      isShielded: false
    };
  });
}

// Schedule enemy tank spawn
function scheduleEnemySpawn(room) {
  // Clear any existing timer
  if (room.timers.enemySpawn) {
    clearTimeout(room.timers.enemySpawn);
  }
  
  const gameState = room.gameState;
  
  // Don't spawn if no more enemies remaining for this level
  if (gameState.remainingEnemies <= 0) return;
  
  // Don't spawn more than 4 enemies at once (like original game)
  if (gameState.enemyTanks.length >= 4) {
    // Try again in 2 seconds
    room.timers.enemySpawn = setTimeout(() => scheduleEnemySpawn(room), 2000);
    return;
  }
  
  // Spawn positions at top of screen (original game had 3 spawn points)
  const spawnPositions = [2, 12, 22];
  const randomPosition = spawnPositions[Math.floor(Math.random() * spawnPositions.length)];
  
  // Determine enemy tank type based on level difficulty
  const enemyTypes = ['basic', 'basic', 'fast', 'power', 'armor'];
  // Higher chance of stronger enemies in higher levels
  const typeIndex = Math.min(
    Math.floor(Math.random() * (1 + gameState.level / 2)),
    enemyTypes.length - 1
  );
  const enemyType = enemyTypes[typeIndex];
  
  // Different enemy types have different properties
  let health = 1;
  let speed = TANK_SPEEDS.enemyBasic;
  
  switch (enemyType) {
    case 'fast':
      speed = TANK_SPEEDS.enemyFast;
      break;
    case 'power':
      speed = TANK_SPEEDS.enemyPower;
      health = 1;
      break;
    case 'armor':
      speed = TANK_SPEEDS.enemyArmor;
      health = 4; // Takes 4 hits
      break;
  }
  
  // Flashing effect for power-up carrying tanks (10% chance or every 10th tank)
  const carryPowerUp = (Math.random() < 0.1) || (20 - gameState.remainingEnemies) % 10 === 0;
  
  // Create enemy tank
  const enemyTank = {
    id: `enemy-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    x: randomPosition,
    y: 0, // Top of map
    direction: 'down',
    speed: speed,
    type: enemyType,
    health: health,
    carryPowerUp: carryPowerUp,
    lastShot: 0,
    flashingColor: carryPowerUp // Visual indicator in the game
  };
  
  // Add to game state
  gameState.enemyTanks.push(enemyTank);
  gameState.remainingEnemies--;
  
  // Emit enemy spawned event
  io.to(room.id).emit('enemySpawned', { enemyTank });
  
  // Schedule next enemy spawn (2-5 seconds)
  const nextSpawnTime = 2000 + Math.random() * 3000;
  room.timers.enemySpawn = setTimeout(() => scheduleEnemySpawn(room), nextSpawnTime);
}

// Schedule power-up spawn
function schedulePowerUpSpawn(room) {
  // Clear any existing timer
  if (room.timers.powerUpSpawn) {
    clearTimeout(room.timers.powerUpSpawn);
  }
  
  const gameState = room.gameState;
  
  // Don't spawn if game is over
  if (gameState.gameOver) return;
  
  // Only one power-up at a time in original game
  if (gameState.powerUps.length === 0) {
    // Find a random open space on the map
    const openSpaces = [];
    
    for (let x = 1; x < 24; x++) {
      for (let y = 1; y < 24; y++) {
        // Check if the space is open (no walls, tanks, etc.)
        if (isOpenSpace(x, y, gameState)) {
          openSpaces.push({ x, y });
        }
      }
    }
    
    if (openSpaces.length > 0) {
      const randomSpace = openSpaces[Math.floor(Math.random() * openSpaces.length)];
      const randomType = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
      
      // Create power-up
      const powerUp = {
        id: `powerup-${Date.now()}`,
        x: randomSpace.x,
        y: randomSpace.y,
        type: randomType,
        createdAt: Date.now(),
        // Power-ups disappear after 20 seconds in original game
        expiresAt: Date.now() + 20000
      };
      
      gameState.powerUps.push(powerUp);
      
      // Emit power-up spawned event
      io.to(room.id).emit('powerUpSpawned', { powerUp });
    }
  }
  
  // Schedule next power-up spawn (30-60 seconds)
  const nextSpawnTime = 30000 + Math.random() * 30000;
  room.timers.powerUpSpawn = setTimeout(() => schedulePowerUpSpawn(room), nextSpawnTime);
}

// Check if a position is an open space (for power-up spawning)
function isOpenSpace(x, y, gameState) {
  // Check walls
  for (const wall of gameState.map.walls) {
    if (Math.abs(x - wall.x) < 1 && Math.abs(y - wall.y) < 1) {
      return false;
    }
  }
  
  // Check steel walls
  for (const wall of gameState.map.steelWalls) {
    if (Math.abs(x - wall.x) < 1 && Math.abs(y - wall.y) < 1) {
      return false;
    }
  }
  
  // Check water
  for (const water of gameState.map.water) {
    if (Math.abs(x - water.x) < 1 && Math.abs(y - water.y) < 1) {
      return false;
    }
  }
  
  // Check base
  if (gameState.map.basePosition) {
    const base = gameState.map.basePosition;
    if (Math.abs(x - base.x) < 1 && Math.abs(y - base.y) < 1) {
      return false;
    }
  }
  
  // Check player tanks
  for (const tank of gameState.tanks) {
    if (Math.abs(x - tank.x) < 1 && Math.abs(y - tank.y) < 1) {
      return false;
    }
  }
  
  // Check enemy tanks
  for (const tank of gameState.enemyTanks) {
    if (Math.abs(x - tank.x) < 1 && Math.abs(y - tank.y) < 1) {
      return false;
    }
  }
  
  return true;
}

// Function to update the entire game state
function updateGameState(room) {
  const gameState = room.gameState;
  
  // Update player tank shields/power-ups
  updatePlayerPowerUps(room);
  
  // Update enemy tanks
  updateEnemyTanks(room);
  
  // Update all bullets
  updateBullets(room);
  
  // Update explosions (age and remove old ones)
  updateExplosions(gameState);
  
  // Update power-ups (check for expiration)
  updatePowerUps(room);
}

// Update player power-ups
function updatePlayerPowerUps(room) {
  const gameState = room.gameState;
  const now = Date.now();
  
  // Check for invincibility expiration
  gameState.tanks.forEach(tank => {
    if (tank.invincible && tank.invincibleUntil && now > tank.invincibleUntil) {
      tank.invincible = false;
      
      // Notify players
      io.to(room.id).emit('playerPowerUpExpired', {
        playerId: tank.id,
        powerUp: 'invincible'
      });
    }
  });
}

// Update power-ups
function updatePowerUps(room) {
  const gameState = room.gameState;
  const now = Date.now();
  
  // Remove expired power-ups
  const expiredPowerUps = gameState.powerUps.filter(powerUp => powerUp.expiresAt < now);
  
  if (expiredPowerUps.length > 0) {
    gameState.powerUps = gameState.powerUps.filter(powerUp => powerUp.expiresAt >= now);
    
    // Notify players of expired power-ups
    io.to(room.id).emit('powerUpsExpired', {
      powerUpIds: expiredPowerUps.map(p => p.id)
    });
  }
  
  // Check for player-powerup collisions
  gameState.tanks.forEach(tank => {
    const player = room.players.find(p => p.id === tank.id);
    if (!player) return;
    
    gameState.powerUps.forEach((powerUp, index) => {
      if (Math.abs(tank.x - powerUp.x) < 1 && Math.abs(tank.y - powerUp.y) < 1) {
        // Player collected power-up
        handlePowerUpCollection(room, tank, player, powerUp);
        
        // Remove collected power-up
        gameState.powerUps.splice(index, 1);
        
        // Notify players
        io.to(room.id).emit('powerUpCollected', {
          playerId: tank.id,
          powerUpId: powerUp.id,
          powerUpType: powerUp.type
        });
      }
    });
  });
}

// Handle power-up collection
function handlePowerUpCollection(room, tank, player, powerUp) {
  const gameState = room.gameState;
  
  // Award points for power-up collection
  player.score += 500;
  
  switch (powerUp.type) {
    case 'helmet':
      // Temporary invincibility
      tank.invincible = true;
      tank.invincibleUntil = Date.now() + 15000; // 15 seconds
      break;
      
    case 'clock':
      // Freeze all enemies for 10 seconds
      gameState.enemyTanks.forEach(enemy => {
        enemy.frozen = true;
        enemy.frozenUntil = Date.now() + 10000;
      });
      break;
      
    case 'shovel':
      // Upgrade base walls to steel temporarily
      upgradeBaseWalls(gameState);
      // Schedule reversion after 20 seconds
      setTimeout(() => {
        if (!rooms[room.id]) return; // Room might have been deleted
        revertBaseWalls(gameState);
        io.to(room.id).emit('baseWallsReverted');
      }, 20000);
      break;
      
    case 'star':
      // Upgrade tank (up to 3 stars)
      if (player.stars < 3) {
        player.stars++;
        
        // Update tank properties based on stars
        tank.speed = TANK_SPEEDS.player * (1 + (player.stars * 0.2));
        tank.shootSpeed = 1 + (player.stars * 0.2);
        tank.canShootMultiple = player.stars >= 2;
      }
      break;
      
    case 'grenade':
      // Destroy all enemies on screen
      const destroyedCount = gameState.enemyTanks.length;
      
      // Award points for each destroyed enemy
      player.score += destroyedCount * 100;
      
      // Create explosions for each enemy
      gameState.enemyTanks.forEach(enemy => {
        gameState.explosions.push({
          x: enemy.x,
          y: enemy.y,
          age: 0,
          size: 'large'
        });
      });
      
      // Clear all enemies
      gameState.enemyTanks = [];
      
      // Notify players
      io.to(room.id).emit('allEnemiesDestroyed', {
        playerId: tank.id,
        count: destroyedCount
      });
      break;
      
    case 'tank':
      // Extra life
      player.lives++;
      
      // Notify players
      io.to(room.id).emit('playerGotExtraLife', {
        playerId: tank.id,
        lives: player.lives
      });
      break;
  }
}

// Upgrade base walls to steel
function upgradeBaseWalls(gameState) {
  const baseX = gameState.map.basePosition.x;
  const baseY = gameState.map.basePosition.y;
  
  // Track original wall configuration
  gameState.originalBaseWalls = [...gameState.map.walls.filter(wall => {
    return Math.abs(wall.x - baseX) <= 2 && Math.abs(wall.y - baseY) <= 2;
  })];
  
  // Remove brick walls near base
  gameState.map.walls = gameState.map.walls.filter(wall => {
    return !(Math.abs(wall.x - baseX) <= 2 && Math.abs(wall.y - baseY) <= 2);
  });
  
  // Add steel walls around base
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      // Skip the base position itself
      if (i === 0 && j === 0) continue;
      
      gameState.map.steelWalls.push({
        x: baseX + i,
        y: baseY + j
      });
    }
  }
}

// Revert base walls to original
function revertBaseWalls(gameState) {
  const baseX = gameState.map.basePosition.x;
  const baseY = gameState.map.basePosition.y;
  
  // Remove steel walls near base
  gameState.map.steelWalls = gameState.map.steelWalls.filter(wall => {
    return !(Math.abs(wall.x - baseX) <= 2 && Math.abs(wall.y - baseY) <= 2);
  });
  
  // Restore original brick walls if they were saved
  if (gameState.originalBaseWalls) {
    gameState.map.walls.push(...gameState.originalBaseWalls);
    delete gameState.originalBaseWalls;
  }
}

// Update explosions
function updateExplosions(gameState) {
  // Age all explosions
  gameState.explosions.forEach(explosion => {
    explosion.age++;
  });
  
  // Remove old explosions (age > 8 frames)
  gameState.explosions = gameState.explosions.filter(explosion => explosion.age < 8);
}

// Helper function to generate a room ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Helper function to create a default map
function generateDefaultMap() {
  const walls = [];
  const steelWalls = [];
  const water = [];
  const trees = [];
  
  // Create brick wall layout (similar to original game)
  for (let i = 0; i < 13; i++) {
    if (i === 6) continue; // Skip center
    for (let j = 5; j < 11; j++) {
      if (j % 2 === 0) continue; // Skip every other row
      walls.push({ x: i * 2, y: j * 2 });
      walls.push({ x: i * 2 + 1, y: j * 2 });
    }
  }
  
  // Add some steel walls
  steelWalls.push({ x: 4, y: 12 });
  steelWalls.push({ x: 20, y: 12 });
  steelWalls.push({ x: 4, y: 24 });
  steelWalls.push({ x: 20, y: 24 });
  
  // Add base area walls
  for (let i = 11; i <= 13; i++) {
    walls.push({ x: i, y: 22 });
    walls.push({ x: i, y: 23 });
  }
  for (let j = 22; j <= 24; j++) {
    walls.push({ x: 10, y: j });
    walls.push({ x: 14, y: j });
  }
  
  // Add water (Original Battle City had water obstacles)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      water.push({ x: 10 + i, y: 15 + j });
    }
  }
  
  // Add trees (for visual cover like in original game)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      trees.push({ x: 2 + i, y: 10 + j });
      trees.push({ x: 20 + i, y: 10 + j });
    }
  }
  
  return {
    walls,
    steelWalls,
    water,
    trees,
    basePosition: { x: 12, y: 24 }
  };
}

// Generate map based on level
// Helper function to update enemy tank positions and behavior
function updateEnemyTanks(room) {
  const gameState = room.gameState;
  const now = Date.now();
  
  gameState.enemyTanks.forEach(tank => {
    // Skip frozen tanks
    if (tank.frozen && tank.frozenUntil > now) {
      return;
    }
    
    // Clear frozen status if expired
    if (tank.frozen && tank.frozenUntil <= now) {
      tank.frozen = false;
    }
    
    // Implement different AI behaviors based on tank type
    let directionChangeChance = 0.02; // Base 2% chance
    let targetPlayerChance = 0.4;     // Base 40% chance to target player
    let shootChance = 0.008;          // Base 0.8% chance to shoot per frame
    
    // Adjust behaviors based on tank type
    switch (tank.type) {
      case 'basic':
        // Default values
        break;
      case 'fast':
        directionChangeChance = 0.04; // More erratic movement
        targetPlayerChance = 0.3;     // Less likely to target directly
        shootChance = 0.006;          // Shoots less
        break;
      case 'power':
        directionChangeChance = 0.01; // More stable movement
        targetPlayerChance = 0.6;     // More likely to target
        shootChance = 0.012;          // Shoots more
        break;
      case 'armor':
        directionChangeChance = 0.005; // Very stable movement
        targetPlayerChance = 0.7;      // Very likely to target
        shootChance = 0.01;           // Average shooting
        break;
    }
    
    // Decide whether to change direction randomly
    if (Math.random() < directionChangeChance) {
      // Decide whether to target a player
      if (Math.random() < targetPlayerChance && gameState.tanks.length > 0) {
        // Target nearest player
        const nearestPlayer = findNearestPlayer(tank, gameState.tanks);
        
        if (nearestPlayer) {
          // Calculate direction to player
          let dx = nearestPlayer.x - tank.x;
          let dy = nearestPlayer.y - tank.y;
          
          // Choose horizontal or vertical movement based on largest distance
          if (Math.abs(dx) > Math.abs(dy)) {
            tank.direction = dx > 0 ? 'right' : 'left';
          } else {
            tank.direction = dy > 0 ? 'down' : 'up';
          }
        }
      } else {
        // Choose random direction
        const directions = ['up', 'down', 'left', 'right'];
        tank.direction = directions[Math.floor(Math.random() * directions.length)];
      }
    }
    
    // Move tank based on direction
    let newX = tank.x;
    let newY = tank.y;
    
    switch (tank.direction) {
      case 'up':
        newY -= tank.speed;
        break;
      case 'down':
        newY += tank.speed;
        break;
      case 'left':
        newX -= tank.speed;
        break;
      case 'right':
        newX += tank.speed;
        break;
    }
    
    // Check if new position is valid using separate logic for enemies
    if (isValidEnemyPosition(newX, newY, gameState, tank.id)) {
      tank.x = newX;
      tank.y = newY;
    } else {
      // If can't move, change direction
      const directions = ['up', 'down', 'left', 'right'];
      const allowedDirections = [];
      
      // Check all four directions to find valid moves
      for (const dir of directions) {
        let checkX = tank.x;
        let checkY = tank.y;
        
        switch (dir) {
          case 'up':
            checkY -= tank.speed;
            break;
          case 'down':
            checkY += tank.speed;
            break;
          case 'left':
            checkX -= tank.speed;
            break;
          case 'right':
            checkX += tank.speed;
            break;
        }
        
        if (isValidEnemyPosition(checkX, checkY, gameState, tank.id)) {
          allowedDirections.push(dir);
        }
      }
      
      // Choose a random valid direction
      if (allowedDirections.length > 0) {
        tank.direction = allowedDirections[Math.floor(Math.random() * allowedDirections.length)];
      } else {
        // If stuck in all directions, just pick random
        tank.direction = directions[Math.floor(Math.random() * directions.length)];
      }
    }
    
    // Handle shooting (cooldown-based, like player)
    const shootCooldown = tank.type === 'power' ? 1000 : 1500; // Power tanks shoot faster
    
    if ((!tank.lastShot || (now - tank.lastShot > shootCooldown)) && Math.random() < shootChance) {
      // Calculate bullet starting position based on tank direction
      let bulletX = tank.x;
      let bulletY = tank.y;
      
      switch (tank.direction) {
        case 'up':
          bulletY -= 1;
          break;
        case 'down':
          bulletY += 1;
          break;
        case 'left':
          bulletX -= 1;
          break;
        case 'right':
          bulletX += 1;
          break;
      }
      
      // Add bullet
      gameState.bullets.push({
        id: `bullet-${now}-${tank.id}`,
        tankId: tank.id,
        x: bulletX,
        y: bulletY,
        direction: tank.direction,
        speed: BULLET_SPEEDS.enemy,
        power: tank.type === 'power' ? 2 : 1 // Power tanks shoot power bullets
      });
      
      // Update last shot time
      tank.lastShot = now;
      
      // Emit sound event for shooting
      io.to(room.id).emit('playSound', { sound: 'shoot' });
    }
  });
}

// Helper function to find nearest player to an enemy tank
function findNearestPlayer(enemyTank, playerTanks) {
  let nearestPlayer = null;
  let minDistance = Infinity;
  
  playerTanks.forEach(playerTank => {
    const dx = playerTank.x - enemyTank.x;
    const dy = playerTank.y - enemyTank.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestPlayer = playerTank;
    }
  });
  
  return nearestPlayer;
}

// Separate function for enemy movement to prevent enemy tanks from getting stuck
function isValidEnemyPosition(x, y, gameState, tankId) {
  // Map boundaries
  if (x < 0.1 || x > 24.9 || y < 0.1 || y > 24.9) return false;
  
  // Use a smaller buffer for enemies to let them move more freely
  const buffer = 0.5;
  
  // Check collisions with walls
  for (const wall of gameState.map.walls) {
    if (Math.abs(x - wall.x) < buffer && Math.abs(y - wall.y) < buffer) {
      return false;
    }
  }
  
  // Check collisions with steel walls
  for (const wall of gameState.map.steelWalls) {
    if (Math.abs(x - wall.x) < buffer && Math.abs(y - wall.y) < buffer) {
      return false;
    }
  }
  
  // Check water collisions (can't drive through water)
  for (const waterTile of gameState.map.water) {
    if (Math.abs(x - waterTile.x) < buffer && Math.abs(y - waterTile.y) < buffer) {
      return false;
    }
  }
  
  // Check base collision
  if (gameState.map.basePosition) {
    const base = gameState.map.basePosition;
    if (Math.abs(x - base.x) < buffer && Math.abs(y - base.y) < buffer) {
      return false;
    }
  }
  
  // For tank-tank collision, use an even smaller buffer
  const tankBuffer = 0.4;
  
  // Check collisions with player tanks
  for (const playerTank of gameState.tanks) {
    if (Math.abs(x - playerTank.x) < tankBuffer && Math.abs(y - playerTank.y) < tankBuffer) {
      return false;
    }
  }
  
  // Check collisions with other enemy tanks (with smaller buffer to reduce gridlock)
  for (const enemyTank of gameState.enemyTanks) {
    // Skip self
    if (enemyTank.id === tankId) continue;
    
    // Use an even smaller buffer
    const smallBuffer = 0.3;
    if (Math.abs(x - enemyTank.x) < smallBuffer && Math.abs(y - enemyTank.y) < smallBuffer) {
      return false;
    }
  }
  
  return true;
}

// Get point value for different enemy tank types
function getEnemyPointValue(tankType) {
  switch (tankType) {
    case 'basic': return 100;
    case 'fast': return 200;
    case 'power': return 300;
    case 'armor': return 400;
    default: return 100;
  }
}

// Start the server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Battle City server running on port ${PORT}`);
  console.log(`Using game tick rate: ${GAME_TICK_RATE}ms`);
});