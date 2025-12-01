// VES HRMS Authentication Context
// Bulletproof JWT auth with role-based access control

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../utils/apiClient';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize auth state from localStorage on app load
  useEffect(() => {
    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeAuth = async () => {
    try {
      // Clear any existing session data on app launch
      localStorage.removeItem('ves_token');
      localStorage.removeItem('ves_user');
      
      // Reset API client auth header
      delete apiClient.defaults.headers.common['Authorization'];
      
      // Start fresh - no auto-login
      setUser(null);
      setIsAuthenticated(false);
      
    } catch (error) {
      console.error('Auth initialization error:', error);
      await logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      setLoading(true);
      
      const response = await apiClient.post('/api/login', {
        username: credentials.empId.trim(),
        password: credentials.password,
        force_login: credentials.force_login || false
      });

      const { token, refresh_token, expires_in, user: userData } = response.data;

      // Store in localStorage
      localStorage.setItem('ves_token', token);
      if (refresh_token) {
        localStorage.setItem('ves_refresh_token', refresh_token);
      }
      // Store token expiry time for proactive refresh
      if (expires_in) {
        const expiryTime = Date.now() + (expires_in * 1000);
        localStorage.setItem('ves_token_expiry', expiryTime.toString());
      }
      localStorage.setItem('ves_user', JSON.stringify(userData));

      // Set API client auth header
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Update state
      setUser(userData);
      setIsAuthenticated(true);

      // Success feedback
      toast.success(`Welcome back, ${userData.name}! 🎉`);

      // Trigger role-based tour after login
      setTimeout(() => {
        triggerRoleTour(userData.role);
      }, 1000);

      return { success: true, user: userData };

    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Login failed. Please try again.';
      const alreadyLoggedIn = error.response?.data?.already_logged_in || false;
      
      if (alreadyLoggedIn) {
        // Don't show error toast for this case - let Login component handle it
        return { 
          success: false, 
          already_logged_in: true,
          error: errorMessage 
        };
      }
      
      toast.error(errorMessage);
      
      return { 
        success: false, 
        error: errorMessage 
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Call logout endpoint to blacklist token
      if (isAuthenticated) {
        await apiClient.post('/api/logout');
      }
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with logout even if API call fails
    } finally {
      // Clear local storage
      localStorage.removeItem('ves_token');
      localStorage.removeItem('ves_refresh_token');
      localStorage.removeItem('ves_token_expiry');
      localStorage.removeItem('ves_user');

      // Clear API client auth header
      delete apiClient.defaults.headers.common['Authorization'];

      // Reset state
      setUser(null);
      setIsAuthenticated(false);

      toast.success('Logged out successfully');
    }
  };

  const triggerRoleTour = (role) => {
    // Store tour trigger flag for Joyride component
    const tourKey = `ves_tour_${role.toLowerCase()}_completed`;
    const tourCompleted = localStorage.getItem(tourKey);
    
    if (!tourCompleted) {
      // Dispatch custom event for tour component to listen
      window.dispatchEvent(new CustomEvent('startRoleTour', { 
        detail: { role } 
      }));
    }
  };

  const hasRole = (requiredRoles) => {
    if (!user || !requiredRoles) return false;
    
    // Convert single role to array
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    return roles.includes(user.role);
  };

  const hasPermission = (permission) => {
    if (!user) return false;

    // Define role-based permissions
    const rolePermissions = {
      'Employee': [
        'view_own_attendance',
        'submit_leave_request',
        'upload_documents',
        'view_own_payroll',
        'submit_custom_request'
      ],
      'HR': [
        'view_all_attendance',
        'approve_leave_requests',
        'view_all_employees',
        'manage_holidays',
        'view_reports',
        'approve_documents'
      ],
      'Admin': [
        'manage_users',
        'view_audit_logs',
        'system_settings',
        'manage_payroll',
        'data_export',
        'user_management'
      ],
      'MD': [
        'all_permissions' // MD has access to everything
      ]
    };

    const userPermissions = rolePermissions[user.role] || [];
    
    // MD has all permissions
    if (user.role === 'MD' || userPermissions.includes('all_permissions')) {
      return true;
    }

    return userPermissions.includes(permission);
  };

  const updateUserProfile = (updatedData) => {
    const updatedUser = { ...user, ...updatedData };
    setUser(updatedUser);
    localStorage.setItem('ves_user', JSON.stringify(updatedUser));
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    hasRole,
    hasPermission,
    updateUserProfile,
    
    // Computed properties
    isEmployee: user?.role === 'Employee',
    isHR: user?.role === 'HR',
    isAdmin: user?.role === 'Admin',
    isMD: user?.role === 'MD',
    
    // Helper for checking multiple roles
    isHROrAbove: user && ['HR', 'Admin', 'MD'].includes(user.role),
    isAdminOrAbove: user && ['Admin', 'MD'].includes(user.role),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;

/*
TODO: Security Enhancements
- Implement token refresh mechanism
- Add session timeout warnings
- Implement 2FA support
- Add device fingerprinting
- Implement rate limiting on failed attempts
- Add password strength validation
- Implement account lockout after failed attempts
- Add login attempt monitoring and alerts
- Implement secure logout on browser close
- Add remember me functionality with separate token
*/