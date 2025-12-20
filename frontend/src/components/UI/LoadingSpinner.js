// VES HRMS - Loading Spinner Component
// Elegant loading states with VES branding

import React from 'react';

const LoadingSpinner = ({ 
  size = 'medium', 
  color = 'purple', 
  message = null,
  showLogo = false,
  className = '' 
}) => {
  // Size configurations
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  // Color configurations based on VES brand
  const colorClasses = {
    purple: 'text-ves-purple-500',
    blue: 'text-ves-blue-500',
    gray: 'text-gray-500',
    white: 'text-white'
  };

  const spinnerClass = `${sizeClasses[size]} ${colorClasses[color]} ${className}`;

  return (
    <div className="flex flex-col items-center justify-center">
      {showLogo && (
        <div className="mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-ves-purple-500 to-ves-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">VES</span>
          </div>
        </div>
      )}
      
      <div className="relative">
        {/* Main spinner */}
        <svg
          className={`${spinnerClass} animate-spin`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        
        {/* Pulse effect for large spinner */}
        {size === 'large' && (
          <div className={`absolute inset-0 ${spinnerClass} animate-ping opacity-20`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
            </svg>
          </div>
        )}
      </div>

      {message && (
        <p className={`mt-3 text-sm font-medium ${colorClasses[color]} animate-pulse`}>
          {message}
        </p>
      )}
    </div>
  );
};

// Specialized loading components for different contexts
export const PageLoading = ({ message = 'Loading...' }) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
    <LoadingSpinner 
      size="large" 
      color="purple" 
      message={message}
      showLogo={true}
    />
  </div>
);

export const ButtonLoading = ({ className = '' }) => (
  <LoadingSpinner 
    size="small" 
    color="white" 
    className={className}
  />
);

export const CardLoading = ({ message = 'Loading data...' }) => (
  <div className="flex items-center justify-center p-8">
    <LoadingSpinner 
      size="medium" 
      color="gray" 
      message={message}
    />
  </div>
);

export const TableLoading = ({ rows = 5 }) => (
  <div className="animate-pulse">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="border-b border-gray-200">
        <div className="p-4 flex space-x-4">
          <div className="rounded-full bg-gray-200 h-10 w-10"></div>
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

// Skeleton loading for cards
export const CardSkeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
    <div className="flex items-center space-x-4">
      <div className="rounded-full bg-gray-200 h-12 w-12"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
    </div>
    <div className="mt-4 space-y-3">
      <div className="h-4 bg-gray-200 rounded"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
    </div>
  </div>
);

// Chart loading skeleton
export const ChartSkeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
    <div className="h-4 bg-gray-200 rounded w-1/3 mb-6"></div>
    <div className="h-64 bg-gray-100 rounded-lg flex items-end justify-between p-4">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="bg-gray-200 rounded-t"
          style={{
            height: `${Math.random() * 80 + 20}%`,
            width: '12%'
          }}
        ></div>
      ))}
    </div>
  </div>
);

// Inline loading for buttons and form elements
export const InlineLoading = ({ text = 'Processing...' }) => (
  <div className="flex items-center space-x-2">
    <LoadingSpinner size="small" color="gray" />
    <span className="text-sm text-gray-600">{text}</span>
  </div>
);

// Full page loading overlay
export const LoadingOverlay = ({ 
  message = 'Loading...', 
  transparent = false 
}) => (
  <div className={`fixed inset-0 z-50 flex items-center justify-center ${
    transparent ? 'bg-black bg-opacity-30' : 'bg-white'
  }`}>
    <div className="text-center">
      <LoadingSpinner 
        size="large" 
        color="purple" 
        message={message}
        showLogo={true}
      />
    </div>
  </div>
);

export default LoadingSpinner;

/*
TODO: Advanced Loading Features
- Add progress bars for file uploads
- Implement shimmer effects for better UX
- Add custom loading animations
- Implement lazy loading indicators
- Add timeout handling for long operations
- Create role-specific loading themes
- Add accessibility improvements (ARIA labels)
- Implement loading state management
- Add performance monitoring for loading times
- Create loading analytics
*/