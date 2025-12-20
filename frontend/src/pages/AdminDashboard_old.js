import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [allUsers, setAllUsers] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalEmployees: 0,
    hrUsers: 0,
    adminUsers: 0,
    systemHealth: 'Healthy'
  });

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      // Comprehensive admin data including HR oversight
      const mockUsers = [
        { id: 1, name: 'System Administrator', username: 'admin', role: 'Admin', department: 'IT', status: 'Active', lastLogin: '2 minutes ago' },
        { id: 2, name: 'HR Manager', username: 'hr_manager', role: 'HR', department: 'Human Resources', status: 'Active', lastLogin: '15 minutes ago' },
        { id: 3, name: 'Ajith.B', username: 'ajith.b', role: 'Employee', department: 'Engineering', status: 'Active', lastLogin: '1 hour ago' },
        { id: 4, name: 'Ajith.S', username: 'ajith.s', role: 'Employee', department: 'Engineering', status: 'Active', lastLogin: '1 day ago' },
        { id: 5, name: 'Akhil.S', username: 'akhil.s', role: 'Employee', department: 'Engineering', status: 'Active', lastLogin: '3 hours ago' },
      ];

      const mockLogs = [
        { timestamp: '2025-10-27 23:30:00', action: 'User Login', user: 'admin', details: 'Admin login successful', level: 'info' },
        { timestamp: '2025-10-27 22:15:00', action: 'Employee Access', user: 'ajith.b', details: 'Dashboard accessed', level: 'info' },
        { timestamp: '2025-10-27 21:45:00', action: 'HR Action', user: 'hr_manager', details: 'Employee record updated', level: 'warning' },
        { timestamp: '2025-10-27 20:30:00', action: 'System Backup', user: 'system', details: 'Database backup completed', level: 'success' },
      ];

      setAllUsers(mockUsers);
      setSystemLogs(mockLogs);
      setStats({
        totalUsers: mockUsers.length,
        activeUsers: mockUsers.filter(u => u.status === 'Active').length,
        totalEmployees: mockUsers.filter(u => u.role === 'Employee').length,
        hrUsers: mockUsers.filter(u => u.role === 'HR').length,
        adminUsers: mockUsers.filter(u => u.role === 'Admin').length,
        systemHealth: 'Healthy'
      });
      setLoading(false);
    } catch (error) {
      console.error('Error loading admin data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-gradient-to-r from-gray-600 to-blue-600 rounded-full flex items-center justify-center mr-3">
                <i className="fas fa-cog text-white text-sm"></i>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">VES HRMS - Admin</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-600">{user?.role}</p>
              </div>
              <button
                onClick={logout}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <i className="fas fa-sign-out-alt mr-1"></i>
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: 'fas fa-tachometer-alt' },
              { id: 'users', name: 'All Users', icon: 'fas fa-users-cog' },
              { id: 'hr-oversight', name: 'HR Oversight', icon: 'fas fa-user-tie' },
              { id: 'system-logs', name: 'System Logs', icon: 'fas fa-list-alt' },
              { id: 'settings', name: 'Settings', icon: 'fas fa-cogs' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-gray-500 text-gray-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <i className={`${tab.icon} mr-2`}></i>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-gray-600 to-blue-600 rounded-lg p-6 mb-8 text-white">
          <h2 className="text-3xl font-bold mb-2">Admin Control Panel 🛠️</h2>
          <p className="text-gray-100">System administration and user management</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Total Users */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                <p className="text-sm text-blue-600">All accounts</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-users text-blue-600 text-xl"></i>
              </div>
            </div>
          </div>

          {/* Active Users */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeUsers}</p>
                <p className="text-sm text-green-600">Online/Active</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-user-check text-green-600 text-xl"></i>
              </div>
            </div>
          </div>

          {/* Employees */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Employees</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalEmployees}</p>
                <p className="text-sm text-purple-600">Staff members</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-id-card text-purple-600 text-xl"></i>
              </div>
            </div>
          </div>

          {/* System Status */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Status</p>
                <p className="text-2xl font-bold text-gray-900">Healthy</p>
                <p className="text-sm text-green-600">All systems OK</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-heartbeat text-green-600 text-xl"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Logins */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Recent User Activity</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {stats.recentLogins.map((login, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="h-3 w-3 rounded-full bg-green-400"></div>
                      <div>
                        <span className="font-medium text-gray-900">{login.user}</span>
                        <p className="text-sm text-gray-600">{login.role}</p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">{login.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Admin Actions */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Admin Actions</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <button className="bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg p-4 text-center transition-colors">
                  <i className="fas fa-user-plus text-blue-600 text-2xl mb-2"></i>
                  <p className="text-sm font-medium text-gray-900">Add User</p>
                </button>
                <button className="bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg p-4 text-center transition-colors">
                  <i className="fas fa-database text-green-600 text-2xl mb-2"></i>
                  <p className="text-sm font-medium text-gray-900">Backup DB</p>
                </button>
                <button className="bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 rounded-lg p-4 text-center transition-colors">
                  <i className="fas fa-chart-bar text-yellow-600 text-2xl mb-2"></i>
                  <p className="text-sm font-medium text-gray-900">Reports</p>
                </button>
                <button className="bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg p-4 text-center transition-colors">
                  <i className="fas fa-cogs text-purple-600 text-2xl mb-2"></i>
                  <p className="text-sm font-medium text-gray-900">Settings</p>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* System Information */}
        <div className="mt-8 bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">System Information</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <i className="fas fa-database text-gray-600 text-3xl mb-2"></i>
                <h4 className="font-medium text-gray-900">Database</h4>
                <p className="text-sm text-gray-600">SQLite - Connected</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <i className="fas fa-server text-gray-600 text-3xl mb-2"></i>
                <h4 className="font-medium text-gray-900">Backend</h4>
                <p className="text-sm text-gray-600">Flask - Running</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <i className="fas fa-shield-alt text-gray-600 text-3xl mb-2"></i>
                <h4 className="font-medium text-gray-900">Security</h4>
                <p className="text-sm text-gray-600">JWT - Active</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;