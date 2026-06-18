import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSecureUserId, getSecureTokenData, getSecureUsername, handleAuthFailure, validateJWTToken } from '../utils/secureAuth';
import { getCurrentUserFromJWT } from '../utils/crossDomainAuth';

const UserContext = createContext();

const safeJSONParse = (val, fallback) => {
  try {
    return JSON.parse(val === 'undefined' ? fallback : (val || fallback));
  } catch (e) {
    console.warn('JSON parsing error for value:', val, e);
    return JSON.parse(fallback);
  }
};


const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true); // Start as loading until initialized
  const [error, setError] = useState(null);

  // Helper function to get session ID from URL (deprecated - use secure auth)
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

  // Fetch user data from backend using user ID — uses /users/ which returns project_roles + string assigned_projects
  const fetchUserBySessionId = async (userId) => {
    try {
      console.log('UserContext - Fetching user data for user ID:', userId);
      const response = await fetch(`/users/${userId}`);
      if (response.ok) {
        const userData = await response.json();
        console.log('UserContext - User data fetched:', userData);
        return {
          id: userData.id || userId,
          username: userData.username || userData.name || 'User',
          role: userData.role || 'User',
          assigned_projects: (userData.assigned_projects || []).map(id => String(id)),
          project_roles: userData.project_roles || {}
        };
      } else {
        console.log('UserContext - Failed to fetch user data for ID:', userId, 'Status:', response.status);
        return null;
      }
    } catch (error) {
      console.error('UserContext - Error fetching user data:', error);
      return null;
    }
  };

  useEffect(() => {
    const initializeUser = async () => {
      setLoading(true);
      try {
        const hostname = window.location.hostname;
        const isLocal = (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname === '::1' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.')
        );

        // 1. JWT TOKEN STRATEGY (Ariths SSO)
        const jwtUserData = getCurrentUserFromJWT();
        const jwtToken = localStorage.getItem('jwt_token');

        if (jwtUserData && jwtToken) {
          console.log('UserContext - JWT user data found:', jwtUserData);

          const cachedUsername = localStorage.getItem('username');
          const initialUser = {
            id: jwtUserData.id,
            username: (jwtUserData.username && jwtUserData.username !== 'User') ? jwtUserData.username : (cachedUsername || 'User'),
            email: jwtUserData.email,
            role: localStorage.getItem('userRole') || 'User',
            assigned_projects: safeJSONParse(localStorage.getItem('assignedProjects'), '[]'),
            project_roles: safeJSONParse(localStorage.getItem('projectRoles'), '{}')
          };
          setCurrentUser(initialUser);
          setLoading(false); // <--- UNBLOCK UI IMMEDIATELY

          // Sync in background WITHOUT blocking initializeUser
          validateJWTToken(jwtToken).then(syncedData => {
            if (syncedData) {
              console.log('UserContext - Background sync success:', syncedData);
              const updatedUser = {
                id: syncedData.user_id || initialUser.id,
                username: syncedData.username || initialUser.username,
                email: syncedData.email || initialUser.email,
                role: syncedData.role || initialUser.role,
                assigned_projects: syncedData.assigned_projects || initialUser.assigned_projects,
                project_roles: initialUser.project_roles
              };

              localStorage.setItem('userId', String(updatedUser.id));
              localStorage.setItem('username', updatedUser.username);
              localStorage.setItem('userRole', updatedUser.role);
              localStorage.setItem('assignedProjects', JSON.stringify(updatedUser.assigned_projects || []));

              setCurrentUser(updatedUser);
            }
          }).catch(err => console.error('UserContext - Background sync failed:', err));

          return;
        }

        // 3. SECURE TOKEN STRATEGY
        const secureUserId = getSecureUserId();
        if (secureUserId) {
          console.log('UserContext - Secure authentication found for user:', secureUserId);
          const userData = await fetchUserBySessionId(secureUserId);
          if (userData) {
            localStorage.setItem('userId', String(userData.id));
            localStorage.setItem('username', userData.username);
            localStorage.setItem('userRole', userData.role || 'User');
            localStorage.setItem('assignedProjects', JSON.stringify(userData.assigned_projects || []));

            setCurrentUser(userData);
            setLoading(false);
            return;
          }
        }

        // 4. LEGACY SESSION ID STRATEGY
        const sessionId = getSessionId();
        if (sessionId) {
          const userData = await fetchUserBySessionId(sessionId);
          if (userData) {
            // ✅ FIX: persist to localStorage so next refresh can restore from Strategy 5
            localStorage.setItem('userId', String(userData.id));
            localStorage.setItem('username', userData.username);
            localStorage.setItem('userRole', userData.role || 'User');
            localStorage.setItem('assignedProjects', JSON.stringify(userData.assigned_projects || []));
            localStorage.setItem('projectRoles', JSON.stringify(userData.project_roles || {}));
            setCurrentUser(userData);
            setLoading(false);
            return;
          }
        }

        // 5. LOCALHOST / LAN TRUST POLICY
        if (isLocal) {
          console.log('UserContext - Local network detected, using cached data + background refresh');
          const cachedUserId = localStorage.getItem('userId');
          const cachedUsername = localStorage.getItem('username') || 'User';
          const cachedRole = localStorage.getItem('userRole') || 'User';
          const cachedProjects = safeJSONParse(localStorage.getItem('assignedProjects'), '[]');

          // Unblock UI immediately with cached values (even if empty, loading is false)
          setCurrentUser(cachedUserId ? {
            id: cachedUserId,
            username: cachedUsername,
            role: cachedRole,
            assigned_projects: cachedProjects,
            project_roles: safeJSONParse(localStorage.getItem('projectRoles'), '{}')
          } : null);
          setLoading(false);

          // Background refresh: only if we have a real userId (don't default to '1')
          if (cachedUserId) {
            fetchUserBySessionId(cachedUserId).then(freshData => {
              if (freshData) {
                console.log('UserContext - Local background refresh success:', freshData);
                localStorage.setItem('userId', String(freshData.id));
                localStorage.setItem('username', freshData.username);
                localStorage.setItem('userRole', freshData.role || cachedRole);
                localStorage.setItem('assignedProjects', JSON.stringify(freshData.assigned_projects || []));
                localStorage.setItem('projectRoles', JSON.stringify(freshData.project_roles || {}));
                setCurrentUser({
                  ...freshData
                });
              }
            }).catch(err => console.warn('UserContext - Local background refresh failed:', err));
          }

          return;
        }

        // 6. CACHED DATA FALLBACK
        const cachedUserId = localStorage.getItem('userId');
        const cachedUsername = localStorage.getItem('username');
        if (cachedUserId && cachedUsername) {
          console.log('UserContext - Using cached user data as fallback');
          const cachedRole = localStorage.getItem('userRole') || 'User';
          setCurrentUser({
            id: cachedUserId,
            username: cachedUsername,
            role: cachedRole,
            assigned_projects: safeJSONParse(localStorage.getItem('assignedProjects'), '[]'),
            project_roles: safeJSONParse(localStorage.getItem('projectRoles'), '{}')
          });
          setLoading(false);

          // ✅ FIX: background refresh so assigned_projects is always fresh from DB
          fetchUserBySessionId(cachedUserId).then(freshData => {
            if (freshData) {
              localStorage.setItem('userId', String(freshData.id));
              localStorage.setItem('username', freshData.username);
              localStorage.setItem('userRole', freshData.role || cachedRole);
              localStorage.setItem('assignedProjects', JSON.stringify(freshData.assigned_projects || []));
              localStorage.setItem('projectRoles', JSON.stringify(freshData.project_roles || {}));
              setCurrentUser({ ...freshData });
            }
          }).catch(err => console.warn('UserContext - Cached data background refresh failed:', err));

          return;
        }

        // 6. NO AUTH FOUND
        console.log('UserContext - No authentication found');
        setCurrentUser(null);
      } catch (err) {
        console.error('UserContext - Initialization error:', err);
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeUser();
  }, []);

  const setUser = (userData) => {
    console.log('UserContext - setUser called with:', userData);
    // Store in localStorage
    localStorage.setItem('userId', userData.id);
    localStorage.setItem('username', userData.username);
    localStorage.setItem('userRole', userData.role || 'User');
    localStorage.setItem('assignedProjects', JSON.stringify(userData.assigned_projects || []));

    // Update state
    setCurrentUser({
      ...userData,
      assigned_projects: userData.assigned_projects || []
    });
    console.log('UserContext - User data stored and state updated');
  };

  const value = {
    currentUser,
    setCurrentUser,
    setUser,
    loading,
    error,
    refreshUser: async () => {
      const userId = localStorage.getItem('userId');
      const username = localStorage.getItem('username');
      if (userId && username) {
        setCurrentUser({
          id: userId,
          username: username,
          role: localStorage.getItem('userRole') || 'User',
          assigned_projects: safeJSONParse(localStorage.getItem('assignedProjects'), '[]')
        });
      } else {
        // Try to fetch from session ID if available
        const sessionId = getSessionId();
        if (sessionId) {
          const userData = await fetchUserBySessionId(sessionId);
          if (userData) {
            setCurrentUser(userData);
          }
        }
      }
    },
    forceRefreshUser: async () => {
      console.log('UserContext - Force refreshing user data...');

      // Try to get an ID to fetch from
      let targetId = getSessionId() || getSecureUserId() || localStorage.getItem('userId');

      // Also try JWT as fallback if no ID found
      if (!targetId) {
        const jwtToken = localStorage.getItem('jwt_token');
        if (jwtToken) {
          try {
            const payload = JSON.parse(atob(jwtToken.split('.')[1]));
            targetId = payload.user_id || payload.sub || payload.id;
          } catch (e) {
            console.error('UserContext - Error parsing JWT for force refresh:', e);
          }
        }
      }

      if (targetId) {
        console.log('UserContext - Force refresh for ID:', targetId);
        const userData = await fetchUserBySessionId(targetId);
        if (userData) {
          // Store in localStorage
          localStorage.setItem('userId', userData.id);
          localStorage.setItem('username', userData.username);
          localStorage.setItem('userRole', userData.role || 'User');
          localStorage.setItem('assignedProjects', JSON.stringify(userData.assigned_projects || []));
          setCurrentUser({
            ...userData,
            assigned_projects: userData.assigned_projects || []
          });
          console.log('UserContext - Force refresh completed:', userData);
        } else {
          console.log('UserContext - Force refresh failed, user data not found for ID:', targetId);
        }
      } else {
        console.log('UserContext - No target ID available to force refresh');
      }
    }
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export { UserProvider, useUser }; 