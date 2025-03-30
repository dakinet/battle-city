// client/src/components/GameOver.js
import React, { useState, useEffect } from 'react';

const GameOver = ({ reason, score, level, socket }) => {
  const [playerName, setPlayerName] = useState('');
  const [highScores, setHighScores] = useState([]);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [showScores, setShowScores] = useState(false);
  
  // Request high scores when component mounts
  useEffect(() => {
    if (!socket) return;
    
    socket.emit('getHighScores');
    
    const handleHighScores = (scores) => {
      setHighScores(scores);
      
      // Check if current score is a high score
      const isNewHigh = scores.some(s => score > s.score) || scores.length < 5;
      setIsNewHighScore(isNewHigh);
      
      // Show high scores table after a delay
      setTimeout(() => {
        setShowScores(true);
      }, 2000);
    };
    
    socket.on('highScores', handleHighScores);
    
    return () => {
      socket.off('highScores', handleHighScores);
    };
  }, [socket, score]);
  
  // Handle name input
  const handleNameChange = (e) => {
    // Limit to 3 characters (classic arcade style)
    if (e.target.value.length <= 3) {
      setPlayerName(e.target.value.toUpperCase());
    }
  };
  
  // Handle score submission
  const handleSubmitScore = () => {
    if (playerName.length === 0) return;
    
    // Send score to server
    socket.emit('saveHighScore', {
      name: playerName,
      score
    });
    
    // Add to local high scores
    const newScores = [...highScores, { name: playerName, score }]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    
    setHighScores(newScores);
    setIsNewHighScore(false);
  };
  
  // Handle restart game
  const handleRestart = () => {
    // Force page reload to restart game
    window.location.reload();
  };
  
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
    textAlign: 'center',
    border: '2px solid #555'
  };
  
  const titleStyle = {
    color: '#ff6666',
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '20px'
  };
  
  const reasonStyle = {
    fontSize: '18px',
    marginBottom: '20px'
  };
  
  const scoreStyle = {
    fontSize: '24px',
    color: '#ffcc00',
    marginBottom: '30px'
  };
  
  const highScoreTableStyle = {
    width: '80%',
    marginBottom: '30px',
    borderCollapse: 'collapse'
  };
  
  const tableHeaderStyle = {
    color: '#ffcc00',
    textAlign: 'left',
    borderBottom: '1px solid #555',
    padding: '5px 0'
  };
  
  const tableRowStyle = {
    borderBottom: '1px solid #333'
  };
  
  const tableCellStyle = {
    padding: '5px 0',
    textAlign: 'left'
  };
  
  const nameInputStyle = {
    backgroundColor: '#000',
    color: '#ffcc00',
    border: '1px solid #ffcc00',
    padding: '8px',
    fontSize: '20px',
    textAlign: 'center',
    width: '80px',
    marginBottom: '10px',
    fontFamily: 'Courier New, monospace'
  };
  
  const buttonStyle = {
    padding: '10px 20px',
    backgroundColor: '#ffcc00',
    color: '#000',
    border: 'none',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    margin: '10px',
    fontFamily: 'Courier New, monospace'
  };
  
  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>GAME OVER</h1>
      <p style={reasonStyle}>{reason}</p>
      <p style={scoreStyle}>
        SCORE: {score}<br />
        LEVEL: {level}
      </p>
      
      {showScores && (
        <>
          <h2 style={{color: '#ffcc00', marginBottom: '10px'}}>HIGH SCORES</h2>
          <table style={highScoreTableStyle}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>RANK</th>
                <th style={tableHeaderStyle}>NAME</th>
                <th style={tableHeaderStyle}>SCORE</th>
              </tr>
            </thead>
            <tbody>
              {highScores.map((highScore, index) => (
                <tr key={index} style={tableRowStyle}>
                  <td style={tableCellStyle}>{index + 1}</td>
                  <td style={tableCellStyle}>{highScore.name}</td>
                  <td style={tableCellStyle}>{highScore.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {isNewHighScore && (
            <div>
              <p style={{color: '#ffcc00', marginBottom: '10px'}}>NEW HIGH SCORE!</p>
              <input 
                type="text" 
                style={nameInputStyle} 
                value={playerName}
                onChange={handleNameChange}
                placeholder="AAA"
                maxLength={3}
                autoFocus
              />
              <button 
                style={buttonStyle} 
                onClick={handleSubmitScore}
                disabled={playerName.length < 1}
              >
                SUBMIT
              </button>
            </div>
          )}
        </>
      )}
      
      <button style={buttonStyle} onClick={handleRestart}>PLAY AGAIN</button>
    </div>
  );
};

export default GameOver;