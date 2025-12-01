// VES HRMS - Unauthorized Access Component
// Professional unauthorized access handling with helpful guidance

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const UnauthorizedPage = ({ 
  requiredRoles = [], 
  requiredPermission = null,
  currentRole = null,
  message = null,
  showActions = true 
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const defaultMessage = requiredPermission 
    ? `You need the '${requiredPermission}' permission to access this feature.`
    : `Access restricted to: ${Array.isArray(requiredRoles) ? requiredRoles.join(', ') : requiredRoles}`;

  const displayMessage = message || defaultMessage;

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoToDashboard = () => {
    const dashboardPath = getDashboardForRole(currentRole || user?.role);
    navigate(dashboardPath);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
      <div className="max-w-md w-full mx-auto px-6">
        <div className="bg-white rounded-2xl shadow-xl border border-red-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <svg 
                className="w-8 h-8 text-white" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Access Restricted
            </h1>
            <p className="text-red-100">
              VES HRMS - Security Control
            </p>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="text-center mb-6">
              <p className="text-gray-700 leading-relaxed">
                {displayMessage}
              </p>
            </div>

            {/* User Info */}
            {user && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  Current Access Level
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      ID: {user.emp_id}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                      {user.role}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Required Access Info */}
            {(requiredRoles.length > 0 || requiredPermission) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-blue-900 mb-2">
                  Required Access
                </h3>
                {requiredRoles.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-blue-700 mb-1">Roles:</p>
                    <div className="flex flex-wrap gap-1">
                      {requiredRoles.map((role, index) => (
                        <span 
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {requiredPermission && (
                  <div>
                    <p className="text-xs text-blue-700 mb-1">Permission:</p>
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {requiredPermission}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            {showActions && (
              <div className="space-y-3">
                <button
                  onClick={handleGoToDashboard}
                  className="w-full btn-primary"
                >
                  Go to My Dashboard
                </button>
                
                <div className="flex space-x-3">
                  <button
                    onClick={handleGoBack}
                    className="flex-1 btn-outline"
                  >
                    Go Back
                  </button>
                  
                  <button
                    onClick={handleLogout}
                    className="flex-1 btn-ghost text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}

            {/* Help Text */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                Need different access? Contact your HR administrator or system admin.
              </p>
              <div className="mt-2 text-center">
                <a 
                  href="mailto:hr@ves.com" 
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  hr@ves.com
                </a>
                <span className="text-xs text-gray-400 mx-2">•</span>
                <a 
                  href="mailto:admin@ves.com" 
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  admin@ves.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to get role badge classes
const getRoleBadgeClass = (role) => {
  const roleBadges = {
    'Employee': 'bg-purple-100 text-purple-800 border border-purple-200',
    'HR': 'bg-blue-100 text-blue-800 border border-blue-200',
    'Admin': 'bg-gray-100 text-gray-800 border border-gray-200',
    'MD': 'bg-gradient-to-r from-purple-100 to-blue-100 text-gray-800 border border-purple-200'
  };
  return roleBadges[role] || 'bg-gray-100 text-gray-800 border border-gray-200';
};

// Helper function to get dashboard path for role
const getDashboardForRole = (role) => {
  const dashboardMap = {
    'Employee': '/dash/employee',
    'HR': '/dash/hr',
    'Admin': '/dash/admin',
    'MD': '/dash/md'
  };
  return dashboardMap[role] || '/dash/employee';
};

// Compact unauthorized component for inline use
export const UnauthorizedInline = ({ 
  message = 'Access denied',
  showContact = false 
}) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <div className="flex items-center">
      <div className="flex-shrink-0">
        <svg 
          className="h-5 w-5 text-red-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" 
          />
        </svg>
      </div>
      <div className="ml-3">
        <h3 className="text-sm font-medium text-red-800">
          {message}
        </h3>
        {showContact && (
          <p className="mt-1 text-xs text-red-700">
            Contact HR for access: 
            <a href="mailto:hr@ves.com" className="underline ml-1">
              hr@ves.com
            </a>
          </p>
        )}
      </div>
    </div>
  </div>
);

// Permission denied modal component
export const PermissionDeniedModal = ({ 
  isOpen, 
  onClose, 
  requiredPermission,
  message 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full sm:p-6">
          <div>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg 
                className="h-6 w-6 text-red-600" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" 
                />
              </svg>
            </div>
            <div className="mt-3 text-center sm:mt-5">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Permission Denied
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  {message || `You need '${requiredPermission}' permission to perform this action.`}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-5 sm:mt-6">
            <button
              type="button"
              className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:text-sm"
              onClick={onClose}
            >
              Understood
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;

/*
TODO: Enhanced Security Features
- Add audit logging for unauthorized access attempts
- Implement progressive access requests
- Add temporary access elevation workflows
- Create access request forms
- Implement approval chains for access requests
- Add notification system for access denials
- Create detailed access logs for compliance
- Implement role-based help and guidance
- Add integration with identity providers
- Create access analytics and reporting
*/