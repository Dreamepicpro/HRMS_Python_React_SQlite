import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      toast.error('Invalid reset link');
      navigate('/login');
    }
  }, [token, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_URL}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          new_password: formData.newPassword
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('Password reset successfully!');
        setResetComplete(true);
      } else {
        toast.error(data.error || 'Failed to reset password');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-md w-full space-y-8 p-8">
        {/* Logo and Header */}
        <div className="text-center">
          <div className="mx-auto h-20 w-20 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center mb-4">
            <i className="fas fa-key text-white text-2xl"></i>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Reset Password</h2>
          <p className="mt-2 text-sm text-gray-600">
            VES HRMS - Password Reset
          </p>
        </div>

        {/* Reset Form or Success Message */}
        <div className="bg-white p-8 rounded-xl shadow-lg">
          {resetComplete ? (
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <i className="fas fa-check text-green-600 text-2xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Password Reset Successful!
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Your password has been changed. You can now login with your new password.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full py-2 px-4 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                <i className="fas fa-sign-in-alt mr-2"></i>
                Go to Login
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                  New Password
                </label>
                <div className="mt-1 relative">
                  <input
                    id="newPassword"
                    name="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.newPassword}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Enter new password"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <div className="mt-1 relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Confirm new password"
                  />
                  <i className="fas fa-lock absolute right-3 top-3 text-gray-400"></i>
                </div>
              </div>

              {/* Password Match Indicator */}
              {formData.confirmPassword && (
                <div className={`flex items-center text-sm ${
                  formData.newPassword === formData.confirmPassword 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`}>
                  <i className={`fas ${
                    formData.newPassword === formData.confirmPassword 
                      ? 'fa-check-circle' 
                      : 'fa-times-circle'
                  } mr-2`}></i>
                  {formData.newPassword === formData.confirmPassword 
                    ? 'Passwords match' 
                    : 'Passwords do not match'}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={isLoading || formData.newPassword !== formData.confirmPassword}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Resetting...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save mr-2"></i>
                      Reset Password
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Back to Login Link */}
        {!resetComplete && (
          <div className="text-center">
            <Link
              to="/login"
              className="text-sm text-purple-600 hover:text-purple-800 hover:underline"
            >
              <i className="fas fa-arrow-left mr-1"></i>
              Back to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
