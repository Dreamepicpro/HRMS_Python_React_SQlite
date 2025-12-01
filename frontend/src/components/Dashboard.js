import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import EmployeeDashboard from '../pages/EmployeeDashboard';
import AdminDashboard from '../pages/AdminDashboard';
import HRDashboard from '../pages/HRDashboard';

const Dashboard = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Route to appropriate dashboard based on role
  switch (user.role) {
    case 'Employee':
      return <EmployeeDashboard />;
    case 'HR':
      return <HRDashboard />;
    case 'Admin':
      return <AdminDashboard />;
    case 'MD':
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <i className="fas fa-crown text-yellow-500 text-6xl mb-4"></i>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Managing Director Dashboard</h1>
              <p className="text-gray-600">Welcome {user.name}! Executive Dashboard coming soon...</p>
            </div>
          </div>
        </div>
      );
    default:
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
            <p className="text-gray-600">Invalid role or permissions</p>
          </div>
        </div>
      );
  }
};

export default Dashboard;