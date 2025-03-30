// client/src/assets/SpriteData.js

// This file contains sprite data extracted from your original Battle City sprites
const SpriteData = {
    // Base64 placeholder for tank sprites (yellow, green, red tanks in different directions)
    // In a real implementation, you would use actual extracted sprites
    tankSprites: {
      player1: {
        up: [
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAu0lEQVQ4T2NkoBAwUqifAasBJPoX/N9jVImRHIPAhiAbjPQPLmn8z8LAAP+B7GdsYPj/HyiCDMDewOAgmMWw+GkJw/yXB4GK/zP8B+r+//8/I1hCG2i4jfImhuTTcxg+/PnKwPifgeH/P6AcEzOYjtVQgATUFcwZUhm2MbQyTGVY+/4Ew////xiQNSNrkgSayAs0JOXMbIYzX+8xfP/7g+Hfv39ghS7iDQwbbx1n6L51jJFkF8AMAwAad1UQllZoMwAAAABJRU5ErkJggg==",
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAvElEQVQ4T2NkoBAwUqifAasBJPoX/N9jVImRHIPAhiAbjPQPLmn8z8LAAP+B7GdsYPj/HyiCDMDewOAgmMWw+GkJw/yXB4GK/zP8B+r+//8/I1hCG2i4jfImhuTTcxg+/PnKwPifgeH/P6AcEzOYjtVQgATUFcwZUhm2MbQyTGVY+/4Ew////xiQNSNrkgSayAs0JOXMbIYzX+8xfP/7g+Hfv39ghS7iDQwbbx1n6L51jJFkF8AMAwAad1UQllZoMwAAAABJRU5ErkJggg=="
        ],
        down: [
          // Similar base64 strings for down direction
        ],
        // etc for left and right
      },
      // Similar structure for player2, enemies, etc.
    },
    
    // Tile sprites (bricks, steel, water, trees, base)
    tileSprites: {
      brick: "data:image/png;base64,...",
      steel: "data:image/png;base64,...",
      water: "data:image/png;base64,...",
      trees: "data:image/png;base64,...",
      base: "data:image/png;base64,...",
    },
    
    // Effect sprites (bullets, explosions)
    effectSprites: {
      bulletUp: "data:image/png;base64,...",
      bulletDown: "data:image/png;base64,...",
      bulletLeft: "data:image/png;base64,...",
      bulletRight: "data:image/png;base64,...",
      explosion: [
        "data:image/png;base64,...",
        "data:image/png;base64,...",
        "data:image/png;base64,...",
      ]
    }
  };
  
  export default SpriteData;