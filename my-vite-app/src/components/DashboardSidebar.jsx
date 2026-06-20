import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { 
  LayoutDashboard, 
  SquareKanban,
  History, 
  BarChart2, 
  Activity,
  LogOut,
  Bell,
  Trash2,
  Check,
  BellOff,
  MessageSquare,
  ArrowRight,
  UserPlus,
  Info,
  X,
  Paperclip
} from 'lucide-react';
import './DashboardSidebar.css';

const DashboardSidebar = ({ collapsed, onToggleCollapse, open, setOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [hoveredTooltip, setHoveredTooltip] = useState(null);
  const showPanelRef = useRef(showPanel);
  const wasOpenRef = useRef(false);
  const [deletingIds, setDeletingIds] = useState([]);

  useEffect(() => {
    showPanelRef.current = showPanel;
  }, [showPanel]);

  const fetchNotifications = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`/api/notifications?user_id=${currentUser.id}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        const unread = data.filter(n => n.status === 'unread').length;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  const markAsRead = async (id) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'read' } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const markAllRead = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`/api/notifications/read-all?user_id=${currentUser.id}`, { method: 'PUT' });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  useEffect(() => {
    if (!currentUser?.id) return;
    fetchNotifications();

    // Establish SSE connection for instant production notifications
    const eventSource = new EventSource(`/api/notifications/stream?user_id=${currentUser.id}`);
    
    eventSource.onmessage = (event) => {
      if (event.data === 'refresh' || event.data === 'init') {
        const handleNewNotif = async () => {
          if (event.data === 'refresh') {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          await fetchNotifications();
        };
        handleNewNotif();
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Connection error, falling back...", err);
    };

    // Keep a slow 30-second poll as a backup check
    const interval = setInterval(fetchNotifications, 30000);

    return () => {
      eventSource.close();
      clearInterval(interval);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (showPanel) {
      fetchNotifications();
      wasOpenRef.current = true;
    } else {
      if (wasOpenRef.current) {
        markAllRead();
        wasOpenRef.current = false;
      }
    }
  }, [showPanel]);

  const deleteNotification = async (id, e) => {
    e.stopPropagation();
    setDeletingIds(prev => [...prev, id]);
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTimeout(() => {
          setNotifications(prev => {
            const updated = prev.filter(n => n.id !== id);
            const unread = updated.filter(n => n.status === 'unread').length;
            setUnreadCount(unread);
            return updated;
          });
          setDeletingIds(prev => prev.filter(x => x !== id));
        }, 300);
      } else {
        setDeletingIds(prev => prev.filter(x => x !== id));
      }
    } catch (err) {
      console.error("Error deleting notification:", err);
      setDeletingIds(prev => prev.filter(x => x !== id));
    }
  };

  const handleMouseMove = (e, text) => {
    setHoveredTooltip({
      text: text || 'View Ticket',
      x: e.clientX + 15,
      y: e.clientY
    });
  };

  const handleMouseLeave = () => {
    setHoveredTooltip(null);
  };

  const handleNotificationClick = async (notif) => {
    if (notif.status === 'unread') {
      await markAsRead(notif.id);
    }
    if (notif.related_entity_type === 'ticket' && notif.related_entity_id) {
      setShowPanel(false);
      navigate(`/edit-ticket/${notif.related_entity_id}`);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'assignment':
        return <UserPlus className="ds-notif-type-icon assignment" size={18} />;
      case 'comment':
        return <MessageSquare className="ds-notif-type-icon comment" size={18} />;
      case 'status_change':
        return <ArrowRight className="ds-notif-type-icon status-change" size={18} />;
      case 'attachment':
        return <Paperclip className="ds-notif-type-icon attachment" size={18} />;
      default:
        return <Info className="ds-notif-type-icon default" size={18} />;
    }
  };

  const getPriorityClass = (priority) => {
    if (!priority) return 'ds-priority-medium';
    return `ds-priority-${priority.toLowerCase()}`;
  };

  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) {
        if (date.getDate() === now.getDate()) {
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return 'Yesterday';
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (e) {
      return '';
    }
  };

  const formatDueDate = (dateStr) => {
    try {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return `Due ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    } catch (e) {
      return '';
    }
  };

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
    { path: '/dashboard', icon: SquareKanban, label: 'Kanban' },
    { path: '/Tickets', icon: History, label: 'Timeline' },
    { path: '/ProgressPulse', icon: Activity, label: 'Progress Pulse' },
    { path: '/Reports', icon: BarChart2, label: 'Analytics' }
  ];

  return (
    <>
      {showPanel && (
        <div
          className="ds-panel-overlay"
          onClick={() => setShowPanel(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent',
            zIndex: 997
          }}
        />
      )}
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
            const isActive = item.isPanelTrigger 
              ? showPanel 
              : (location.pathname === item.path || (item.path === '/ProgressPulse' && location.pathname === '/progress'));

            return (
              <div
                key={index}
                className={`ds-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  if (item.isPanelTrigger) {
                    setShowPanel(prev => !prev);
                  } else {
                    setShowPanel(false);
                    navigate(item.path);
                  }
                }}
                title={item.label}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className="ds-icon" />
                  {item.hasBadge && unreadCount > 0 && !showPanel && (
                    <span className="ds-badge" style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      width: '10px',
                      height: '10px',
                      backgroundColor: '#ef4444',
                      borderRadius: '50%'
                    }} />
                  )}
                </div>
              </div>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          
          {/* Notifications Trigger */}
          <div
            className={`ds-nav-item ${showPanel ? 'active' : ''}`}
            onClick={() => setShowPanel(prev => !prev)}
            title="Notifications"
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={24} strokeWidth={showPanel ? 2.5 : 2} className="ds-icon" />
              {unreadCount > 0 && !showPanel && (
                <span className="ds-badge" style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '10px',
                  height: '10px',
                  backgroundColor: '#ef4444',
                  borderRadius: '50%'
                }} />
              )}
            </div>
          </div>

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
                <div className="ds-user-info">
                  <div className="ds-user-name">{currentUser?.username || localStorage.getItem('username') || 'User'}</div>
                  <div className="ds-user-role">{currentUser?.role || localStorage.getItem('userRole') || 'Member'}</div>
                </div>
                <div className="ds-divider" />
                <button type="button" className="ds-logout-btn" onClick={handleLogout}>
                  <LogOut size={16} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Notifications Side Drawer Panel */}
      <div className={`ds-notifications-panel ${showPanel ? 'open' : ''}`}>
        <div className="ds-panel-header">
          <div className="ds-panel-title-section">
            <h3>Notifications</h3>
            {unreadCount > 0 && <span className="ds-unread-badge">{unreadCount} new</span>}
          </div>
          <div className="ds-panel-actions">
            {notifications.some(n => n.status === 'unread') && (
              <button className="ds-panel-action-btn" onClick={markAllRead} title="Mark all as read">
                <Check size={16} />
              </button>
            )}
            <button className="ds-panel-close-btn" onClick={() => setShowPanel(false)} title="Close panel">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="ds-panel-content">
          {notifications.length === 0 ? (
            <div className="ds-no-notifications">
              <BellOff size={36} className="ds-bell-off-icon" />
              <h4>All Caught Up!</h4>
              <p>No new notifications at this time.</p>
            </div>
          ) : (
            <div className="ds-notif-list">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`ds-notif-card ${notif.status} ${getPriorityClass(notif.priority)} ${deletingIds.includes(notif.id) ? 'deleting' : ''}`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="ds-notif-indicator" />
                  <div className="ds-notif-icon-wrapper">
                    {getIcon(notif.notification_type)}
                  </div>
                  <div className="ds-notif-body">
                    <div className="ds-notif-title-row">
                      <div className="ds-notif-title-left">
                        {notif.notification_type === 'comment' ? (
                          <h5 title={notif.ticket_title || 'View Ticket'}>
                            New Comment
                          </h5>
                        ) : notif.notification_type === 'attachment' ? (
                          <h5 title={notif.ticket_title || 'View Ticket'}>
                            New Attachment
                          </h5>
                        ) : (
                          <h5>{notif.title}</h5>
                        )}
                        {notif.related_entity_id && (
                          <div 
                            className="ds-notif-ticket-pill-wrapper"
                            onMouseMove={(e) => handleMouseMove(e, notif.ticket_title)}
                            onMouseLeave={handleMouseLeave}
                          >
                            <span className="ds-notif-pill ticket-num">
                              #{notif.related_entity_id}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="ds-notif-time">{formatTime(notif.created_at)}</span>
                    </div>
                    <p className="ds-notif-message">{notif.message ? notif.message.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ') : ''}</p>
                    {(notif.ticket_priority || notif.ticket_due_date || notif.project_name) && (
                      <div className="ds-notif-pills">
                        {notif.project_name && (
                          <span className="ds-notif-pill project">
                            {notif.project_name}
                          </span>
                        )}
                        {notif.ticket_priority && notif.notification_type !== 'comment' && notif.notification_type !== 'attachment' && (
                          <span className={`ds-notif-pill priority ${notif.ticket_priority.toLowerCase()}`}>
                            {notif.ticket_priority}
                          </span>
                        )}
                        {notif.ticket_due_date && notif.notification_type !== 'comment' && notif.notification_type !== 'attachment' && (
                          <span className="ds-notif-pill due-date">
                            {formatDueDate(notif.ticket_due_date)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    className="ds-notif-delete-btn"
                    title="Delete Notification"
                    onClick={(e) => deleteNotification(notif.id, e)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {hoveredTooltip && (
        <div
          className="ds-cursor-tooltip"
          style={{
            position: 'fixed',
            left: hoveredTooltip.x,
            top: hoveredTooltip.y,
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          {hoveredTooltip.text}
        </div>
      )}
    </>
  );
};

export default DashboardSidebar;
