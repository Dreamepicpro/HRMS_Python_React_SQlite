import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showForceLogin, setShowForceLogin] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const { user, login } = useAuth();

  // Redirect if already logged in
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e, forceLogin = false) => {
    e.preventDefault();
    setIsLoading(true);
    setShowForceLogin(false);

    try {
      const result = await login({
        empId: formData.username,
        password: formData.password,
        force_login: forceLogin
      });
      
      if (result.success) {
        toast.success('Login successful!');
        // Navigation will happen automatically via AuthContext
      } else if (result.already_logged_in) {
        // Show force login option
        setShowForceLogin(true);
        toast.warning('This account is already logged in on another device');
      }
    } catch (error) {
      if (error.already_logged_in) {
        setShowForceLogin(true);
        toast.warning('This account is already logged in on another device');
      } else {
        toast.error(error.message || 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceLogin = (e) => {
    handleSubmit(e, true);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setShowForceLogin(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    
    setForgotLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('If your email exists in our system, you will receive a password reset link shortly.');
        setShowForgotPassword(false);
        setForgotEmail('');
      } else {
        toast.error(data.error || 'Failed to process request');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-md w-full space-y-8 p-8">
        {/* Logo and Header */}
        <div className="text-center">
          <div className="mx-auto h-20 w-20 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center mb-4">
            <i className="fas fa-building text-white text-2xl"></i>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">VES HRMS</h2>
          <p className="mt-2 text-sm text-gray-600">
            Virrudheeswara Engineering Services
          </p>
          <p className="text-xs text-gray-500">HR Management System</p>
        </div>

        {/* Login Form */}
        <div className="bg-white p-8 rounded-xl shadow-lg">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <div className="mt-1 relative">
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Enter your username"
                />
                <i className="fas fa-user absolute right-3 top-3 text-gray-400"></i>
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Enter your password"
                />
                <i className="fas fa-lock absolute right-3 top-3 text-gray-400"></i>
              </div>
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-purple-600 hover:text-purple-800 hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </div>
            
            {/* Force Login Option - shown when already logged in elsewhere */}
            {showForceLogin && (
              <div className="bg-orange-50 border border-orange-300 rounded-lg p-4 mt-4">
                <div className="flex items-start">
                  <i className="fas fa-exclamation-triangle text-orange-500 mt-1 mr-3"></i>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-orange-800">Already Logged In</h4>
                    <p className="text-xs text-orange-700 mt-1">
                      This account is currently active on another device. 
                      Do you want to logout from the other device and login here?
                    </p>
                    <button
                      type="button"
                      onClick={handleForceLogin}
                      disabled={isLoading}
                      className="mt-3 w-full flex justify-center py-2 px-4 border border-orange-400 rounded-md shadow-sm text-sm font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 focus:outline-none disabled:opacity-50"
                    >
                      {isLoading ? (
                        <><i className="fas fa-spinner fa-spin mr-2"></i>Processing...</>
                      ) : (
                        <><i className="fas fa-sign-out-alt mr-2"></i>Logout Other Device & Login Here</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Demo Credentials */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-yellow-800 mb-2">Demo Credentials:</h3>
          <div className="text-xs text-yellow-700 space-y-1">
            <div><strong>Employee:</strong> worker1 / worker123</div>
            <div><strong>Staff:</strong> staff1 / staff123</div>
            <div><strong>HR 1:</strong> hr_manager / VEShr123!</div>
            <div><strong>HR 2:</strong> hr_staff1 / VEShr123!</div>
            <div><strong>HR 3:</strong> hr_staff2 / VEShr123!</div>
          </div>
          <p className="text-xs text-orange-600 mt-2">
            <i className="fas fa-info-circle mr-1"></i>
            HR accounts: Same credential cannot login on multiple computers!
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                <i className="fas fa-key text-purple-600 mr-2"></i>
                Forgot Password
              </h3>
              <button
                onClick={() => { setShowForgotPassword(false); setForgotEmail(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Enter your registered email address. If your account exists, 
              you'll receive a password reset link.
            </p>
            
            <form onSubmit={handleForgotPassword}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                    required
                  />
                  <i className="fas fa-envelope absolute right-3 top-3 text-gray-400"></i>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(false); setForgotEmail(''); }}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex-1 py-2 px-4 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                  {forgotLoading ? (
                    <><i className="fas fa-spinner fa-spin mr-2"></i>Sending...</>
                  ) : (
                    <><i className="fas fa-paper-plane mr-2"></i>Send Reset Link</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;