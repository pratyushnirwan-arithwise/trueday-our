import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  Gift,
  Home,
  LogOut,
  Menu,
  Package,
  Settings,
  Ticket,
  User,
} from "lucide-react";

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false); // auto-close on mobile
      } else {
        setSidebarOpen(true); // auto-open on desktop
      }
    };
    window.addEventListener("resize", handleResize);
    // Set initial state
    if (window.innerWidth <= 768) setSidebarOpen(false);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const routes = [
    { name: "Dashboard", path: "/dashboard", icon: Home },
    { name: "Tickets", path: "/tickets", icon: Ticket },
    { name: "Reports", path: "/reports", icon: BarChart3 },
    { name: "ProgressPulse", path: "/progrespulse", icon: Package },
    { name: "TicketTracker", path: "/tickettracker", icon: BarChart3 },
    { name: "Rewards", path: "/rewards", icon: Gift },
    { name: "Profile", path: "/profile", icon: User },
  ];

  const handleLogout = () => {
    window.location.href = 'https://www.ariths.com/tools';
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebarOnMobile = () => {
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <div className="dashboard-layout">
      {/* Mobile overlay backdrop */}
      {isMobile && sidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebarOnMobile} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : "collapsed"}`}>
        <div className="sidebar-header">
          <Link to="/" className="logo">
            <img src="/placeholder.svg" alt="Logo" width={32} height={32} />
            {sidebarOpen && <span className="logo-text">TrueDay</span>}
          </Link>
          <button className="toggle-btn" onClick={toggleSidebar}>
            {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>
        <nav className="sidebar-nav">
          <ul>
            {routes.map((route) => (
              <li key={route.path}>
                <Link
                  to={route.path}
                  className={`nav-button ${location.pathname === route.path ? "active" : ""}`}
                  onClick={closeSidebarOnMobile}
                >
                  <route.icon size={20} className="icon" />
                  {sidebarOpen && <span>{route.name}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <button className="logout-button" onClick={handleLogout}>
            <LogOut size={20} className="icon" />
            {sidebarOpen && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`main-content ${sidebarOpen && !isMobile ? "with-sidebar" : "with-sidebar-collapsed"}`}>
        <header className="topbar">
          <button className="menu-toggle" onClick={toggleSidebar}>
            <Menu size={24} />
          </button>
          <h1 className="page-title">
            {routes.find((route) => route.path === location.pathname)?.name || "Dashboard"}
          </h1>
          <div className="topbar-actions">
            <button className="icon-button">
              <Bell size={20} />
            </button>
            <div className="user-dropdown">
              <img src="/placeholder.svg" alt="User" className="user-avatar" />
              <div className="dropdown-content">
                <Link to="/dashboard/profile" className="dropdown-item">
                  <User size={16} className="icon" />
                  Profile
                </Link>
                <Link to="/dashboard/settings" className="dropdown-item">
                  <Settings size={16} className="icon" />
                  Settings
                </Link>
                <button className="dropdown-item" onClick={handleLogout}>
                  <LogOut size={16} className="icon" />
                  Log out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
