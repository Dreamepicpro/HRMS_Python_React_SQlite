/**
 * Authentication Helper Utilities
 * Provides helper functions for user-specific localStorage operations
 */

/**
 * Get user-specific localStorage key
 * @param {string} username - Username
 * @param {string} key - Key name (e.g., 'token', 'user', 'session_id')
 * @returns {string} - User-specific key
 */
export const getUserStorageKey = (username, key) => {
  return username ? `ves_${key}_${username}` : `ves_${key}`;
};

/**
 * Get current logged-in username
 * @returns {string|null} - Current username or null
 */
export const getCurrentUsername = () => {
  return localStorage.getItem('ves_current_user');
};

/**
 * Get token for current user
 * @returns {string|null} - JWT token or null
 */
export const getToken = () => {
  const currentUsername = getCurrentUsername();
  if (currentUsername) {
    const tokenKey = getUserStorageKey(currentUsername, 'token');
    return localStorage.getItem(tokenKey);
  }
  // Fallback to old key for backward compatibility
  return localStorage.getItem('ves_token');
};

/**
 * Get refresh token for current user
 * @returns {string|null} - Refresh token or null
 */
export const getRefreshToken = () => {
  const currentUsername = getCurrentUsername();
  if (currentUsername) {
    const refreshKey = getUserStorageKey(currentUsername, 'refresh_token');
    return localStorage.getItem(refreshKey);
  }
  return localStorage.getItem('ves_refresh_token');
};

/**
 * Get user data for current user
 * @returns {object|null} - User data object or null
 */
export const getUserData = () => {
  const currentUsername = getCurrentUsername();
  if (currentUsername) {
    const userKey = getUserStorageKey(currentUsername, 'user');
    const userData = localStorage.getItem(userKey);
    return userData ? JSON.parse(userData) : null;
  }
  const userData = localStorage.getItem('ves_user');
  return userData ? JSON.parse(userData) : null;
};

/**
 * Decode JWT token without verification
 * @param {string} token - JWT token
 * @returns {object|null} - Decoded token payload or null
 */
export const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Token decode error:', error);
    return null;
  }
};

/**
 * Check if current session is valid
 * @returns {boolean} - True if session is valid, false otherwise
 */
export const isSessionValid = () => {
  const currentUsername = getCurrentUsername();
  if (!currentUsername) return false;

  const token = getToken();
  if (!token) return false;

  // Decode token and validate
  const decodedToken = decodeToken(token);
  if (!decodedToken) return false;

  // Check if token username matches current user
  if (decodedToken.sub !== currentUsername) {
    console.error('Session conflict: token username mismatch');
    return false;
  }

  // Check session_id if available
  const sessionKey = getUserStorageKey(currentUsername, 'session_id');
  const storedSessionId = localStorage.getItem(sessionKey);
  if (storedSessionId && decodedToken.session_id !== storedSessionId) {
    console.error('Session ID mismatch');
    return false;
  }

  // Check expiration
  if (decodedToken.exp && decodedToken.exp * 1000 < Date.now()) {
    console.error('Token expired');
    return false;
  }

  return true;
};

/**
 * Clear all authentication data for current user
 */
export const clearAuthData = () => {
  const currentUsername = getCurrentUsername();

  if (currentUsername) {
    localStorage.removeItem(getUserStorageKey(currentUsername, 'token'));
    localStorage.removeItem(getUserStorageKey(currentUsername, 'refresh_token'));
    localStorage.removeItem(getUserStorageKey(currentUsername, 'user'));
    localStorage.removeItem(getUserStorageKey(currentUsername, 'token_expiry'));
    localStorage.removeItem(getUserStorageKey(currentUsername, 'session_id'));
  }

  // Clear current user marker
  localStorage.removeItem('ves_current_user');

  // Clear old keys for backward compatibility
  localStorage.removeItem('ves_token');
  localStorage.removeItem('ves_refresh_token');
  localStorage.removeItem('ves_user');
  localStorage.removeItem('ves_token_expiry');
};
