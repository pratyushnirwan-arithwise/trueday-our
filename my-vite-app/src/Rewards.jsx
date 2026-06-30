import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Ticket,
  BarChart,
  Activity,
  ListTodo,
  Trophy,
  User,
  LogOut
} from 'lucide-react';
import DashboardSidebar from './components/DashboardSidebar';

export default function RewardsPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [points, setPoints] = useState(0);
  const [loadingPoints, setLoadingPoints] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [tab, setTab] = useState("rewards");
  const userId = localStorage.getItem('userId');

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = 'https://ariths.com/';
  };

  const routes = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/tickets', label: 'Tickets', icon: Ticket },
    { path: '/reports', label: 'Reports', icon: BarChart },
    { path: '/progrespulse', label: 'Progress Pulse', icon: Activity },
    { path: '/tickettracker', label: 'Ticket Tracker', icon: ListTodo },
    { path: '/rewards', label: 'Game & Rewards', icon: Trophy },
    { path: '/profile', label: 'Profile', icon: User },
  ];

  const rewards = [
    { id: 1, name: "Coffee Voucher", description: "Free coffee at the office café", points: 100, icon: "☕", available: true },
    { id: 2, name: "Movie Tickets", description: "Two tickets to any movie", points: 300, icon: "🎟️", available: true },
    { id: 3, name: "Gift Card", description: "$25 Amazon gift card", points: 500, icon: "🎁", available: true },
    { id: 4, name: "Team Lunch", description: "Lunch for your team (up to 5 people)", points: 1000, icon: "👥", available: false },
  ];

  const achievements = [
    { id: 1, name: "First Resolution", description: "Resolve your first ticket", points: 50, progress: 100, icon: "✅", completed: true },
    { id: 2, name: "Speed Demon", description: "Resolve 5 tickets in a single day", points: 100, progress: 80, icon: "⚡", completed: false },
    { id: 3, name: "Team Player", description: "Collaborate on 20 tickets", points: 150, progress: 65, icon: "🤝", completed: false },
    { id: 4, name: "Problem Solver", description: "Resolve 50 high-priority tickets", points: 200, progress: 30, icon: "🌟", completed: false },
  ];

  const redemptionHistory = [
    { id: 1, name: "Coffee Voucher", points: 100, date: "June 1, 2023" },
    { id: 2, name: "Movie Tickets", points: 300, date: "May 15, 2023" },
    { id: 3, name: "Gift Card", points: 500, date: "April 20, 2023" },
  ];

  // Fetch user points from backend
  useEffect(() => {
    if (userId) {
      setLoadingPoints(true);
      fetch(`/api/user/${userId}/points`)
        .then(res => res.json())
        .then(data => {
          if (data.points !== undefined) setPoints(data.points);
          setLoadingPoints(false);
        })
        .catch(() => setLoadingPoints(false));
    }
  }, [userId]);

  // Fetch leaderboard from backend when tab is leaderboard
  useEffect(() => {
    if (tab === "leaderboard") {
      setLoadingLeaderboard(true);
      fetch('/api/leaderboard')
        .then(res => res.json())
        .then(data => {
          setLeaderboard(Array.isArray(data) ? data : []);
          setLoadingLeaderboard(false);
        })
        .catch(() => setLoadingLeaderboard(false));
    }
  }, [tab]);

  const handleRedeemReward = (reward) => {
    if (points >= reward.points) {
      setPoints(points - reward.points);
      alert(`You have redeemed ${reward.name} for ${reward.points} points!`);
    } else {
      alert("You don't have enough points to redeem this reward.");
    }
  };

  const topPlayers = [
    { 
      id: 1, 
      name: "Jane Smith", 
      points: 1250, 
      position: "first",
      level: 10,
      avatar: "👩‍💻",
      achievements: ["Speed Demon", "Bug Hunter", "Team Player"],
      streak: 7
    },
    { 
      id: 2, 
      name: "John Doe", 
      points: 950, 
      position: "second",
      level: 8,
      avatar: "👨‍💻",
      achievements: ["First Steps", "Problem Solver"],
      streak: 5
    },
    { 
      id: 3, 
      name: "Mike Johnson", 
      points: 820, 
      position: "third",
      level: 7,
      avatar: "👨‍💻",
      achievements: ["Quick Learner"],
      streak: 3
    }
  ];

  return (
    <div className="dashboard-container">
      <DashboardSidebar collapsed={sidebarCollapsed} onToggleCollapse={setSidebarCollapsed} open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="dashboard-layout">
        <main className="dashboard-main">
        <div className="rewards-page">
          <div className="header">
          {/* <img 
            src="/puzzle.png" 
            alt="puzzle Logo" 
            style={{
              marginRight: '-1000px',
              // backgroundColor: 'bisque',
              height: '40px', // Adjust height as needed
              width: 'auto',
            }}
          /> */}
           <h1>🎮 Games</h1>
            <div className="points-box">
              <span role="img" aria-label="trophy">🏆</span>
              <div>
                <p>Your Points</p>
                <strong>{loadingPoints ? '...' : points}</strong>
              </div>
            </div>
          </div>

          <div className="tabs">
            {["rewards", "achievements", "leaderboard", "history"].map((t) => (
              <button key={t} onClick={() => setTab(t)} className={tab === t ? "active" : ""}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab === "rewards" && (
            <div className="grid">
              {rewards.map((reward) => (
                <div className={`card ${!reward.available ? "disabled" : ""}`} key={reward.id}>
                  <div className="card-header">
                    <div className="icon">{reward.icon}</div>
                    <span className="points-badge">{reward.points} pts</span>
                  </div>
                  <h3>{reward.name}</h3>
                  <p>{reward.description}</p>
                  <button
                    disabled={!reward.available || points < reward.points}
                    onClick={() => handleRedeemReward(reward)}
                  >
                    {points >= reward.points ? "Redeem" : "Not Enough Points"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "achievements" && (
            <div className="grid">
              {achievements.map((a) => (
                <div className="card" key={a.id}>
                  <div className={`icon ${a.completed ? "completed" : ""}`}>{a.icon}</div>
                  <div className="card-body">
                    <div className="card-header">
                      <h3>{a.name}</h3>
                      <span className="points-badge">{a.points} pts</span>
                    </div>
                    <p>{a.description}</p>
                    <div className="progress-bar">
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${a.progress}%` }}></div>
                      </div>
                      <span>{a.progress}%</span>
                    </div>
                    {a.completed && <span className="completed-badge">Completed</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "leaderboard" && (
            <div className="card">
              <h3>Top Performers</h3>
              {loadingLeaderboard ? (
                <div className="loading">Loading leaderboard...</div>
              ) : (
                <div className="leaderboard">
                  {leaderboard.map((user, idx) => (
                    <div key={user.id} className={`leader-item${String(user.id) === String(userId) ? ' current-user' : ''}`}>
                      <div className="position">{idx + 1}</div>
                      <div className="info">
                        <strong>{user.username}</strong>
                        <span>{user.points} pts</span>
                        {String(user.id) === String(userId) && <span style={{color:'#f79655',marginLeft:8}}>(You)</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="card">
              <h3>Redemption History</h3>
              <p>Your previously redeemed rewards</p>
              <div className="history-list">
                {redemptionHistory.map((item) => (
                  <div className="history-item" key={item.id}>
                    <div className="icon">🛍️</div>
                    <div>
                      <strong>{item.name}</strong>
                      <p>Redeemed on {item.date}</p>
                    </div>
                    <span className="points-badge">{item.points} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </main>
      </div>
    </div>
  );
}
