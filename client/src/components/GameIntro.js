// client/src/components/GameIntro.js
import React, { useEffect, useState } from 'react';

const GameIntro = ({ onComplete }) => {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  
  // Auto-advance screens
  useEffect(() => {
    if (!showIntro) return;
    
    const screenTimer = setTimeout(() => {
      if (currentScreen < 2) {
        setCurrentScreen(currentScreen + 1);
      } else {
        setShowIntro(false);
        onComplete();
      }
    }, 3000); // 3 seconds per screen
    
    return () => clearTimeout(screenTimer);
  }, [currentScreen, onComplete, showIntro]);
  
  // Handle skip
  const handleSkip = () => {
    setShowIntro(false);
    onComplete();
  };
  
  // Intro screens content
  const screens = [
    {
      title: "BATTLE CITY",
      content: "The enemy tanks are invading your city!\nDefend your base at all costs!"
    },
    {
      title: "HOW TO PLAY",
      content: "Use arrow keys to move your tank\nPress SPACE to fire\nPress P to pause the game"
    },
    {
      title: "POWER UPS",
      content: "★ - Upgrade your tank\n🛡️ - Temporary shield\n🕒 - Freeze enemies\n🏆 - Extra life"
    }
  ];
  
  // Styles
  const containerStyle = {
    width: '416px',
    height: '416px',
    backgroundColor: '#000',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'Courier New, monospace',
    position: 'relative',
    overflow: 'hidden',
    border: '2px solid #555'
  };
  
  const titleStyle = {
    color: '#ffcc00',
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '40px',
    textAlign: 'center'
  };
  
  const contentStyle = {
    fontSize: '18px',
    lineHeight: '1.5',
    textAlign: 'center',
    whiteSpace: 'pre-line'
  };
  
  const skipButtonStyle = {
    position: 'absolute',
    bottom: '20px',
    right: '20px',
    padding: '5px 15px',
    backgroundColor: '#ffcc00',
    color: '#000',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'Courier New, monospace',
    fontWeight: 'bold'
  };
  
  const progressBarStyle = {
    position: 'absolute',
    bottom: '10px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '8px'
  };
  
  const dotStyle = (index) => ({
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: index === currentScreen ? '#ffcc00' : '#555'
  });
  
  const tanksStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0.15,
    zIndex: 0,
    pointerEvents: 'none'
  };

  return (
    <div style={containerStyle}>
      {/* Background tanks animation */}
      <div style={tanksStyle}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div 
            key={i}
            style={{
              position: 'absolute',
              width: '20px',
              height: '20px',
              backgroundColor: i % 2 === 0 ? '#ffcc00' : '#ff6666',
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              transform: `rotate(${Math.floor(Math.random() * 4) * 90}deg)`
            }}
          />
        ))}
      </div>
      
      <h1 style={titleStyle}>{screens[currentScreen].title}</h1>
      <p style={contentStyle}>{screens[currentScreen].content}</p>
      
      <button style={skipButtonStyle} onClick={handleSkip}>SKIP</button>
      
      <div style={progressBarStyle}>
        {screens.map((_, index) => (
          <div key={index} style={dotStyle(index)} />
        ))}
      </div>
    </div>
  );
};

export default GameIntro;