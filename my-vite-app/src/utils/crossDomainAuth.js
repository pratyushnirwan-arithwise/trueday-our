// Cross-domain authentication utilities for JWT token handling

/**
 * Handle JWT token from URL parameters (when redirected from main domain)
 * This function should be called when the app loads
 */
export function handleCrossDomainAuth() {
  if (typeof window === 'undefined') return;

  const urlParams = new URLSearchParams(window.location.search);
  const jwtToken = urlParams.get('jwt') || urlParams.get('token');

  if (jwtToken) {
    console.log('JWT token found in URL, storing for authentication');

    // Store the JWT token
    localStorage.setItem('jwt_token', jwtToken);

    // Extract user info from token
    try {
      const payload = JSON.parse(atob(jwtToken.split('.')[1]));
      if (payload) {
        const userId = payload.user_id || payload.sub || payload.id;
        const username = payload.username || payload.name || payload.full_name || payload.nickname || payload.display_name || payload.user_name || 'User';

        localStorage.setItem('userId', userId);
        localStorage.setItem('username', username);
        if (payload.email || payload.user_email) {
          localStorage.setItem('email', payload.email || payload.user_email);
        }
        console.log('User info extracted from JWT:', {
          user_id: userId,
          username: username
        });
      }
    } catch (error) {
      console.error('Error extracting user info from JWT:', error);
    }

    // Clean the URL by removing the JWT parameter
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('jwt');
    newUrl.searchParams.delete('token');
    window.history.replaceState({}, '', newUrl.toString());

    return true; // JWT token was found and processed
  }

  return false; // No JWT token found
}

/**
 * Generate redirect URL for main domain with JWT token
 * This should be used by the main domain to redirect to the dashboard
 * @param {string} jwtToken - JWT token to include in URL
 * @param {string} path - Dashboard path (optional)
 * @returns {string} Complete redirect URL
 */
export function generateDashboardRedirectUrl(jwtToken, path = '/dashboard') {
  const baseUrl = 'https://trueday.ariths.com';
  const url = new URL(path, baseUrl);
  url.searchParams.set('jwt', jwtToken);
  return url.toString();
}

/**
 * Check if we have a valid JWT token
 * @returns {boolean} True if valid JWT token exists
 */
export function hasValidJWTToken() {
  if (typeof window === 'undefined') return false;

  try {
    const jwtToken = localStorage.getItem('jwt_token');
    if (!jwtToken) return false;

    const payload = JSON.parse(atob(jwtToken.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);

    // Check if token is expired (with 5-minute grace period for clock drift)
    if (payload.exp && (payload.exp + 300) < now) {
      console.warn('JWT token has expired');
      // Only clear if it's very old (e.g. more than 1 day)
      // For now, let the caller handle it or let UserContext try to refresh
      return false;
    }

    // Check if token has required fields (user_id is essential)
    if (!payload.user_id && !payload.sub && !payload.id) {
      console.warn('JWT token missing user identifier');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating JWT token:', error);
    localStorage.removeItem('jwt_token'); // Only remove the invalid token, not the entire session
    return false;
  }
}

/**
 * Clear all authentication data
 */
export function clearAuthData() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('jwt_token');
  localStorage.removeItem('userId');
  localStorage.removeItem('username');
  localStorage.removeItem('email');
  localStorage.removeItem('userRole');
}

/**
 * Get current user info from JWT token
 * @returns {Object|null} User info if available
 */
export function getCurrentUserFromJWT() {
  if (typeof window === 'undefined') return null;

  const jwtToken = localStorage.getItem('jwt_token');
  if (!jwtToken) return null;

  try {
    const payload = JSON.parse(atob(jwtToken.split('.')[1]));

    // Check if token is expired (with 5-minute grace period)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && (payload.exp + 300) < now) {
      console.warn('JWT token has expired in getCurrentUserFromJWT');
      return null;
    }

    // Ensure we have required fields
    const userId = payload.user_id || payload.sub || payload.id;
    if (!userId) {
      console.log('JWT token missing user identifier in getCurrentUserFromJWT');
      return null;
    }

    const username = payload.username || payload.name || payload.full_name || payload.nickname || payload.display_name || payload.user_name || 'User';
    const email = payload.email || payload.user_email;

    console.log('Extracted user info from JWT:', {
      id: userId,
      username: username,
      email: email
    });

    return {
      id: userId,
      username: username,
      email: email
    };
  } catch (error) {
    console.error('Error extracting user info from JWT:', error);
    return null;
  }
}
