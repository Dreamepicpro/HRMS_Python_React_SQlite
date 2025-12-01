// VES HRMS - Protected Route Component
// Bulletproof role-based access control with graceful fallbacks

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../UI/LoadingSpinner';
import UnauthorizedPage from '../UI/UnauthorizedPage';

const ProtectedRoute = ({ 
  children, 
  allowedRoles = null, 
  requiredPermission = null,
  fallbackPath = '/login',
  showUnauthorized = false 
}) => {
  const { user, loading, isAuthenticated, hasRole, hasPermission } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600 font-medium">
            Verifying access permissions...
          </p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Navigate 
        to={fallbackPath} 
        state={{ from: location }} 
        replace 
      />
    );
  }

  // Check role-based permissions
  if (allowedRoles && !hasRole(allowedRoles)) {
    if (showUnauthorized) {
      return (
        <UnauthorizedPage 
          requiredRoles={allowedRoles}
          currentRole={user.role}
          message="You don't have the required role to access this page."
        />
      );
    }

    // Redirect to appropriate dashboard based on user role
    const dashboardPath = getDashboardPathForRole(user.role);
    return <Navigate to={dashboardPath} replace />;
  }

  // Check specific permission if required
  if (requiredPermission && !hasPermission(requiredPermission)) {
    if (showUnauthorized) {
      return (
        <UnauthorizedPage 
          requiredPermission={requiredPermission}
          currentRole={user.role}
          message="You don't have the required permission to access this feature."
        />
      );
    }

    // Redirect to dashboard
    const dashboardPath = getDashboardPathForRole(user.role);
    return <Navigate to={dashboardPath} replace />;
  }

  // All checks passed - render the protected component
  return children;
};

// Helper function to get dashboard path based on user role
const getDashboardPathForRole = (role) => {
  const roleDashboardMap = {
    'Employee': '/dash/employee',
    'HR': '/dash/hr',
    'Admin': '/dash/admin',
    'MD': '/dash/md'
  };

  return roleDashboardMap[role] || '/dash/employee';
};

// HOC for protecting components with specific roles
export const withRoleProtection = (WrappedComponent, allowedRoles) => {
  return function ProtectedComponent(props) {
    return (
      <ProtectedRoute allowedRoles={allowedRoles} showUnauthorized={true}>
        <WrappedComponent {...props} />
      </ProtectedRoute>
    );
  };
};

// HOC for protecting components with specific permissions
export const withPermissionProtection = (WrappedComponent, requiredPermission) => {
  return function ProtectedComponent(props) {
    return (
      <ProtectedRoute requiredPermission={requiredPermission} showUnauthorized={true}>
        <WrappedComponent {...props} />
      </ProtectedRoute>
    );
  };
};

// Hook for conditional rendering based on roles
export const useRoleAccess = () => {
  const { user, hasRole, hasPermission } = useAuth();

  return {
    // Role checks
    isEmployee: hasRole(['Employee']),
    isHR: hasRole(['HR']),
    isAdmin: hasRole(['Admin']),
    isMD: hasRole(['MD']),
    
    // Combined role checks
    isHROrAbove: hasRole(['HR', 'Admin', 'MD']),
    isAdminOrAbove: hasRole(['Admin', 'MD']),
    
    // Permission checks
    canViewAllAttendance: hasPermission('view_all_attendance'),
    canApproveLeaves: hasPermission('approve_leave_requests'),
    canManageUsers: hasPermission('manage_users'),
    canViewAuditLogs: hasPermission('view_audit_logs'),
    canManagePayroll: hasPermission('manage_payroll'),
    
    // Utility functions
    hasRole,
    hasPermission,
    user,
    
    // UI helpers
    getRoleColor: () => {
      const roleColors = {
        'Employee': 'ves-purple',
        'HR': 'ves-blue',
        'Admin': 'gray',
        'MD': 'gray'
      };
      return roleColors[user?.role] || 'gray';
    },
    
    getRoleBadgeClass: () => {
      const roleBadges = {
        'Employee': 'bg-ves-purple-100 text-ves-purple-800 border-ves-purple-200',
        'HR': 'bg-ves-blue-100 text-ves-blue-800 border-ves-blue-200',
        'Admin': 'bg-gray-100 text-gray-800 border-gray-200',
        'MD': 'bg-gradient-to-r from-purple-100 to-blue-100 text-gray-800 border-purple-200'
      };
      return roleBadges[user?.role] || 'bg-gray-100 text-gray-800';
    }
  };
};

// Component for conditional rendering based on permissions
export const PermissionGate = ({ 
  permission, 
  roles, 
  children, 
  fallback = null,
  showFallback = true 
}) => {
  const { hasRole, hasPermission } = useAuth();

  // Check role access
  if (roles && !hasRole(roles)) {
    return showFallback ? fallback : null;
  }

  // Check permission access
  if (permission && !hasPermission(permission)) {
    return showFallback ? fallback : null;
  }

  return children;
};

// Enhanced route protection with audit logging
export const AuditedRoute = ({ 
  children, 
  allowedRoles, 
  auditAction,
  ...props 
}) => {
  const { user } = useAuth();
  const location = useLocation();

  React.useEffect(() => {
    if (user && auditAction) {
      // Log route access for audit purposes
      console.log(`Audit: ${user.emp_id} accessed ${auditAction} at ${location.pathname}`);
      
      // TODO: Send to audit service
      // auditService.log({
      //   user_id: user.emp_id,
      //   action: auditAction,
      //   resource: location.pathname,
      //   timestamp: new Date().toISOString()
      // });
    }
  }, [user, auditAction, location.pathname]);

  return (
    <ProtectedRoute allowedRoles={allowedRoles} {...props}>
      {children}
    </ProtectedRoute>
  );
};

export default ProtectedRoute;

/*
TODO: Advanced Security Features
- Implement session timeout warnings
- Add multi-factor authentication checks
- Implement IP-based access restrictions
- Add device fingerprinting for security
- Implement concurrent session limits
- Add geolocation-based access controls
- Implement role escalation workflows
- Add temporary permission grants
- Implement emergency access procedures
- Add compliance reporting for access logs
*/