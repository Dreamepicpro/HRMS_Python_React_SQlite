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

// Request interceptor for adding auth token and logging
apiClient.interceptors.request.use(
  (config) => {
    // Add timestamp for request tracking
    config.metadata = { startTime: new Date() };
    
    // Log API calls in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔗 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }

    // Add auth token if available (skip for refresh endpoint)
    if (!config.url?.includes('/token/refresh')) {
      const token = localStorage.getItem('ves_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
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
      
      switch (status) {
        case 401:
          // Unauthorized - token expired or invalid
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
  const refreshToken = localStorage.getItem('ves_refresh_token');
  
  // If no refresh token or already tried refreshing, redirect to login
  if (!refreshToken || originalRequest?._retry) {
    clearAuthAndRedirect();
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
    
    // Store new token
    localStorage.setItem('ves_token', newToken);
    
    // Update authorization header
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    originalRequest.headers.Authorization = `Bearer ${newToken}`;
    
    processQueue(null, newToken);
    
    toast.success('Session refreshed');
    
    // Retry the original request
    return apiClient(originalRequest);
    
  } catch (refreshError) {
    processQueue(refreshError, null);
    clearAuthAndRedirect();
    return Promise.reject(refreshError);
  } finally {
    isRefreshing = false;
  }
};

// Clear auth data and redirect to login
const clearAuthAndRedirect = () => {
  // Clear stored auth data
  localStorage.removeItem('ves_token');
  localStorage.removeItem('ves_refresh_token');
  localStorage.removeItem('ves_user');
  localStorage.removeItem('ves_token_expiry');
  
  // Remove auth header
  delete apiClient.defaults.headers.common['Authorization'];
  
  // Show error message
  toast.error('Your session has expired. Please log in again.');
  
  // Redirect to login after a brief delay
  setTimeout(() => {
    window.location.href = '/login';
  }, 1500);
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