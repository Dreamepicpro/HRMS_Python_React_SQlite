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
        { id: 1, name: 'System Administrator', username: 'admin', role: 'Admin', department: 'IT', status: 'Active', lastLogin: '2 minutes ago', permissions: 'Full Access' },
        { id: 2, name: 'HR Manager', username: 'hr_manager', role: 'HR', department: 'Human Resources', status: 'Active', lastLogin: '15 minutes ago', permissions: 'HR Management' },
        { id: 3, name: 'Ajith.B', username: 'ajith.b', role: 'Employee', department: 'Engineering', status: 'Active', lastLogin: '1 hour ago', permissions: 'Employee Access' },
        { id: 4, name: 'Ajith.S', username: 'ajith.s', role: 'Employee', department: 'Engineering', status: 'Active', lastLogin: '1 day ago', permissions: 'Employee Access' },
        { id: 5, name: 'Akhil.S', username: 'akhil.s', role: 'Employee', department: 'Engineering', status: 'Active', lastLogin: '3 hours ago', permissions: 'Employee Access' },
        { id: 6, name: 'Baby', username: 'baby', role: 'Employee', department: 'Admin', status: 'Active', lastLogin: '2 hours ago', permissions: 'Employee Access' },
      ];

      const mockLogs = [
        { id: 1, timestamp: '2025-10-27 23:30:00', action: 'User Login', user: 'admin', details: 'Admin login successful', level: 'info' },
        { id: 2, timestamp: '2025-10-27 22:15:00', action: 'Employee Access', user: 'ajith.b', details: 'Dashboard accessed', level: 'info' },
        { id: 3, timestamp: '2025-10-27 21:45:00', action: 'HR Action', user: 'hr_manager', details: 'Employee record updated', level: 'warning' },
        { id: 4, timestamp: '2025-10-27 20:30:00', action: 'System Backup', user: 'system', details: 'Database backup completed', level: 'success' },
        { id: 5, timestamp: '2025-10-27 19:15:00', action: 'Permission Change', user: 'admin', details: 'User permissions modified', level: 'warning' },
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
                <i className="fas fa-crown text-white text-sm"></i>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">VES HRMS - Admin Control</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-red-600 font-medium">{user?.role} (Full Access)</p>
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
        {activeTab === 'overview' && (
          <div>
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-gray-600 to-blue-600 rounded-lg p-6 mb-8 text-white">
              <h2 className="text-3xl font-bold mb-2">Admin Control Panel 👑</h2>
              <p className="text-gray-100">Complete system administration and oversight</p>
            </div>

            {/* Enhanced Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-users text-blue-600 text-xl"></i>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Employees</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalEmployees}</p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-id-card text-green-600 text-xl"></i>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">HR Staff</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.hrUsers}</p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-user-tie text-purple-600 text-xl"></i>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Admins</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.adminUsers}</p>
                  </div>
                  <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-crown text-red-600 text-xl"></i>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Users</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.activeUsers}</p>
                  </div>
                  <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-user-check text-orange-600 text-xl"></i>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">System</p>
                    <p className="text-lg font-bold text-green-600">{stats.systemHealth}</p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-heartbeat text-green-600 text-xl"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">All System Users</h3>
                <p className="text-sm text-gray-600">Complete user management and access control</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permissions</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {allUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                              user.role === 'Admin' ? 'bg-red-100' : user.role === 'HR' ? 'bg-purple-100' : 'bg-blue-100'
                            }`}>
                              <span className={`font-medium text-sm ${
                                user.role === 'Admin' ? 'text-red-600' : user.role === 'HR' ? 'text-purple-600' : 'text-blue-600'
                              }`}>
                                {user.name.charAt(0)}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{user.name}</div>
                              <div className="text-sm text-gray-500">{user.status}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.role === 'Admin' ? 'bg-red-100 text-red-800' : 
                            user.role === 'HR' ? 'bg-purple-100 text-purple-800' : 
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.department}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.permissions}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.lastLogin}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button className="text-blue-600 hover:text-blue-900 mr-3">Edit</button>
                          <button className="text-green-600 hover:text-green-900 mr-3">Permissions</button>
                          <button className="text-red-600 hover:text-red-900">Disable</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hr-oversight' && (
          <div>
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">HR Operations Oversight</h3>
                <p className="text-sm text-gray-600">Monitor and manage HR activities across the organization</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* HR Performance Metrics */}
                  <div className="bg-purple-50 rounded-lg p-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">HR Performance Metrics</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Employee Onboarding</span>
                        <span className="text-sm font-medium text-gray-900">5 This Month</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Leave Approvals</span>
                        <span className="text-sm font-medium text-gray-900">12 Pending</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Performance Reviews</span>
                        <span className="text-sm font-medium text-gray-900">8 Completed</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Training Programs</span>
                        <span className="text-sm font-medium text-gray-900">3 Active</span>
                      </div>
                    </div>
                  </div>

                  {/* HR Team Access */}
                  <div className="bg-blue-50 rounded-lg p-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">HR Team Access Control</h4>
                    <div className="space-y-4">
                      {allUsers.filter(u => u.role === 'HR').map((hrUser) => (
                        <div key={hrUser.id} className="flex justify-between items-center p-3 bg-white rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{hrUser.name}</p>
                            <p className="text-xs text-gray-500">Last active: {hrUser.lastLogin}</p>
                          </div>
                          <div className="flex space-x-2">
                            <button className="text-blue-600 hover:text-blue-900 text-sm">Monitor</button>
                            <button className="text-green-600 hover:text-green-900 text-sm">Permissions</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'system-logs' && (
          <div>
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">System Activity Logs</h3>
                <p className="text-sm text-gray-600">Real-time system monitoring and audit trail</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {systemLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className={`h-3 w-3 rounded-full ${
                          log.level === 'success' ? 'bg-green-400' : 
                          log.level === 'warning' ? 'bg-yellow-400' : 
                          'bg-blue-400'
                        }`}></div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{log.action}</p>
                          <p className="text-xs text-gray-500">{log.details}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">{log.user}</p>
                        <p className="text-xs text-gray-500">{log.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div>
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">System Settings</h3>
                <p className="text-sm text-gray-600">Configure system parameters and security settings</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Security Settings */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Security Configuration</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Password Policy</p>
                          <p className="text-xs text-gray-500">Minimum 8 characters, mixed case</p>
                        </div>
                        <button className="text-blue-600 hover:text-blue-900 text-sm">Configure</button>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Session Timeout</p>
                          <p className="text-xs text-gray-500">Auto logout after 8 hours</p>
                        </div>
                        <button className="text-blue-600 hover:text-blue-900 text-sm">Configure</button>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Two-Factor Authentication</p>
                          <p className="text-xs text-gray-500">Disabled for all users</p>
                        </div>
                        <button className="text-blue-600 hover:text-blue-900 text-sm">Enable</button>
                      </div>
                    </div>
                  </div>

                  {/* System Configuration */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">System Configuration</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Database Backup</p>
                          <p className="text-xs text-gray-500">Last backup: 2 hours ago</p>
                        </div>
                        <button className="text-green-600 hover:text-green-900 text-sm">Backup Now</button>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">System Logs</p>
                          <p className="text-xs text-gray-500">Retention: 90 days</p>
                        </div>
                        <button className="text-blue-600 hover:text-blue-900 text-sm">Configure</button>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Email Notifications</p>
                          <p className="text-xs text-gray-500">Enabled for critical events</p>
                        </div>
                        <button className="text-blue-600 hover:text-blue-900 text-sm">Configure</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;