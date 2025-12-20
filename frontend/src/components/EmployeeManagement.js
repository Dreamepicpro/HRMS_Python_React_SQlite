import React, { useState, useEffect } from 'react';
import apiClient from '../utils/apiClient';
import { AddEditEmployeeModal, ViewEmployeeModal } from './EmployeeModals';

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [masterData, setMasterData] = useState({
    departments: [],
    designations: [],
    branches: [],
    divisions: []
  });
  
  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    department: '',
    designation: '',
    status: 'active'
  });
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 20,
    total: 0,
    total_pages: 0
  });
  
  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    employee_id: '',
    full_name: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    hire_date: new Date().toISOString().split('T')[0],
    address: '',
    employee_category: 'W001',
    shift: '1',
    leave_balance: 12,
    username: '',
    password: ''
  });
  
  // Credentials popup state
  const [showCredentials, setShowCredentials] = useState(false);
  const [newCredentials, setNewCredentials] = useState(null);
  
  const [formErrors, setFormErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    loadDashboardStats();
    loadMasterData();
  }, []);

  useEffect(() => {
    // Debounce search - wait 500ms after user stops typing
    const delaySearch = setTimeout(() => {
      searchEmployees();
    }, 500);

    return () => clearTimeout(delaySearch);
  }, [filters, pagination.page, searchTerm]);

  const loadDashboardStats = async () => {
    try {
      const response = await apiClient.get('/api/hr/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadMasterData = async () => {
    try {
      const [depts, desigs, branches, divs] = await Promise.all([
        apiClient.get('/api/hr/master/departments'),
        apiClient.get('/api/hr/master/designations'),
        apiClient.get('/api/hr/master/branches'),
        apiClient.get('/api/hr/master/divisions')
      ]);
      
      setMasterData({
        departments: depts.data.departments || [],
        designations: desigs.data.designations || [],
        branches: branches.data.branches || [],
        divisions: divs.data.divisions || []
      });
    } catch (error) {
      console.error('Error loading master data:', error);
    }
  };

  const searchEmployees = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: searchTerm,
        department: filters.department,
        designation: filters.designation,
        status: filters.status,
        page: pagination.page,
        per_page: pagination.per_page
      });
      
      console.log('📡 API Call: /api/hr/employees/search?' + params.toString());
      
      const response = await apiClient.get(`/api/hr/employees/search?${params}`);
      
      console.log('✅ API Response:', response.data);
      console.log('👥 Employees count:', response.data.employees?.length || 0);
      
      setEmployees(response.data.employees || []);
      setPagination(prev => ({
        ...prev,
        total: response.data.total,
        total_pages: response.data.total_pages
      }));
    } catch (error) {
      console.error('❌ Error searching employees:', error);
      console.error('Error details:', error.response?.data);
      console.error('Error status:', error.response?.status);
      alert('Failed to load employees: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmployee = async () => {
    setShowAddModal(true);
    try {
      const response = await apiClient.get('/api/hr/employees/next-id');
      setFormData(prev => ({
        ...prev,
        employee_id: response.data.next_employee_id
      }));
    } catch (error) {
      console.error('Error getting next ID:', error);
    }
  };

  const handleSubmitEmployee = async (e) => {
    e.preventDefault();
    setFormErrors({});
    
    // Validate username and password for new employee
    if (!showEditModal) {
      if (!formData.username || formData.username.trim() === '') {
        setFormErrors({ username: 'Username is required' });
        return;
      }
      if (!formData.password || formData.password.trim() === '') {
        setFormErrors({ password: 'Password is required' });
        return;
      }
      if (formData.password.length < 6) {
        setFormErrors({ password: 'Password must be at least 6 characters' });
        return;
      }
    }
    
    setSubmitLoading(true);

    try {
      // Prepare data
      const payload = {
        ...formData,
        role: 'Employee'
      };

      if (showEditModal && selectedEmployee) {
        // Update employee
        await apiClient.put(`/api/hr/employees/${selectedEmployee.employee_id}`, payload);
        alert('Employee updated successfully!');
        setShowEditModal(false);
      } else {
        // Create new employee
        const response = await apiClient.post('/api/hr/employees', payload);
        
        // Show credentials popup
        setNewCredentials({
          employee_id: response.data.employee.employee_id,
          full_name: response.data.employee.full_name,
          username: response.data.employee.username,
          password: response.data.employee.password
        });
        setShowCredentials(true);
        setShowAddModal(false);
      }
      
      searchEmployees();
      loadDashboardStats();
      resetForm();
    } catch (error) {
      console.error('Error saving employee:', error);
      if (error.response?.data?.errors) {
        setFormErrors(error.response.data.errors);
      } else {
        alert(error.response?.data?.error || 'Failed to save employee');
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditEmployee = (employee) => {
    setSelectedEmployee(employee);
    setFormData({
      employee_id: employee.employee_id,
      full_name: employee.full_name,
      email: employee.email,
      phone: employee.phone || '',
      department: employee.department || '',
      position: employee.position || '',
      hire_date: employee.hire_date || '',
      address: employee.address || '',
      employee_category: employee.employee_category || 'W001',
      shift: employee.shift || '1',
      leave_balance: employee.leave_balance || 12
    });
    setShowEditModal(true);
  };

  const handleViewEmployee = (employee) => {
    setSelectedEmployee(employee);
    setShowViewModal(true);
  };

  const handleToggleStatus = async (employee) => {
    if (!window.confirm(`Are you sure you want to ${employee.is_active ? 'deactivate' : 'activate'} ${employee.full_name}?`)) {
      return;
    }

    try {
      const newStatus = employee.is_active ? 'Inactive' : 'Active';
      await apiClient.put(`/api/hr/employees/${employee.employee_id}/status`, {
        status: newStatus
      });
      
      alert('Employee status updated successfully!');
      searchEmployees();
      loadDashboardStats();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update employee status');
    }
  };

  const resetForm = () => {
    setFormData({
      employee_id: '',
      full_name: '',
      email: '',
      phone: '',
      department: '',
      position: '',
      hire_date: new Date().toISOString().split('T')[0],
      address: '',
      employee_category: 'W001',
      shift: '1',
      leave_balance: 12,
      username: '',
      password: ''
    });
    setFormErrors({});
    setSelectedEmployee(null);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const exportToExcel = () => {
    // Simple CSV export
    const headers = ['Employee ID', 'Name', 'Email', 'Department', 'Designation', 'Hire Date', 'Status'];
    const rows = employees.map(e => [
      e.employee_id,
      e.full_name,
      e.email,
      e.department || '',
      e.position || '',
      e.hire_date || '',
      e.is_active ? 'Active' : 'Inactive'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Dashboard Stats */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Employee Management</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Employees</p>
                <p className="text-3xl font-bold text-gray-800">{stats.total_employees || 0}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Active</p>
                <p className="text-3xl font-bold text-green-600">{stats.active_employees || 0}</p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Inactive</p>
                <p className="text-3xl font-bold text-red-600">{stats.inactive_employees || 0}</p>
              </div>
              <div className="bg-red-100 rounded-full p-3">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">New This Month</p>
                <p className="text-3xl font-bold text-purple-600">{stats.new_joiners_this_month || 0}</p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Search by name or employee ID..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={filters.department}
            onChange={(e) => handleFilterChange('department', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Departments</option>
            {masterData.departments.map(dept => (
              <option key={dept.id} value={dept.dept_name}>{dept.dept_name}</option>
            ))}
          </select>

          <select
            value={filters.designation}
            onChange={(e) => handleFilterChange('designation', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Designations</option>
            {masterData.designations.map(desig => (
              <option key={desig.id} value={desig.designation_name}>{desig.designation_name}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="all">All Status</option>
          </select>
        </div>

        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Showing {employees.length} of {pagination.total} employees
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
            <button
              onClick={handleAddEmployee}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Employee
            </button>
          </div>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading employees...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No employees found</h3>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Designation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hire Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{employee.employee_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{employee.full_name}</div>
                      <div className="text-sm text-gray-500">{employee.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.department || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.position || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.hire_date || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        employee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {employee.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleViewEmployee(employee)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                        title="View Details"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleEditEmployee(employee)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                        title="Edit"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleToggleStatus(employee)}
                        className={`${employee.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                        title={employee.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {employee.is_active ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          )}
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.total_pages, prev.page + 1) }))}
                    disabled={pagination.page === pagination.total_pages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing page <span className="font-medium">{pagination.page}</span> of{' '}
                      <span className="font-medium">{pagination.total_pages}</span>
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        disabled={pagination.page === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      {[...Array(pagination.total_pages)].map((_, i) => {
                        const pageNum = i + 1;
                        if (pageNum === 1 || pageNum === pagination.total_pages || (pageNum >= pagination.page - 1 && pageNum <= pagination.page + 1)) {
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                pagination.page === pageNum
                                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        } else if (pageNum === pagination.page - 2 || pageNum === pagination.page + 2) {
                          return <span key={pageNum} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>;
                        }
                        return null;
                      })}
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.total_pages, prev.page + 1) }))}
                        disabled={pagination.page === pagination.total_pages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Employee Modal */}
      <AddEditEmployeeModal
        show={showAddModal || showEditModal}
        isEdit={showEditModal}
        formData={formData}
        setFormData={setFormData}
        formErrors={formErrors}
        masterData={masterData}
        onSubmit={handleSubmitEmployee}
        onClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          resetForm();
        }}
        submitLoading={submitLoading}
      />

      {/* View Employee Modal */}
      <ViewEmployeeModal
        show={showViewModal}
        employee={selectedEmployee}
        onClose={() => {
          setShowViewModal(false);
          setSelectedEmployee(null);
        }}
      />

      {/* Credentials Display Modal */}
      {showCredentials && newCredentials && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="bg-green-600 px-6 py-4 rounded-t-lg">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Employee Created Successfully!
              </h3>
            </div>
            
            <div className="px-6 py-6">
              <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg">
                <p className="text-sm text-amber-800 font-medium mb-2">
                  ⚠️ Important: Save these credentials now!
                </p>
                <p className="text-xs text-amber-700">
                  This information will not be shown again. Please provide these credentials to the employee.
                </p>
              </div>

              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Employee ID</label>
                  <p className="text-lg font-mono font-bold text-gray-900">{newCredentials.employee_id}</p>
                </div>

                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                  <p className="text-lg font-semibold text-gray-900">{newCredentials.full_name}</p>
                </div>

                <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                  <label className="block text-xs font-medium text-blue-700 mb-1">🔑 Username</label>
                  <p className="text-lg font-mono font-bold text-blue-900 select-all">{newCredentials.username}</p>
                </div>

                <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                  <label className="block text-xs font-medium text-blue-700 mb-1">🔒 Password</label>
                  <p className="text-lg font-mono font-bold text-blue-900 select-all">{newCredentials.password}</p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    const text = `Employee Credentials\n\nEmployee ID: ${newCredentials.employee_id}\nName: ${newCredentials.full_name}\nUsername: ${newCredentials.username}\nPassword: ${newCredentials.password}\n\nPlease keep this information secure.`;
                    navigator.clipboard.writeText(text);
                    alert('Credentials copied to clipboard!');
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy to Clipboard
                </button>
                <button
                  onClick={() => {
                    setShowCredentials(false);
                    setNewCredentials(null);
                  }}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
