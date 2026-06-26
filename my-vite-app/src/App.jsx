import React from "react";
import { HashRouter as Router, Route, Routes, Navigate, useLocation } from "react-router-dom";
import Login from "./login";
import Register from "./Register";
import Hero from "./Home";
import DashBoard from "./DashBoard";
import CreateTicket from "./CreateTicket";
import Tickets from "./Timeline";
import Reports from "./Reports";
import Features from "./Features";
import About from "./About";
import Contact from "./Contact";

import ProgressPulse from "./ProgressPulse";
import TicketTracker from "./TicketTracker";
import Question from "./Question";
import Rewards from "./Rewards";
import Calendar from "./Calendar";
import EditTicket from "./EditTicket";
import Profile from "./Profile";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import "./App.css"; // Import the CSS file
import { UserProvider, useUser } from './contexts/UserContext';
import { getSecureUserId, initializeSecureAuth, cleanInsecureUrl, handleAuthFailure } from './utils/secureAuth';
import { handleCrossDomainAuth, hasValidJWTToken } from './utils/crossDomainAuth';

// Protected Route Component with Cross-Domain Authentication
const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const { loading: userLoading } = useUser();
  const [isAuthenticating, setIsAuthenticating] = React.useState(true);
  const [authChecked, setAuthChecked] = React.useState(false);
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  React.useEffect(() => {
    const checkAuthentication = async () => {
      try {
        // Handle cross-domain authentication first
        const jwtProcessed = handleCrossDomainAuth();

        if (jwtProcessed) {
          console.log('JWT token processed from URL');
          // Reload the page to apply the new authentication
          window.location.reload();
          return;
        }

        if (isLocal) {
          console.log('App - Localhost detected, granting access');
          setAuthChecked(true);
          setIsAuthenticating(false);
          return;
        }
        // -----------------------------

        // Clean insecure URL parameters
        cleanInsecureUrl();

        // Check for valid authentication
        const hasJWT = hasValidJWTToken();
        const userId = getSecureUserId();

        console.log('Authentication check:', { hasJWT, userId });

        const path = window.location.hash.split('?')[0];
        const isAuthPage = path === '#/login' || path === '#/register' || window.location.pathname === '/login' || window.location.pathname === '/register';

        if (!hasJWT && !userId && !isAuthPage) {
          console.log('No valid authentication found, redirecting to login (BYPASSED)');
          // handleAuthFailure();
          // return;
        }

        console.log('Authentication valid, allowing access to dashboard');
        setAuthChecked(true);
      } catch (error) {
        console.error('Error during authentication check:', error);
        handleAuthFailure();
      } finally {
        setIsAuthenticating(false);
      }
    };

    checkAuthentication();
  }, [isLocal]);

  // Show loading while checking authentication OR while UserContext is initializing
  if (isAuthenticating || userLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        gap: '24px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid rgba(99, 102, 241, 0.1)',
          borderTop: '4px solid #6366f1',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }}></div>
        <div style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#1e293b',
          letterSpacing: '-0.025em'
        }}>
          {userLoading ? 'Preparing your dashboard...' : 'Securing your session...'}
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return children;
};

function App() {
  return (
    <Router>
      <div className="flex flex-col items-center justify-center  bg-gray-100 p-0">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashBoard />
            </ProtectedRoute>
          } />
          <Route path="/CreateTicket" element={
            <ProtectedRoute>
              <CreateTicket />
            </ProtectedRoute>
          } />
          <Route path="/Tickets" element={
            <ProtectedRoute>
              <Tickets />
            </ProtectedRoute>
          } />
          <Route path="/Reports" element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          } />
          <Route path="/Features" element={<Features />} />
          <Route path="/About" element={<About />} />
          <Route path="/Contact" element={<Contact />} />
          <Route path="/ProgressPulse" element={
            <ProtectedRoute>
              <ProgressPulse />
            </ProtectedRoute>
          } />
          <Route path="/progress" element={
            <ProtectedRoute>
              <ProgressPulse />
            </ProtectedRoute>
          } />
          <Route path="/progrespulse" element={
            <ProtectedRoute>
              <ProgressPulse />
            </ProtectedRoute>
          } />
          <Route path="/TicketTracker" element={
            <ProtectedRoute>
              <TicketTracker />
            </ProtectedRoute>
          } />
          <Route path="/Question" element={
            <ProtectedRoute>
              <Question />
            </ProtectedRoute>
          } />
          <Route path="/Rewards" element={
            <ProtectedRoute>
              <Rewards />
            </ProtectedRoute>
          } />
          <Route path="/Calendar" element={
            <ProtectedRoute>
              <Calendar />
            </ProtectedRoute>
          } />
          <Route path="/Profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/edit-ticket/:id" element={
            <ProtectedRoute>
              <EditTicket />
            </ProtectedRoute>
          } />
          <Route path="/*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <ToastContainer position="bottom-right" />
      </div>
    </Router>
  );
}

export default App;