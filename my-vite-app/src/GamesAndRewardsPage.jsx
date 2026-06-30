import React, { useState } from 'react';
import './GamesAndRewards.css';

const GamesAndRewardsPage = () => {
  const [activeTab, setActiveTab] = useState('game');
  const [userPoints, setUserPoints] = useState(1240);
  const [userLevel, setUserLevel] = useState(7);
  const [showRewardPopup, setShowRewardPopup] = useState(false);
  const [selectedReward, setSelectedReward] = useState(null);

  // Enhanced sample data for top players
  const topPlayers = [
    { 
      id: 1, 
      name: 'Alex Johnson', 
      points: 2500, 
      level: 10, 
      position: 'first',
      avatar: '👨‍💻',
      achievements: ['Speed Demon', 'Bug Hunter'],
      streak: 7
    },
    { 
      id: 2, 
      name: 'Sarah Williams', 
      points: 2100, 
      level: 9, 
      position: 'second',
      avatar: '👩‍💻',
      achievements: ['First Steps', 'Team Player'],
      streak: 5
    },
    { 
      id: 3, 
      name: 'Mike Chen', 
      points: 1800, 
      level: 8, 
      position: 'third',
      avatar: '👨‍💻',
      achievements: ['Problem Solver'],
      streak: 3
    },
  ];

  const rewards = [
    { id: 'coffee', name: 'Coffee Voucher', description: 'Free coffee at the office café', points: 100 },
    { id: 'movie', name: 'Movie Tickets', description: 'Two tickets to any movie', points: 300 },
    { id: 'gift-card', name: 'Amazon Gift Card', description: '$25 Amazon gift card', points: 500 },
  ];

  const achievements = [
    { id: 'first-steps', name: 'First Steps', description: 'Resolve your first ticket', completed: true, icon: '🏆' },
    { id: 'speed-demon', name: 'Speed Demon', description: 'Resolve 5 tickets in under 1 hour', progress: 3, total: 5, icon: '⚡' },
    { id: 'bug-hunter', name: 'Bug Hunter', description: 'Find and fix 10 critical bugs', progress: 7, total: 10, icon: '🐛' },
  ];

  const handleRedeemReward = (reward) => {
    if (userPoints >= reward.points) {
      setSelectedReward(reward);
      setShowRewardPopup(true);
    }
  };

  const confirmRedemption = () => {
    setUserPoints(userPoints - selectedReward.points);
    setShowRewardPopup(false);
  };

  return (
    <div className="games-rewards-page">
      <div className="page-header">
        <h1>TicketQuest</h1>
        <div className="user-stats">
          <div className="points-display">
            <span>✨</span>
            <span>{userPoints}</span>
            <span>Points</span>
          </div>
          <div className="level-display">
            <div className="level-badge">Lvl {Math.floor(userLevel)}</div>
          </div>
        </div>
      </div>

      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'game' ? 'active' : ''}`}
          onClick={() => setActiveTab('game')}
        >
          Adventure Game
        </button>
        <button 
          className={`tab-button ${activeTab === 'rewards' ? 'active' : ''}`}
          onClick={() => setActiveTab('rewards')}
        >
          Rewards Shop
        </button>
        <button 
          className={`tab-button ${activeTab === 'achievements' ? 'active' : ''}`}
          onClick={() => setActiveTab('achievements')}
        >
          Achievements
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'game' && (
          <div className="game-tab">
            <h2>Leaderboard</h2>
            <p className="leaderboard-subtitle">Top performers this month</p>
            <div className="game-podium">
              {topPlayers.map((player) => (
                <div key={player.id} className={`podium-step ${player.position}`}>
                  <div className="position-number">
                    {player.position === 'first' ? '1st' : player.position === 'second' ? '2nd' : '3rd'}
                  </div>
                  <div className="trophy-icon">
                    {player.position === 'first' ? '🏆' : player.position === 'second' ? '🥈' : '🥉'}
                  </div>
                  <div className="player-info">
                    <div className="player-avatar">{player.avatar}</div>
                    <div className="player-name">{player.name}</div>
                    <div className="player-points">{player.points} points</div>
                    <div className="player-level">Level {player.level}</div>
                    <div className="player-streak">
                      <span>🔥</span> {player.streak} day streak
                    </div>
                    <div className="player-achievements">
                      {player.achievements.map((achievement, index) => (
                        <span key={index} className="achievement-badge">
                          {achievement}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'rewards' && (
          <div className="rewards-tab">
            <div className="rewards-grid">
              {rewards.map(reward => (
                <div key={reward.id} className="reward-card">
                  <h3 className="reward-name">{reward.name}</h3>
                  <p className="reward-description">{reward.description}</p>
                  <div className="reward-cost">
                    <span>✨</span>
                    <span>{reward.points}</span>
                  </div>
                  <button 
                    className={`redeem-button ${userPoints >= reward.points ? '' : 'disabled'}`}
                    onClick={() => handleRedeemReward(reward)}
                    disabled={userPoints < reward.points}
                  >
                    {userPoints >= reward.points ? 'Redeem' : `Need ${reward.points - userPoints} more`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="achievements-tab">
            <div className="achievements-list">
              {achievements.map(achievement => (
                <div key={achievement.id} className="achievement-item">
                  <div className="achievement-icon">{achievement.icon}</div>
                  <div className="achievement-info">
                    <div className="achievement-name">{achievement.name}</div>
                    <div className="achievement-description">{achievement.description}</div>
                    {achievement.progress && (
                      <div className="progress-text">
                        {achievement.progress}/{achievement.total}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showRewardPopup && selectedReward && (
        <div className="reward-popup-overlay">
          <div className="reward-popup">
            <div className="popup-header">
              <h3>Confirm Redemption</h3>
              <button onClick={() => setShowRewardPopup(false)}>×</button>
            </div>
            <div className="popup-content">
              <h4>{selectedReward.name}</h4>
              <p>{selectedReward.description}</p>
              <p>Cost: {selectedReward.points} points</p>
              <p>Balance after: {userPoints - selectedReward.points} points</p>
            </div>
            <div className="popup-actions">
              <button className="cancel-button" onClick={() => setShowRewardPopup(false)}>Cancel</button>
              <button className="confirm-button" onClick={confirmRedemption}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GamesAndRewardsPage; 