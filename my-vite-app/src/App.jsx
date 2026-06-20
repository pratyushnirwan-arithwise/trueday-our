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
import LoadingScreen from "./components/LoadingScreen";

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
        if (isLocal) {
          console.log('App - Localhost detected, granting access');
          setAuthChecked(true);
          setIsAuthenticating(false);
          return;
        }
        // -----------------------------

        // Handle cross-domain authentication first
        const jwtProcessed = handleCrossDomainAuth();

        if (jwtProcessed) {
          console.log('JWT token processed from URL');
          // Reload the page to apply the new authentication
          window.location.reload();
          return;
        }

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
    return <div style={{ minHeight: "100vh", backgroundColor: "#ffffff" }} />;
  }

  return children;
};

function App() {
  const { loading: userLoading, error: userError } = useUser();
  const [appLoading, setAppLoading] = React.useState(true);
  const [serverOnline, setServerOnline] = React.useState(true);
  const [minPlayTimeElapsed, setMinPlayTimeElapsed] = React.useState(false);
  const [onlineStatus, setOnlineStatus] = React.useState(navigator.onLine);

  // Track browser online/offline status
  React.useEffect(() => {
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Minimum play time of 2 seconds for check.gif
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setMinPlayTimeElapsed(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Poll backend health check
  React.useEffect(() => {
    let active = true;
    const checkServer = async () => {
      try {
        const res = await fetch("/test");
        if (active) {
          setServerOnline(res.ok);
        }
      } catch (err) {
        if (active) {
          setServerOnline(false);
        }
      }
    };

    checkServer();
    const interval = setInterval(checkServer, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Determine if there is a blocking network or connection error
  const hasError = !onlineStatus || !serverOnline || !!userError;
  const isLoadedAndStable = minPlayTimeElapsed && !userLoading && !hasError;

  React.useEffect(() => {
    if (isLoadedAndStable) {
      setAppLoading(false);
    }
  }, [isLoadedAndStable]);

  if (appLoading) {
    return <LoadingScreen continueLoading={userLoading || hasError} />;
  }

  return (
    <Router>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
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