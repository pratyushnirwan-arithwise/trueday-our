import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import {
  LayoutDashboard,
  Ticket,
  BarChart,
  Activity,
  ListTodo,
  Trophy,
  LogOut,
  // Calendar,
  Menu,
  X,
  Sun,
  Moon,
  Bell,
  UserCircle,
  Award,
  RefreshCw
} from 'lucide-react';
import './Sidebar.css';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, forceRefreshUser } = useUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const [showSettings, setShowSettings] = useState(false);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userProjects, setUserProjects] = useState([]);
  const [userLicenses, setUserLicenses] = useState([]);
  const [newProject, setNewProject] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [showDebug, setShowDebug] = useState(false);

  // Get session ID for debugging
  const getSessionId = () => {
    const params = new URLSearchParams(window.location.search);
    let sessionid = params.get('sessionid');
    if (!sessionid && window.location.hash) {
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.split('?')[1]);
      sessionid = hashParams.get('sessionid');
    }
    return sessionid;
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (currentUser && currentUser.username) {
      return currentUser.username.split(' ').map(name => name[0]).join('').toUpperCase();
    }
    // Fallback to localStorage if context doesn't have data
    const username = localStorage.getItem('username');
    if (username) {
      return username.split(' ').map(name => name[0]).join('').toUpperCase();
    }
    return 'U';
  };

  // Get display name (first name only)
  const getDisplayName = () => {
    if (currentUser && currentUser.username) {
      return currentUser.username.split(' ')[0]; // Return only first name
    }
    // Fallback to localStorage if context doesn't have data
    const username = localStorage.getItem('username');
    if (username) {
      return username.split(' ')[0]; // Return only first name
    }
    return 'User';
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    localStorage.removeItem('jwt_token');
    window.location.href = 'https://www.ariths.com/tools';
  };

  const routes = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/tickets', label: 'Tickets', icon: Ticket },
    { path: '/reports', label: 'Reports', icon: BarChart },
    { path: '/progrespulse', label: 'Progress', icon: Activity },
    { path: '/tickettracker', label: 'Ticket Tracker', icon: ListTodo },
    { path: '/rewards', label: 'Games & Rewards', icon: Trophy },
    { path: '/profile', label: 'Profile', icon: UserCircle },
    // { path: '/calendar', label: 'Calendar', icon: Calendar }
  ];

  // Fetch users on demand
  const handleNavIconClick = async () => {
    setShowUserPanel(true);
    if (users.length === 0) {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data);
    }
  };

  // Fetch projects/licenses for selected user
  const handleUserSelect = async (user) => {
    setSelectedUser(user);
    // Fetch projects
    const projRes = await fetch(`/api/user-projects?user_id=${user.id}`);
    const projects = await projRes.json();
    setUserProjects(projects);
    // Fetch licenses
    const licRes = await fetch(`/api/user-licenses?user_id=${user.id}`);
    const licenses = await licRes.json();
    setUserLicenses(licenses);
  };

  // Save new project/label
  const handleSave = async () => {
    setSaveMsg('');
    if (newProject) {
      await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newProject }) });
    }
    if (newLabel && selectedUser) {
      await fetch('/api/labels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newLabel, user_id: selectedUser.id }) });
    }
    setSaveMsg('Saved!');
    setNewProject('');
    setNewLabel('');
  };

  return (
    <>
      <header className="navbar">
        <div className="navbar-container">
          <div className="navbar-brand">
            <Link to="/home" className="navbar-logo">
              <img
                src="C:\Users\Asus\Downloads\trueday logo-A.png"
                alt="TrueDay Logo"
                style={{
                  height: '112px', // Adjust height as needed
                  width: 'auto'
                }}
              />
            </Link>
          </div>
          {/* Desktop Navigation */}
          <nav className="navbar-nav">
            {routes.map((route) => {
              const Icon = route.icon;
              const isProfile = route.path === '/profile';
              return (
                <Link
                  key={route.path}
                  to={route.path}
                  className={`nav-item ${location.pathname === route.path ? 'active' : ''}`}
                  title={isProfile ? 'Add User' : route.label}
                >
                  {/* <span className="nav-icon-anim">
                    <Icon size={20} className="nav-icon" />
                  </span> */}
                  {!isProfile && <span className="nav-label">{route.label}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="navbar-actions">
            {/* Profile Section: avatar + greeting */}
            <div className="navbar-profile-section" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt="Profile"
                  className="profile-avatar-img"
                  title="Profile menu"
                  style={{ width: 32, height: 32 }}
                />
              ) : (
                <div
                  className="profile-avatar-glass"
                  title="Profile menu"
                  style={{ width: 32, height: 32, fontSize: '1.1rem' }}
                >
                  {getUserInitials()}
                </div>
              )}
              <div className="profile-greeting" style={{ fontSize: '1rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {currentUser && currentUser.username ? `Hello, ${currentUser.username.split(' ')[0]}!` : 'Hello, User!'}
                {/* Debug info for session ID 8 issue */}
                {getSessionId() === '8' && (
                  <div style={{ fontSize: '0.7rem', color: '#ff6b6b', marginTop: '2px' }}>
                    Debug: ID={currentUser?.id}, Session={getSessionId()}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDebug(!showDebug);
                        localStorage.removeItem('token');
                        localStorage.removeItem('userId');
                        localStorage.removeItem('username');
                        window.close();
                      }}
                      style={{ marginLeft: '8px', fontSize: '0.6rem', padding: '2px 4px', background: '#ff6b6b', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                    >
                      {showDebug ? 'Hide' : 'Debug'}
                    </button>
                  </div>
                )}
                {showDebug && getSessionId() === '8' && (
                  <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '4px', background: '#f0f0f0', padding: '4px', borderRadius: '3px' }}>
                    <div>Session ID: {getSessionId()}</div>
                    <div>User ID: {currentUser?.id}</div>
                    <div>Username: {currentUser?.username}</div>
                    <div>localStorage userId: {localStorage.getItem('userId')}</div>
                    <div>localStorage username: {localStorage.getItem('username')}</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        forceRefreshUser();
                      }}
                      style={{ marginTop: '4px', fontSize: '0.6rem', padding: '2px 6px', background: '#007bff', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                    >
                      <RefreshCw size={10} style={{ marginRight: '2px' }} />
                      Force Refresh
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* Settings Icon only */}
            <button className="settings-btn" title="Settings" onClick={() => setShowSettings(v => !v)}>
              <UserCircle size={18} />
            </button>
            {showSettings && (
              <div style={{
                position: 'absolute',
                top: '110%',
                right: 0,
                minWidth: 160,
                background: '#fff',
                color: '#222',
                boxShadow: '0 4px 16px rgba(0,0,0,0.13)',
                borderRadius: 8,
                zIndex: 100,
                padding: '0.5em 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
              }}>
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0.7em 1.2em',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontWeight: 500,
                    color: '#dc2626',
                  }}
                  onClick={handleLogout}
                >
                  <LogOut size={16} style={{ marginRight: 8 }} /> Logout
                </button>
              </div>
            )}
          </div>
          {/* Mobile menu button */}
          <button className="mobile-menu-button" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="mobile-nav">
            {routes.map((route) => {
              const Icon = route.icon;
              return (
                <Link
                  key={route.path}
                  to={route.path}
                  className={`mobile-nav-item ${location.pathname === route.path ? 'active' : ''}`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Icon size={18} className="nav-icon" />
                  <span>{route.label}</span>
                </Link>
              );
            })}
            <button className="mobile-logout-button" onClick={handleLogout}>
              <LogOut size={18} className="nav-icon" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </header>
      {/* 3-column user/project/label panel */}
      {showUserPanel && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.18)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="user-panel-modal" style={{ display: 'flex', background: '#fff', borderRadius: 12, boxShadow: '0 4px 32px rgba(0,0,0,0.13)', width: '80vw', maxWidth: 1200, minHeight: 400, overflow: 'hidden' }}>
            {/* Column 1: Users */}
            <div style={{ flex: 1, padding: 24, borderRight: '1px solid #eee', overflowY: 'auto' }}>
              <h3 style={{ marginBottom: 16 }}>Users</h3>
              {users.map(user => (
                <div key={user.id} onClick={() => handleUserSelect(user)}
                  style={{ padding: '10px 14px', marginBottom: 8, borderRadius: 8, cursor: 'pointer', background: selectedUser?.id === user.id ? '#e0e7ff' : '#f8fafc', fontWeight: selectedUser?.id === user.id ? 600 : 400, transition: 'background 0.18s' }}
                  onMouseOver={e => e.currentTarget.style.background = '#f3f4f6'}
                  onMouseOut={e => e.currentTarget.style.background = selectedUser?.id === user.id ? '#e0e7ff' : '#f8fafc'}
                >{user.username || user.name}</div>
              ))}
            </div>
            {/* Column 2: Projects & Licenses */}
            <div style={{ flex: 1.2, padding: 24, borderRight: '1px solid #eee', overflowY: 'auto' }}>
              <h3 style={{ marginBottom: 16 }}>Projects & Licenses</h3>
              {selectedUser ? (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <strong>Projects:</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                      {userProjects.map(p => <span key={p.id} style={{ background: '#e0e7ff', color: '#3730a3', padding: '3px 10px', borderRadius: 6, fontSize: 13 }}>{p.name}</span>)}
                    </div>
                  </div>
                  <div>
                    <strong>Licenses:</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                      {userLicenses.map(l => <span key={l.id} style={{ background: '#fbe9e7', color: '#d84315', padding: '3px 10px', borderRadius: 6, fontSize: 13 }}>{l.name}</span>)}
                    </div>
                  </div>
                </>
              ) : <div style={{ color: '#888' }}>Select a user to view details</div>}
            </div>
            {/* Column 3: Add Project/Label */}
            <div style={{ flex: 1, padding: 24 }}>
              <h3 style={{ marginBottom: 16 }}>Add Project/Label</h3>
              <div style={{ marginBottom: 12 }}>
                <input type="text" placeholder="New Project Name" value={newProject} onChange={e => setNewProject(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd', marginBottom: 8 }} />
                <input type="text" placeholder="New Label Name" value={newLabel} onChange={e => setNewLabel(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }} />
              </div>
              <button onClick={handleSave} style={{ background: '#4f46e5', color: '#fff', padding: '10px 24px', border: 'none', borderRadius: 8, fontWeight: 600, marginTop: 8 }}>Save</button>
              {saveMsg && <div style={{ color: '#27ae60', marginTop: 10 }}>{saveMsg}</div>}
            </div>
            <button onClick={() => setShowUserPanel(false)} style={{ position: 'absolute', top: 18, right: 24, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>×</button>
          </div>
        </div>
      )}
    </>
  );
}