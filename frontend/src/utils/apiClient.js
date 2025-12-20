// VES HRMS API Client
// Axios configuration with interceptors for seamless error handling and auth

import axios from 'axios';
import toast from 'react-hot-toast';

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Store current user's username in the apiClient instance (not in localStorage!)
// This prevents cross-tab conflicts when HR and Employee are in different tabs
apiClient._currentUsername = null;

// Helper to get user-specific localStorage key
const getUserStorageKey = (username, key) => {
  return username ? `ves_${key}_${username}` : `ves_${key}`;
};

// Helper to decode JWT token
const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
};

// Request interceptor for adding auth token and logging
apiClient.interceptors.request.use(
  (config) => {
    // Add timestamp for request tracking
    config.metadata = { startTime: new Date() };
    
    // Log API calls in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔗 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }

    // Add auth token if available (skip for refresh and login endpoints)
    if (!config.url?.includes('/token/refresh') && !config.url?.includes('/api/login')) {
      // Get token from Authorization header (set by AuthContext on login)
      // This is already set in apiClient.defaults.headers.common['Authorization']
      // So we don't need to do anything here - just let it pass through
      
      // Fallback: If no Authorization header, try localStorage
      if (!config.headers.Authorization) {
        // Try to find any valid token in localStorage
        const allKeys = Object.keys(localStorage);
        const tokenKeys = allKeys.filter(key => key.startsWith('ves_token_'));
        
        for (const tokenKey of tokenKeys) {
          const token = localStorage.getItem(tokenKey);
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            break;
          }
        }
      }
    }

    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and logging
apiClient.interceptors.response.use(
  (response) => {
    // Calculate request duration
    const duration = new Date() - response.config.metadata.startTime;
    
    // Log successful responses in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url} (${duration}ms)`);
    }

    // Show performance warning for slow requests
    if (duration > 2000) {
      console.warn(`⚠️ Slow API request detected: ${response.config.url} took ${duration}ms`);
    }

    return response;
  },
  (error) => {
    // Calculate request duration if metadata exists
    const duration = error.config?.metadata ? 
      new Date() - error.config.metadata.startTime : 0;

    // Log error details
    console.error(`❌ API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url} (${duration}ms)`, {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });

    // Handle different types of errors
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      // Check if token has been revoked (force logout from another device)
      if (status === 401 && data?.revoked === true) {
        // Atomic check-and-set using localStorage (synchronous and shared)
        const alreadyRevoking = localStorage.getItem('_session_revoking');
        
        // Set lock flag BEFORE checking (prevents race condition)
        localStorage.setItem('_session_revoking', 'true');
        
        // If another request already handled this, skip silently
        if (alreadyRevoking === 'true') {
          // Don't reject - just return a never-resolving promise to prevent errors
          return new Promise(() => {}); // Hangs forever, preventing further execution
        }
        
        // Broadcast session revoked event to lock UI immediately
        window.dispatchEvent(new CustomEvent('sessionRevoked', {
          detail: { message: 'Session revoked from another device' }
        }));
        
        // Clear auth data immediately (before showing dialog)
        const currentUsername = apiClient._currentUsername;
        if (currentUsername) {
          localStorage.removeItem(`ves_token_${currentUsername}`);
          localStorage.removeItem(`ves_refresh_token_${currentUsername}`);
          localStorage.removeItem(`ves_user_${currentUsername}`);
          localStorage.removeItem(`ves_token_expiry_${currentUsername}`);
          localStorage.removeItem(`ves_session_id_${currentUsername}`);
        }
        apiClient._currentUsername = null;
        
        // Show dialog and redirect (non-blocking to prevent multiple dialogs)
        setTimeout(() => {
          window.confirm(
            '🔒 Session Revoked\n\n' +
            'You have been logged in from another device.\n' +
            'Your session here has been terminated.\n\n' +
            'Click OK to return to the login page.'
          );
          // Redirect immediately after dialog
          window.location.href = '/login';
        }, 100);
        
        // Return never-resolving promise to prevent further execution
        return new Promise(() => {});
      }
      
      switch (status) {
        case 401:
          // Unauthorized - token expired or invalid
          // Skip token refresh if session is being revoked
          if (localStorage.getItem('_session_revoking')) {
            return Promise.reject(error);
          }
          // Try to refresh token before giving up
          return handleUnauthorized(error.config);
        case 403:
          // Forbidden - insufficient permissions
          toast.error('You don\'t have permission to perform this action');
          break;
        case 404:
          // Not found
          toast.error('Requested resource not found');
          break;
        case 422:
          // Validation error
          const validationMessage = data?.error || 'Validation failed';
          toast.error(validationMessage);
          break;
        case 429:
          // Rate limit exceeded
          toast.error('Too many requests. Please try again later.');
          break;
        case 500:
          // Server error
          toast.error('Server error. Please try again or contact support.');
          break;
        default:
          // Generic error
          const errorMessage = data?.error || data?.message || 'An unexpected error occurred';
          toast.error(errorMessage);
      }
    } else if (error.request) {
      // Network error - no response received
      toast.error('Network error. Please check your connection and try again.');
    } else {
      // Other error
      toast.error('An unexpected error occurred');
    }

    return Promise.reject(error);
  }
);

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Handle unauthorized responses - try refresh token first
const handleUnauthorized = async (originalRequest) => {
  // If session is being revoked, don't try to refresh
  if (localStorage.getItem('_session_revoking')) {
    return Promise.reject(new Error('Session revoked'));
  }
  
  // Get current user's refresh token
  const currentUsername = apiClient._currentUsername;
  let refreshToken;
  
  if (currentUsername) {
    const refreshKey = getUserStorageKey(currentUsername, 'refresh_token');
    refreshToken = localStorage.getItem(refreshKey);
  } else {
    // Fallback to old key
    refreshToken = localStorage.getItem('ves_refresh_token');
  }
  
  // If no refresh token or already tried refreshing, redirect to login
  if (!refreshToken || originalRequest?._retry) {
    // Don't show multiple dialogs if session is being revoked
    if (!localStorage.getItem('_session_revoking')) {
      clearAuthAndRedirect();
    }
    return Promise.reject(new Error('Session expired'));
  }

  if (isRefreshing) {
    // Queue the request while refresh is in progress
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    }).then(token => {
      originalRequest.headers.Authorization = `Bearer ${token}`;
      return apiClient(originalRequest);
    });
  }

  originalRequest._retry = true;
  isRefreshing = true;

  try {
    // Attempt to refresh the token
    const response = await axios.post(
      `${apiClient.defaults.baseURL}/api/token/refresh`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${refreshToken}`
        }
      }
    );

    const { token: newToken } = response.data;
    
    // Store new token with user-specific key
    const currentUsername = apiClient._currentUsername;
    if (currentUsername) {
      const tokenKey = getUserStorageKey(currentUsername, 'token');
      localStorage.setItem(tokenKey, newToken);
    } else {
      // Fallback
      localStorage.setItem('ves_token', newToken);
    }
    
    // Update authorization header
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    originalRequest.headers.Authorization = `Bearer ${newToken}`;
    
    processQueue(null, newToken);
    
    toast.success('Session refreshed');
    
    // Retry the original request
    return apiClient(originalRequest);
    
  } catch (refreshError) {
    processQueue(refreshError, null);
    // Don't show multiple dialogs if session is being revoked
    if (!localStorage.getItem('_session_revoking')) {
      clearAuthAndRedirect();
    }
    return Promise.reject(refreshError);
  } finally {
    isRefreshing = false;
  }
};

// Clear auth data and redirect to login
const clearAuthAndRedirect = (message = 'Your session has expired. Please log in again.') => {
  // Don't clear _session_revoking lock here - it prevents multiple popups
  // Only clear it on successful login (in AuthContext)
  
  // Get current user from apiClient instance (not shared localStorage!)
  const currentUsername = apiClient._currentUsername;
  
  if (currentUsername) {
    // Clear user-specific storage
    localStorage.removeItem(getUserStorageKey(currentUsername, 'token'));
    localStorage.removeItem(getUserStorageKey(currentUsername, 'refresh_token'));
    localStorage.removeItem(getUserStorageKey(currentUsername, 'user'));
    localStorage.removeItem(getUserStorageKey(currentUsername, 'token_expiry'));
    localStorage.removeItem(getUserStorageKey(currentUsername, 'session_id'));
  }
  
  // Clear current username from apiClient instance
  apiClient._currentUsername = null;
  
  // Clear current user marker from localStorage (backward compatibility)
  localStorage.removeItem('ves_current_user');
  
  // Clear old keys for backward compatibility
  localStorage.removeItem('ves_token');
  localStorage.removeItem('ves_refresh_token');
  localStorage.removeItem('ves_user');
  localStorage.removeItem('ves_token_expiry');
  
  // Remove auth header
  delete apiClient.defaults.headers.common['Authorization'];
  
  // Show error message only if not a session revoked scenario (dialog already shown)
  if (!message.includes('revoked') && !message.includes('another device')) {
    toast.error(message);
  }
  
  // Redirect to login immediately for revoked sessions, with delay for others
  const delay = message.includes('revoked') || message.includes('another device') ? 500 : 1500;
  setTimeout(() => {
    window.location.href = '/login';
  }, delay);
};

// API endpoints configuration
export const endpoints = {
  // Authentication
  auth: {
    login: '/api/login',
    logout: '/api/logout',
    refresh: '/api/token/refresh',
    validate: '/api/auth/validate',
  },
  
  // Employee endpoints
  employee: {
    attendance: '/api/attendance/personal',
    leaves: '/api/leaves',
    payroll: '/api/payroll/current',
    documents: '/api/documents',
    customRequests: '/api/custom-requests',
  },
  
  // HR endpoints
  hr: {
    attendance: '/api/attendance/company',
    employees: '/api/employees',
    leaveApprovals: '/api/leaves',
    holidays: '/api/holidays',
    reports: '/api/reports',
  },
  
  // Admin endpoints
  admin: {
    users: '/api/users',
    auditLogs: '/api/audit-logs',
    settings: '/api/settings',
    backup: '/api/backup',
  },
  
  // Common endpoints
  common: {
    punch: '/api/punch',
    upload: '/api/upload',
    notifications: '/api/notifications',
  }
};

// Helper functions for common API patterns
export const apiHelpers = {
  // GET request with query parameters
  get: async (url, params = {}) => {
    const response = await apiClient.get(url, { params });
    return response.data;
  },

  // POST request with JSON data
  post: async (url, data = {}) => {
    const response = await apiClient.post(url, data);
    return response.data;
  },

  // PUT request for updates
  put: async (url, data = {}) => {
    const response = await apiClient.put(url, data);
    return response.data;
  },

  // DELETE request
  delete: async (url) => {
    const response = await apiClient.delete(url);
    return response.data;
  },

  // File upload with FormData
  upload: async (url, formData, onProgress = null) => {
    const config = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    };

    if (onProgress) {
      config.onUploadProgress = (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      };
    }

    const response = await apiClient.post(url, formData, config);
    return response.data;
  },

  // Download file
  download: async (url, filename) => {
    const response = await apiClient.get(url, {
      responseType: 'blob',
    });

    // Create download link
    const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },
};

export default apiClient;

/*
TODO: Enhanced Features
- Implement request caching for static data
- Add retry mechanism for failed requests
- Implement request deduplication
- Add request/response compression
- Implement optimistic updates for better UX
- Add mock API responses for offline development
- Implement API versioning support
- Add request queue for offline scenarios
- Implement background sync for critical operations
- Add API analytics and monitoring
*/