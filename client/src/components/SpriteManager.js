// client/src/components/SpriteManager.js
import React, { useState, useEffect } from 'react';
import SpriteData from '../assets/SpriteData';

const SpriteManager = () => {
  const [sprites, setSprites] = useState({
    tanks: {},
    tiles: {},
    effects: {},
    loaded: false
  });

  useEffect(() => {
    const loadSprites = async () => {
      // Load tank sprites
      const tankImages = {};
      for (const [player, directions] of Object.entries(SpriteData.tankSprites)) {
        tankImages[player] = {};
        for (const [direction, frames] of Object.entries(directions)) {
          tankImages[player][direction] = [];
          for (const base64 of frames) {
            const img = new Image();
            img.src = base64;
            await new Promise(resolve => img.onload = resolve);
            tankImages[player][direction].push(img);
          }
        }
      }

      // Load tile sprites
      const tileImages = {};
      for (const [type, base64] of Object.entries(SpriteData.tileSprites)) {
        const img = new Image();
        img.src = base64;
        await new Promise(resolve => img.onload = resolve);
        tileImages[type] = img;
      }

      // Load effect sprites
      const effectImages = {};
      for (const [type, data] of Object.entries(SpriteData.effectSprites)) {
        if (Array.isArray(data)) {
          effectImages[type] = [];
          for (const base64 of data) {
            const img = new Image();
            img.src = base64;
            await new Promise(resolve => img.onload = resolve);
            effectImages[type].push(img);
          }
        } else {
          const img = new Image();
          img.src = data;
          await new Promise(resolve => img.onload = resolve);
          effectImages[type] = img;
        }
      }

      setSprites({
        tanks: tankImages,
        tiles: tileImages,
        effects: effectImages,
        loaded: true
      });
    };

    loadSprites();
  }, []);

  return sprites;
};

export default SpriteManager;