// VES HRMS - React Entry Point
// Production-ready app initialization with error boundaries

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

// Error boundary component for graceful error handling
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state to show fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('VES HRMS Error Boundary:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // TODO: Send error to monitoring service in production
    // Example: Sentry.captureException(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full mx-auto text-center p-6">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              
              <h1 className="text-xl font-bold text-gray-900 mb-2">
                Something went wrong
              </h1>
              
              <p className="text-gray-600 mb-6">
                We're sorry for the inconvenience. The VES HRMS system encountered an unexpected error.
              </p>
              
              <button 
                onClick={() => window.location.reload()}
                className="btn-primary w-full"
              >
                Reload Application
              </button>
              
              <div className="mt-4 text-sm text-gray-500">
                <p>If the problem persists, please contact IT support.</p>
                <p className="mt-1">Error ID: {Date.now()}</p>
              </div>
              
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700">
                    Error Details (Development)
                  </summary>
                  <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto">
                    {this.state.error && this.state.error.toString()}
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Service Worker registration for PWA features (TODO)
const registerServiceWorker = () => {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }
};

// Performance monitoring setup
const setupPerformanceMonitoring = () => {
  // Monitor Core Web Vitals
  if ('web-vital' in window) {
    // TODO: Implement performance monitoring
    // getCLS(console.log);
    // getFID(console.log);
    // getFCP(console.log);
    // getLCP(console.log);
    // getTTFB(console.log);
  }
};

// Development helpers
const setupDevTools = () => {
  if (process.env.NODE_ENV === 'development') {
    // Add global helpers for debugging
    window.VES_DEBUG = {
      clearStorage: () => {
        localStorage.clear();
        sessionStorage.clear();
        console.log('🧹 Storage cleared');
      },
      getAuthToken: () => {
        const token = localStorage.getItem('ves_token');
        console.log('🔑 Auth token:', token);
        return token;
      },
      getUser: () => {
        const user = localStorage.getItem('ves_user');
        console.log('👤 Current user:', JSON.parse(user || '{}'));
        return user ? JSON.parse(user) : null;
      }
    };

    console.log('🔧 VES HRMS Development Mode');
    console.log('🛠️ Debug helpers available at window.VES_DEBUG');
  }
};

// Initialize React application
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Initialize additional features
setupDevTools();
setupPerformanceMonitoring();
registerServiceWorker();

// Report web vitals for performance monitoring
const reportWebVitals = (onPerfEntry) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry);
      getFID(onPerfEntry);
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
    });
  }
};

// Enable performance reporting in production
if (process.env.NODE_ENV === 'production') {
  reportWebVitals((metric) => {
    // TODO: Send metrics to analytics service
    console.log('📊 Web Vital:', metric);
  });
}

/*
TODO: Production Enhancements
- Implement proper error tracking (Sentry, LogRocket)
- Add performance monitoring (Google Analytics, Custom metrics)
- Implement offline support with service worker
- Add app update notifications
- Implement proper logging service
- Add user session replay for debugging
- Implement A/B testing framework
- Add feature flag management
- Implement crash reporting
- Add user feedback widget
*/