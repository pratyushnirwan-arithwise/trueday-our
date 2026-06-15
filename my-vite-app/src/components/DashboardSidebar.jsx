import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { 
  LayoutDashboard, 
  History, 
  BarChart2, 
  Activity,
  LogOut
} from 'lucide-react';
import './DashboardSidebar.css';

const DashboardSidebar = ({ collapsed, onToggleCollapse, open, setOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const getUserInitials = () => {
    if (currentUser && currentUser.username) {
      return currentUser.username.split(' ').map(name => name[0]).join('').toUpperCase();
    }
    const username = localStorage.getItem('username');
    if (username) {
      return username.split(' ').map(name => name[0]).join('').toUpperCase();
    }
    return 'U';
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    localStorage.removeItem('jwt_token');
    window.location.href = 'https://www.ariths.com/tools';
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/Tickets', icon: History, label: 'Timeline' },
    { path: '/Reports', icon: BarChart2, label: 'Reports' },
    { path: '/ProgressPulse', icon: Activity, label: 'Progress Pulse' }
  ];

  return (
    <>
      <div
        className={`ds-overlay ${open ? 'open' : ''}`}
        onClick={() => setOpen && setOpen(false)}
      />
      <div className={`ds-sidebar ${open ? 'open' : ''}`}>

        <div className="ds-logo-container">
          <img src="/trueday-logo-a.png" alt="TrueDay Logo" className="ds-logo-img" />
        </div>

        {/* Navigation Section */}
        <nav className="ds-nav">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path === '/ProgressPulse' && location.pathname === '/progress');

            return (
              <div
                key={index}
                className={`ds-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
                title={item.label}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className="ds-icon" />
              </div>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
          <div className="settings-item">
            <button
              type="button"
              className="dashboard-user-avatar"
              title={currentUser?.username || 'User'}
              onClick={() => setShowUserMenu(prev => !prev)}
            >
              {getUserInitials()}
            </button>
            {showUserMenu && (
              <div className="ds-settings-dropdown">
                <button type="button" className="ds-logout-btn" onClick={handleLogout}>
                  <LogOut size={16} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  );
};

export default DashboardSidebar;
