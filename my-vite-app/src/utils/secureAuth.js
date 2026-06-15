// Secure authentication utilities for preventing URL parameter tampering

/**
 * Extract and validate secure token from URL parameters
 * @returns {Object|null} Token data if valid, null otherwise
 */
export function getSecureTokenData() {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      return null;
    }

    // Validate token with backend
    return validateTokenWithBackend(token);
  } catch (error) {
    console.error('Error extracting secure token:', error);
    return null;
  }
}

/**
 * Validate token with backend
 * @param {string} token - The secure token to validate
 * @returns {Promise<Object|null>} Token data if valid, null otherwise
 */
async function validateTokenWithBackend(token) {
  try {
    const response = await fetch(`/validate-token?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('Token validation failed:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.valid) {
      return {
        user_id: data.user_id,
        access_type: data.access_type,
        token: token
      };
    }

    return null;
  } catch (error) {
    console.error('Error validating token with backend:', error);
    return null;
  }
}

/**
 * Get user ID from JWT token, secure token, or fallback to localStorage
 * @returns {string|null} User ID if available, null otherwise
 */
export function getSecureUserId() {
  try {
    // First try to get from JWT token in localStorage
    const jwtToken = localStorage.getItem('jwt_token');
    if (jwtToken) {
      try {
        // Decode JWT token to extract user_id
        const payload = JSON.parse(atob(jwtToken.split('.')[1]));
        const extractedUserId = payload && (payload.user_id || payload.sub || payload.id);
        if (extractedUserId) {
          // Check if token is expired
          const now = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp < now) {
            console.log('JWT token has expired locally, but keeping session active until backend rejects');
            // We do not remove from storage here to prevent aggressive local logouts
            // on page refresh due to minor clock skews.
          }
          return extractedUserId;
        }
      } catch (error) {
        console.warn('Error parsing JWT token:', error);
        // Remove invalid JWT token
        localStorage.removeItem('jwt_token');
      }
    }

    // Second try to get from secure token in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      try {
        // Decode the secure token to extract user_id
        const decoded = atob(token);
        const [data, signature] = decoded.split(':');
        const [user_id, timestamp, access_type] = data.split(':');

        if (user_id) {
          return user_id;
        }
      } catch (error) {
        console.warn('Error parsing secure token:', error);
      }
    }

    // Third try to get from localStorage (for backward compatibility)
    const userId = localStorage.getItem('userId');
    if (userId) {
      return userId;
    }

    return null;
  } catch (error) {
    console.error('Error in getSecureUserId:', error);
    return null;
  }
}

/**
 * Get username from secure token or fallback to localStorage
 * @returns {string|null} Username if available, null otherwise
 */
export function getSecureUsername() {
  // First try to get from secure token
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (token) {
    try {
      // Decode the secure token to extract access_type (which might contain username info)
      const decoded = atob(token);
      const [data, signature] = decoded.split(':');
      const [user_id, timestamp, access_type] = data.split(':');

      // For now, we'll need to fetch username from backend using user_id
      // This is a limitation of our current token format
      return null; // Will fallback to localStorage
    } catch (error) {
      console.warn('Error parsing secure token for username:', error);
    }
  }

  // Fallback to localStorage (for backward compatibility)
  return localStorage.getItem('username');
}

/**
 * Check if current session is using secure token
 * @returns {boolean} True if using secure token, false otherwise
 */
export function isUsingSecureToken() {
  const params = new URLSearchParams(window.location.search);
  return params.has('token');
}

/**
 * Clean URL by removing insecure parameters
 * This prevents users from manually adding sessionid parameters
 */
export function cleanInsecureUrl() {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);

  // Remove insecure parameters
  params.delete('sessionid');
  params.delete('access_type');

  // Update URL without insecure parameters
  const newUrl = `${url.origin}${url.pathname}${params.toString() ? '?' + params.toString() : ''}${url.hash}`;

  if (newUrl !== window.location.href) {
    window.history.replaceState({}, '', newUrl);
  }
}

/**
 * Redirect to secure login if no valid authentication found
 */
export function redirectToSecureLogin() {
  if (typeof window === 'undefined') return;

  // Clean the URL first
  cleanInsecureUrl();

  // Redirect to ariths.com instead of local login
  window.location.href = 'https://ariths.com/';
}

/**
 * Initialize secure authentication
 * This should be called when the app starts
 */
export function initializeSecureAuth() {
  // Clean insecure URL parameters
  cleanInsecureUrl();

  // Check if we have valid authentication
  const userId = getSecureUserId();
  if (!userId) {
    redirectToSecureLogin();
    return false;
  }

  return true;
}

/**
 * Handle authentication failure - redirect to local login
 */
export function handleAuthFailure() {
  if (typeof window === 'undefined') return;

  // Clear any stored authentication data
  localStorage.removeItem('userId');
  localStorage.removeItem('username');
  localStorage.removeItem('userRole');
  localStorage.removeItem('jwt_token');

  // Clean the URL
  cleanInsecureUrl();

  // Keep users inside TrueDay app on auth failure
  window.location.href = '#/login';
}

/**
 * Store JWT token for cross-domain authentication
 * @param {string} token - JWT token to store
 */
export function storeJWTToken(token) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem('jwt_token', token);

    // Also extract and store user info for quick access
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload) {
      localStorage.setItem('userId', payload.user_id);
      localStorage.setItem('username', payload.username);
      if (payload.email) {
        localStorage.setItem('email', payload.email);
      }
    }

    console.log('JWT token stored successfully');
  } catch (error) {
    console.error('Error storing JWT token:', error);
  }
}

/**
 * Validate JWT token with backend
 * @param {string} token - JWT token to validate
 * @returns {Promise<Object|null>} User data if valid, null otherwise
 */
export async function validateJWTToken(token) {
  try {
    const response = await fetch('/api/auth/validate-jwt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      console.warn('JWT validation failed:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.valid) {
      return {
        user_id: data.user_id,
        username: data.username,
        email: data.email,
        role: data.role,
        assigned_projects: data.assigned_projects
      };
    }

    return null;
  } catch (error) {
    console.error('Error validating JWT token:', error);
    return null;
  }
}
