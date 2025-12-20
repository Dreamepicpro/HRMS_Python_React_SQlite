import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import EmployeeManagement from '../components/EmployeeManagement';
import apiClient from '../utils/apiClient';

const HRDashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [sessionLocked, setSessionLocked] = useState(false); // Lock UI when session revoked
  const [employees, setEmployees] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    onLeave: 0,
    pendingApprovals: 0
  });
  
  // Leave Management States
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [leaveFilter, setLeaveFilter] = useState('Pending');
  const [processingLeave, setProcessingLeave] = useState(null);
  const [rejectModal, setRejectModal] = useState({ show: false, leaveId: null, reason: '' });
  
  // Employee Management States
  const [showCreateEmployee, setShowCreateEmployee] = useState(false);
  const [createEmployeeLoading, setCreateEmployeeLoading] = useState(false);
  const [resendingCredentials, setResendingCredentials] = useState(null);
  const [newEmployee, setNewEmployee] = useState({
    employee_id: '',
    full_name: '',
    email: '',
    role: 'Employee',
    department: '',
    designation: '',
    employee_category: 'S001',
    shift: 'General',
    hire_date: new Date().toISOString().split('T')[0]
  });
  
  // System Settings States
  const [settings, setSettings] = useState({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  
  // Enhanced Employee Management States
  const [employeeList, setEmployeeList] = useState([]);
  const [employeeListLoading, setEmployeeListLoading] = useState(false);
  const [editEmployeeModal, setEditEmployeeModal] = useState({ show: false, employee: null });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ show: false, employee: null });
  const [employeeActionLoading, setEmployeeActionLoading] = useState(null);
  
  // Attendance Management States
  const [hrAttendance, setHrAttendance] = useState([]);
  const [hrAttendanceLoading, setHrAttendanceLoading] = useState(false);
  const [attendanceFilters, setAttendanceFilters] = useState({
    date_from: new Date().toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    department: 'all',
    shift: 'all',
    status: 'all'
  });
  const [filterOptions, setFilterOptions] = useState({ departments: [], shifts: [], statuses: [] });
  const [editAttendanceModal, setEditAttendanceModal] = useState({ show: false, record: null });
  const [addAttendanceModal, setAddAttendanceModal] = useState({ show: false });
  const [attendanceFormData, setAttendanceFormData] = useState({
    employee_id: '',
    date: new Date().toISOString().split('T')[0],
    clock_in: '',
    clock_out: '',
    status: 'Present',
    notes: ''
  });
  
  // Reports States
  const [reportType, setReportType] = useState('attendance');
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    date_from: new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    department: 'all'
  });
  
  // Payroll Management States
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payrollData, setPayrollData] = useState([]);
  const [payrollSummary, setPayrollSummary] = useState(null);
  const [payrollLoading, setPayrollLoading] = useState(false);

  // Punch Records States
  const [punchRecords, setPunchRecords] = useState([]);
  const [loadingPunchRecords, setLoadingPunchRecords] = useState(false);
  const [punchSummary, setPunchSummary] = useState(null);
  const [punchFilters, setPunchFilters] = useState({
    employee_id: '',
    date_from: '',
    date_to: '',
    department: 'all'
  });
  const [processingPayroll, setProcessingPayroll] = useState(false);
  const [salaryConfigs, setSalaryConfigs] = useState([]);
  const [editSalaryModal, setEditSalaryModal] = useState({ show: false, employee: null });
  const [payslipModal, setPayslipModal] = useState({ show: false, data: null });
  const [payslipLoading, setPayslipLoading] = useState(false);

  useEffect(() => {
    loadHRData();
    fetchPendingLeaves();
    fetchLookupData();
    fetchPunchRecords();
    fetchPunchSummary();
  }, []);

  // Listen for session revoked event to lock UI
  useEffect(() => {
    let sessionCheckInterval = null;
    let isHeartbeatStopped = false;
    
    const handleSessionRevoked = () => {
      setSessionLocked(true);
    };

    // Listen for storage changes (force logout from another tab)
    const handleStorageChange = (e) => {
      // Detect when THIS user's token changes (another tab force logged in as same user)
      const myTokenKey = `ves_token_${user?.username}`;
      if (user?.username && e.key === myTokenKey) {
        // MY token changed - another tab force logged in as ME
        setSessionLocked(true);
        
        // Show dialog and redirect WITHOUT calling API logout
        setTimeout(() => {
          window.confirm(
            '🔒 Session Revoked\n\n' +
            'You have been logged in from another device/tab.\n' +
            'Your session here has been terminated.\n\n' +
            'Click OK to return to the login page.'
          );
          // Don't call logout() API - just redirect
          window.location.href = '/login';
        }, 100);
      }
    };
    
    // Listen for beforeLogout event to stop heartbeat immediately
    const handleBeforeLogout = () => {
      isHeartbeatStopped = true;
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
      }
    };

    // Periodic session validation (every 15 seconds) - detects force logout from other browsers
    sessionCheckInterval = setInterval(async () => {
      if (isHeartbeatStopped) return;
      
      try {
        // Use MY username from AuthContext state (not shared localStorage)
        if (!user?.username || sessionLocked) return;
        
        const tokenKey = `ves_token_${user.username}`;
        const token = localStorage.getItem(tokenKey);
        
        // Stop heartbeat if no token (user logged out)
        if (!token) {
          isHeartbeatStopped = true;
          if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval);
            sessionCheckInterval = null;
          }
          return;
        }
        
        // Use role-specific endpoint for heartbeat check (user already available from AuthContext)
        let heartbeatEndpoint;
        if (user.role === 'HR' || user.role === 'Admin' || user.role === 'MD') {
          heartbeatEndpoint = '/api/hr/dashboard/stats';
        } else {
          // For employees, use employee-accessible endpoint
          heartbeatEndpoint = '/api/punch-records/summary';
        }
        
        // Use apiClient to trigger interceptors and revoked token detection
        await apiClient.get(heartbeatEndpoint);
      } catch (error) {
        // Silently catch - 403/401 will be handled by interceptor if it's a revoked session
      }
    }, 15000); // Check every 15 seconds (reduced from 3 to avoid rate limits)

    window.addEventListener('sessionRevoked', handleSessionRevoked);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('beforeLogout', handleBeforeLogout);

    return () => {
      window.removeEventListener('sessionRevoked', handleSessionRevoked);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('beforeLogout', handleBeforeLogout);
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
      }
    };
  }, [logout, sessionLocked]);

  // Fetch Lookup Data for dropdowns
  const fetchLookupData = async () => {
    try {
      // Use apiClient - token already in Authorization header from AuthContext
      const [deptData, desigData, divData, bloodData] = await Promise.all([
        apiClient.get('/api/hr/master/departments'),
        apiClient.get('/api/hr/master/designations'),
        apiClient.get('/api/hr/master/divisions'),
        apiClient.get('/api/hr/lookup/blood-groups')
      ]);
      
      if (deptData && desigData && divData && bloodData) {
        
        setFilterOptions({
          departments: deptData.data?.departments || [],
          designations: desigData.data?.designations || [],
          divisions: divData.data?.divisions || [],
          bloodGroups: bloodData.data?.blood_groups || [],
          shifts: ['Morning', 'Evening', 'Night', 'General'],
          statuses: ['Active', 'Inactive', 'On Leave']
        });
      }
    } catch (error) {
      console.error('Error fetching lookup data:', error);
    }
  };

  const loadHRData = async () => {
    try {
      // Simulated HR data - in real app, this would come from API
      const mockEmployees = [
        { id: 1, name: 'Ajith.B', empId: '1012', role: 'Employee', department: 'Engineering', status: 'Active', lastLogin: '2 hours ago' },
        { id: 2, name: 'Ajith.S', empId: '3250', role: 'Employee', department: 'Engineering', status: 'Active', lastLogin: '1 day ago' },
        { id: 3, name: 'Akhil.S', empId: '3062', role: 'Employee', department: 'Engineering', status: 'Active', lastLogin: '3 hours ago' },
        { id: 4, name: 'Arun Kumar.T', empId: '1008', role: 'Employee', department: 'Engineering', status: 'Active', lastLogin: '5 hours ago' },
        { id: 5, name: 'Baby', empId: '1015', role: 'Employee', department: 'Admin', status: 'Active', lastLogin: '1 hour ago' },
      ];

      const mockAttendance = [
        { empId: '1012', name: 'Ajith.B', date: '2025-10-27', status: 'Present', checkIn: '09:15', checkOut: '18:30' },
        { empId: '3250', name: 'Ajith.S', date: '2025-10-27', status: 'Absent', checkIn: '-', checkOut: '-' },
        { empId: '3062', name: 'Akhil.S', date: '2025-10-27', status: 'Present', checkIn: '09:00', checkOut: '18:15' },
        { empId: '1008', name: 'Arun Kumar.T', date: '2025-10-27', status: 'Present', checkIn: '08:45', checkOut: '17:45' },
        { empId: '1015', name: 'Baby', date: '2025-10-27', status: 'Present', checkIn: '09:30', checkOut: '18:00' },
      ];

      setEmployees(mockEmployees);
      setAttendanceData(mockAttendance);
      setStats({
        totalEmployees: mockEmployees.length,
        presentToday: mockAttendance.filter(a => a.status === 'Present').length,
        onLeave: mockAttendance.filter(a => a.status === 'Absent').length,
        pendingApprovals: 3
      });
      setLoading(false);
    } catch (error) {
      console.error('Error loading HR data:', error);
      setLoading(false);
    }
  };
  
  // Fetch Leave Requests
  const fetchPendingLeaves = async (status = 'Pending') => {
    try {
      // Use apiClient - token already in Authorization header from AuthContext
      const response = await apiClient.get(`/api/hr/leaves?status=${status}`);
      
      if (response?.data) {
        setPendingLeaves(response.data.leaves || []);
        // Update stats
        if (status === 'Pending') {
          setStats(prev => ({ ...prev, pendingApprovals: response.data.leaves?.length || 0 }));
        }
      }
    } catch (error) {
      console.error('Error fetching leaves:', error);
    }
  };
  
  // Approve Leave
  const handleApproveLeave = async (leaveId) => {
    if (!window.confirm('Are you sure you want to approve this leave request?')) return;
    
    setProcessingLeave(leaveId);
    try {
      // Use apiClient - token already in Authorization header from AuthContext
      await apiClient.put(`/api/hr/leaves/${leaveId}/approve`);
      
      alert('Leave request approved successfully');
      fetchPendingLeaves(leaveFilter);
    } catch (error) {
      console.error('Approve error:', error);
      alert('Failed to approve leave request');
    } finally {
      setProcessingLeave(null);
    }
  };
  
  // Reject Leave
  const handleRejectLeave = async () => {
    if (!rejectModal.reason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    
    setProcessingLeave(rejectModal.leaveId);
    try {
      // Use apiClient - token already in Authorization header from AuthContext
      await apiClient.put(`/api/hr/leaves/${rejectModal.leaveId}/reject`, {
        reason: rejectModal.reason
      });
      
      alert('Leave request rejected');
      setRejectModal({ show: false, leaveId: null, reason: '' });
      fetchPendingLeaves(leaveFilter);
    } catch (error) {
      console.error('Reject error:', error);
      alert('Failed to reject leave request');
    } finally {
      setProcessingLeave(null);
    }
  };
  
  // Create New Employee
  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    
    if (!newEmployee.employee_id || !newEmployee.full_name || !newEmployee.email) {
      alert('Please fill all required fields');
      return;
    }
    
    setCreateEmployeeLoading(true);
    try {
      // Use apiClient - token already in Authorization header from AuthContext
      const response = await apiClient.post('/api/hr/employees', newEmployee);
      
      if (response?.data) {
        alert(`Employee created successfully!\n${response.data.email_sent ? 'Credentials sent to: ' + response.data.employee.email : 'Note: Email sending failed - ' + response.data.note}`);
        setShowCreateEmployee(false);
        setNewEmployee({
          employee_id: '',
          full_name: '',
          email: '',
          role: 'Employee',
          department: '',
          designation: '',
          employee_category: 'S001',
          shift: 'General',
          hire_date: new Date().toISOString().split('T')[0]
        });
        loadHRData(); // Refresh employee list
      }
    } catch (error) {
      console.error('Create employee error:', error);
      alert('Failed to create employee');
    } finally {
      setCreateEmployeeLoading(false);
    }
  };
  
  // Resend Credentials
  const handleResendCredentials = async (employeeId) => {
    if (!window.confirm('This will reset the employee\'s password and send new credentials via email. Continue?')) return;
    
    setResendingCredentials(employeeId);
    try {
      // Use apiClient - token already in Authorization header from AuthContext
      const response = await apiClient.post('/api/resend-credentials', {
        employee_id: employeeId
      });
      
      if (response?.data) {
        alert(response.data.message);
      }
    } catch (error) {
      console.error('Resend credentials error:', error);
      alert('Failed to resend credentials');
    } finally {
      setResendingCredentials(null);
    }
  };
  
  // Fetch System Settings
  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      // Use apiClient - token already in Authorization header from AuthContext
      const response = await apiClient.get('/api/admin/settings');
      
      if (response?.data) {
        // Convert settings object to flat key-value for form
        const flatSettings = {};
        Object.keys(response.data.settings).forEach(key => {
          flatSettings[key] = response.data.settings[key].value || '';
        });
        setSettings(flatSettings);
      }
    } catch (error) {
      console.error('Fetch settings error:', error);
    } finally {
      setSettingsLoading(false);
    }
  };
  
  // Save System Settings
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      // Use apiClient - token already in Authorization header from AuthContext
      await apiClient.put('/api/admin/settings', { settings });
      
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Save settings error:', error);
      alert('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };
  
  // Test Email Settings
  const handleTestEmail = async () => {
    if (!testEmailAddress) {
      alert('Please enter a test email address');
      return;
    }
    
    setTestingEmail(true);
    try {
      // Use apiClient - token already in Authorization header from AuthContext
      const response = await apiClient.post('/api/admin/settings/test-email', {
        email: testEmailAddress
      });
      
      if (response?.data) {
        alert(response.data.message);
      }
    } catch (error) {
      console.error('Test email error:', error);
      alert('Failed to send test email');
    } finally {
      setTestingEmail(false);
    }
  };
  
  // ============== ENHANCED EMPLOYEE MANAGEMENT FUNCTIONS ==============
  
  // Fetch Employees from API
  const fetchEmployeeList = async () => {
    setEmployeeListLoading(true);
    try {
      const response = await apiClient.get('/api/hr/employees');
      
      if (response?.data) {
        setEmployeeList(response.data.employees || []);
        setStats(prev => ({ ...prev, totalEmployees: response.data.employees?.length || 0 }));
      }
    } catch (error) {
      console.error('Fetch employees error:', error);
    } finally {
      setEmployeeListLoading(false);
    }
  };
  
  // Update Employee Status (Activate/Deactivate/Block)
  const handleUpdateEmployeeStatus = async (employeeId, newStatus) => {
    const action = newStatus === 'Active' ? 'activate' : (newStatus === 'Inactive' ? 'deactivate' : 'block');
    if (!window.confirm(`Are you sure you want to ${action} this employee?`)) return;
    
    setEmployeeActionLoading(employeeId);
    try {
      // Use apiClient - token already in Authorization header from AuthContext
      const response = await apiClient.put(`/api/hr/employees/${employeeId}/status`, {
        status: newStatus
      });
      
      if (response?.data) {
        alert(response.data.message);
        fetchEmployeeList();
      }
    } catch (error) {
      console.error('Update status error:', error);
      alert(`Failed to ${action} employee`);
    } finally {
      setEmployeeActionLoading(null);
    }
  };
  
  // Delete Employee
  const handleDeleteEmployee = async () => {
    if (!deleteConfirmModal.employee) return;
    
    const employeeId = deleteConfirmModal.employee.employee_id;
    setEmployeeActionLoading(employeeId);
    
    try {
      // Use apiClient - token already in Authorization header from AuthContext
      const response = await apiClient.delete(`/api/hr/employees/${employeeId}`);
      
      if (response?.data) {
        alert(response.data.message);
        setDeleteConfirmModal({ show: false, employee: null });
        fetchEmployeeList();
      }
    } catch (error) {
      console.error('Delete employee error:', error);
      alert('Failed to delete employee');
    } finally {
      setEmployeeActionLoading(null);
    }
  };
  
  // Update Employee Details
  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    if (!editEmployeeModal.employee) return;
    
    const employeeId = editEmployeeModal.employee.employee_id;
    setEmployeeActionLoading(employeeId);
    
    try {
      // Use apiClient - token already in Authorization header from AuthContext
      const response = await apiClient.put(`/api/hr/employees/${employeeId}`, editEmployeeModal.employee);
      
      if (response?.data) {
        alert(response.data.message);
        setEditEmployeeModal({ show: false, employee: null });
        fetchEmployeeList();
      }
    } catch (error) {
      console.error('Update employee error:', error);
      alert('Failed to update employee');
    } finally {
      setEmployeeActionLoading(null);
    }
  };
  
  // ============== ATTENDANCE MANAGEMENT FUNCTIONS ==============
  
  // Fetch HR Attendance Records
  const fetchHrAttendance = async () => {
    setHrAttendanceLoading(true);
    try {
      // Use apiClient - token already in Authorization header from AuthContext
      const params = new URLSearchParams();
      if (attendanceFilters.date_from) params.append('date_from', attendanceFilters.date_from);
      if (attendanceFilters.date_to) params.append('date_to', attendanceFilters.date_to);
      if (attendanceFilters.department !== 'all') params.append('department', attendanceFilters.department);
      if (attendanceFilters.shift !== 'all') params.append('shift', attendanceFilters.shift);
      if (attendanceFilters.status !== 'all') params.append('status', attendanceFilters.status);
      
      const response = await apiClient.get(`/api/hr/attendance?${params.toString()}`);
      
      if (response?.data) {
        setHrAttendance(response.data.attendance || []);
        setFilterOptions(response.data.filters || { departments: [], shifts: [], statuses: [] });
      }
    } catch (error) {
      console.error('Fetch HR attendance error:', error);
    } finally {
      setHrAttendanceLoading(false);
    }
  };
  
  // Modify Attendance Record
  const handleModifyAttendance = async (e) => {
    e.preventDefault();
    if (!editAttendanceModal.record) return;
    
    try {
      const response = await apiClient.put(`/api/hr/attendance/${editAttendanceModal.record.id}`, attendanceFormData);
      
      if (response?.data) {
        alert(response.data.message);
        setEditAttendanceModal({ show: false, record: null });
        fetchHrAttendance();
      }
    } catch (error) {
      console.error('Modify attendance error:', error);
      alert('Failed to update attendance');
    }
  };
  
  // Add Attendance Record
  const handleAddAttendance = async (e) => {
    e.preventDefault();
    
    if (!attendanceFormData.employee_id || !attendanceFormData.date) {
      alert('Employee ID and Date are required');
      return;
    }
    
    try {
      const response = await apiClient.post('/api/hr/attendance', attendanceFormData);
      
      if (response?.data) {
        alert(response.data.message);
        setAddAttendanceModal({ show: false });
        setAttendanceFormData({
          employee_id: '',
          date: new Date().toISOString().split('T')[0],
          clock_in: '',
          clock_out: '',
          status: 'Present',
          notes: ''
        });
        fetchHrAttendance();
      }
    } catch (error) {
      console.error('Add attendance error:', error);
      alert('Failed to add attendance');
    }
  };
  
  // ============== REPORTS FUNCTIONS ==============
  
  // Fetch Reports
  const fetchReport = async (type = 'attendance') => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams({
        date_from: reportFilters.date_from,
        date_to: reportFilters.date_to
      });
      if (reportFilters.department !== 'all') params.append('department', reportFilters.department);
      
      const endpoint = type === 'attendance' ? '/api/hr/reports/attendance' : '/api/hr/reports/leaves';
      const response = await apiClient.get(`${endpoint}?${params.toString()}`);
      
      if (response?.data) {
        const data = await response.json();
        setReportData(data);
      }
    } catch (error) {
      console.error('Fetch report error:', error);
    } finally {
      setReportLoading(false);
    }
  };

  // Fetch punch records
  const fetchPunchRecords = async () => {
    setLoadingPunchRecords(true);
    try {
      const params = new URLSearchParams();
      if (punchFilters.employee_id) params.append('employee_id', punchFilters.employee_id);
      if (punchFilters.date_from) params.append('date_from', punchFilters.date_from);
      if (punchFilters.date_to) params.append('date_to', punchFilters.date_to);
      if (punchFilters.department !== 'all') params.append('department', punchFilters.department);
      
      const response = await apiClient.get(`/api/punch-records?${params.toString()}`);
      
      if (response?.data) {
        const data = await response.json();
        setPunchRecords(data.records || []);
      }
    } catch (error) {
      console.error('Error fetching punch records:', error);
    } finally {
      setLoadingPunchRecords(false);
    }
  };

  // Fetch punch summary
  const fetchPunchSummary = async () => {
    try {
      const response = await apiClient.get('/api/punch-records/summary');
      
      if (response?.data) {
        setPunchSummary(response.data.summary);
      }
    } catch (error) {
      console.error('Error fetching punch summary:', error);
    }
  };
  
  // Export Report as CSV
  const handleExportCSV = async (type) => {
    try {
      const params = new URLSearchParams({
        date_from: reportFilters.date_from,
        date_to: reportFilters.date_to,
        format: 'csv'
      });
      if (reportFilters.department !== 'all') params.append('department', reportFilters.department);
      
      const endpoint = type === 'attendance' ? '/api/hr/reports/attendance' : '/api/hr/reports/leaves';
      const response = await apiClient.get(`${endpoint}?${params.toString()}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_report_${reportFilters.date_from}_to_${reportFilters.date_to}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed to export report');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export report');
    }
  };
  
  // ============== PAYROLL MANAGEMENT FUNCTIONS ==============
  
  // Fetch Payroll Data
  const fetchPayrollData = async (month = payrollMonth) => {
    setPayrollLoading(true);
    try {
      const response = await apiClient.get(`/api/hr/payroll?month=${month}`);
      
      if (response?.data) {
        setPayrollData(response.data.payroll || []);
        setPayrollSummary(response.data.summary || null);
      }
    } catch (error) {
      console.error('Fetch payroll error:', error);
    } finally {
      setPayrollLoading(false);
    }
  };
  
  // Fetch Salary Configurations
  const fetchSalaryConfigs = async () => {
    try {
      const response = await apiClient.get('/api/hr/payroll/salary-config');
      
      if (response?.data) {
        setSalaryConfigs(response.data.employees || []);
      }
    } catch (error) {
      console.error('Fetch salary configs error:', error);
    }
  };
  
  // Update Salary Configuration
  const handleUpdateSalary = async (e) => {
    e.preventDefault();
    if (!editSalaryModal.employee) return;
    
    try {
      const response = await apiClient.put(`/api/hr/payroll/salary-config/${editSalaryModal.employee.employee_id}`, { basic_salary: editSalaryModal.employee.basic_salary });
      
      if (response?.data) {
        alert(response.data.message);
        setEditSalaryModal({ show: false, employee: null });
        fetchSalaryConfigs();
      }
    } catch (error) {
      console.error('Update salary error:', error);
      alert('Failed to update salary');
    }
  };
  
  // Process/Calculate Payroll
  const handleProcessPayroll = async () => {
    if (!window.confirm(`Are you sure you want to process payroll for ${payrollMonth}? This will calculate salaries based on attendance and leaves.`)) return;
    
    setProcessingPayroll(true);
    try {
      const response = await apiClient.post('/api/hr/payroll/calculate', { month: payrollMonth });
      
      if (response?.data) {
        alert(data.message);
        fetchPayrollData(payrollMonth);
      } else {
        alert(data.error || 'Failed to process payroll');
      }
    } catch (error) {
      console.error('Process payroll error:', error);
      alert('Failed to process payroll');
    } finally {
      setProcessingPayroll(false);
    }
  };
  
  // View Payslip
  const handleViewPayslip = async (employeeId) => {
    setPayslipLoading(true);
    try {
      const response = await apiClient.get(`/api/hr/payroll/payslip/${employeeId}?month=${payrollMonth}`);
      
      if (response?.data) {
        setPayslipModal({ show: true, data: response.data });
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to load payslip');
      }
    } catch (error) {
      console.error('View payslip error:', error);
      alert('Failed to load payslip');
    } finally {
      setPayslipLoading(false);
    }
  };
  
  // Download Payslip as PDF
  const handleDownloadPayslip = () => {
    if (!payslipModal.data) return;
    
    const payslip = payslipModal.data;
    const content = `
================================================================================
                              ${payslip.company_name}
                                   PAYSLIP
================================================================================
Month: ${payslip.month}                              Generated: ${payslip.generated_on}
--------------------------------------------------------------------------------
EMPLOYEE DETAILS
--------------------------------------------------------------------------------
Employee ID    : ${payslip.employee.employee_id}
Name           : ${payslip.employee.name}
Department     : ${payslip.employee.department || 'N/A'}
Designation    : ${payslip.employee.designation || 'N/A'}
Date of Joining: ${payslip.employee.date_of_joining || 'N/A'}

--------------------------------------------------------------------------------
ATTENDANCE SUMMARY
--------------------------------------------------------------------------------
Working Days   : ${payslip.attendance.working_days || 26}
Days Worked    : ${payslip.attendance.days_worked}
Leave Days     : ${payslip.attendance.leave_days}

--------------------------------------------------------------------------------
EARNINGS                                    DEDUCTIONS
--------------------------------------------------------------------------------
Basic Salary   : ₹${payslip.earnings.basic_salary.toLocaleString()}      PF             : ₹${payslip.deductions.provident_fund.toLocaleString()}
HRA            : ₹${payslip.earnings.hra.toLocaleString()}      Professional Tax: ₹${payslip.deductions.professional_tax.toLocaleString()}
Conveyance     : ₹${payslip.earnings.conveyance_allowance.toLocaleString()}      LOP Deduction  : ₹${payslip.deductions.lop_deduction?.toLocaleString() || '0'}
Medical        : ₹${payslip.earnings.medical_allowance.toLocaleString()}
Overtime       : ₹${payslip.earnings.overtime_pay.toLocaleString()}
--------------------------------------------------------------------------------
Total Earnings : ₹${payslip.earnings.total_earnings.toLocaleString()}      Total Deductions: ₹${payslip.deductions.total_deductions.toLocaleString()}

================================================================================
                         NET PAY: ₹${payslip.net_pay.toLocaleString()}
================================================================================
This is a computer-generated payslip and does not require a signature.
    `;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Payslip_${payslip.employee.employee_id}_${payslip.month}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Session Locked Overlay */}
      {sessionLocked && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
          style={{ pointerEvents: 'all' }}
        >
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Session Locked</h2>
            <p className="text-gray-600 mb-4">
              You have been logged in from another device.
              <br />
              This session is being terminated.
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full flex items-center justify-center mr-3" style={{background: 'linear-gradient(135deg, #4169E1 0%, #1E90FF 100%)'}}>
                <i className="fas fa-users text-white text-sm"></i>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">People App - HR Portal</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs font-medium" style={{color: '#4169E1'}}>{user?.role} (Oversight Powers)</p>
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

      {/* Tab Navigation - Blue Branch */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            {[
              { id: 'overview', name: 'Overview', icon: 'fas fa-chart-line' },
              { id: 'employee-master', name: 'Employee Master', icon: 'fas fa-users-cog' },
              { id: 'employee-mgmt', name: 'Quick Add Employee', icon: 'fas fa-user-plus' },
              { id: 'company-attendance', name: 'Company Attendance', icon: 'fas fa-calendar-check' },
              { id: 'reports', name: 'Reports', icon: 'fas fa-file-export' },
              { id: 'payroll-management', name: 'Payroll Management', icon: 'fas fa-money-bill-wave' },
              { id: 'document-review', name: 'Document Review', icon: 'fas fa-file-alt' },
              { id: 'leave-approvals', name: 'Leave Approvals', icon: 'fas fa-check-circle' },
              { id: 'meal-reports', name: 'Meal Reports', icon: 'fas fa-utensils' },
              { id: 'employee-database', name: 'Employee Database', icon: 'fas fa-database' },
              { id: 'designations', name: 'Manage Designations', icon: 'fas fa-user-tie' },
              { id: 'exit-tracking', name: 'Exit Tracking', icon: 'fas fa-door-open' },
              { id: 'settings', name: 'Settings', icon: 'fas fa-cog' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  // Prevent tab switching if session is locked
                  if (sessionLocked) return;
                  
                  setActiveTab(tab.id);
                  if (tab.id === 'settings') fetchSettings();
                  if (tab.id === 'employee-mgmt') fetchEmployeeList();
                  if (tab.id === 'company-attendance') fetchHrAttendance();
                  if (tab.id === 'reports') fetchReport(reportType);
                  if (tab.id === 'payroll-management') { fetchPayrollData(); fetchSalaryConfigs(); }
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-blue-500'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } ${sessionLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={activeTab === tab.id ? {color: '#4169E1', borderColor: '#4169E1'} : {}}
                disabled={sessionLocked}
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
            <div className="rounded-lg p-6 mb-8 text-white" style={{background: 'linear-gradient(135deg, #4169E1 0%, #1E90FF 100%)'}}>
              <h2 className="text-3xl font-bold mb-2">HR Command Center 💼</h2>
              <p className="text-blue-100">Complete oversight and administration - the power to manage, monitor, and enhance your organization</p>
            </div>

            {/* Enhanced Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Employees</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalEmployees}</p>
                    <p className="text-sm" style={{color: '#4169E1'}}>Active Staff</p>
                  </div>
                  <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{backgroundColor: '#4169E1', opacity: 0.1}}>
                    <i className="fas fa-users text-xl" style={{color: '#4169E1'}}></i>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Present Today</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.presentToday}</p>
                    <p className="text-sm text-green-600">Attendance Rate: 80%</p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-calendar-check text-green-600 text-xl"></i>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.pendingApprovals}</p>
                    <p className="text-sm text-red-600">Needs Action</p>
                  </div>
                  <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-exclamation-circle text-red-600 text-xl"></i>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">This Month</p>
                    <p className="text-2xl font-bold text-gray-900">₹2.1M</p>
                    <p className="text-sm text-purple-600">Payroll Total</p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-money-bill-wave text-purple-600 text-xl"></i>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick HR Actions */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Quick HR Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button 
                  onClick={() => setActiveTab('leave-approvals')}
                  className="p-4 text-center rounded-lg border-2 transition-all hover:shadow-md"
                  style={{borderColor: '#4169E1', color: '#4169E1'}}
                >
                  <i className="fas fa-check-circle text-2xl mb-2"></i>
                  <p className="text-sm font-medium">Approve Leaves</p>
                </button>
                <button 
                  onClick={() => setActiveTab('payroll-management')}
                  className="bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg p-4 text-center transition-colors"
                >
                  <i className="fas fa-money-bill text-green-600 text-2xl mb-2"></i>
                  <p className="text-sm font-medium text-gray-900">Manage Payroll</p>
                </button>
                <button 
                  onClick={() => setActiveTab('employee-database')}
                  className="bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg p-4 text-center transition-colors"
                >
                  <i className="fas fa-database text-purple-600 text-2xl mb-2"></i>
                  <p className="text-sm font-medium text-gray-900">Employee DB</p>
                </button>
                <button 
                  onClick={() => setActiveTab('company-attendance')}
                  className="bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg p-4 text-center transition-colors"
                >
                  <i className="fas fa-chart-bar text-orange-600 text-2xl mb-2"></i>
                  <p className="text-sm font-medium text-gray-900">Attendance Trends</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Employee Management Tab */}
        {activeTab === 'employee-mgmt' && (
          <div>
            {/* Header with Create Button */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Employee Management</h2>
                <p className="text-gray-600">Create, edit, and manage employee accounts</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={fetchEmployeeList}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center"
                >
                  <i className="fas fa-sync-alt mr-2"></i>
                  Refresh
                </button>
                <button
                  onClick={() => setShowCreateEmployee(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                  style={{backgroundColor: '#4169E1'}}
                >
                  <i className="fas fa-user-plus mr-2"></i>
                  Add New Employee
                </button>
              </div>
            </div>

            {/* Employee List with Actions */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    <i className="fas fa-users mr-2 text-blue-600"></i>
                    Employee Management ({employeeList.length} employees)
                  </h3>
                  <p className="text-sm text-gray-500">Manage employees, credentials, and account status</p>
                </div>
              </div>
              
              {employeeListLoading ? (
                <div className="p-8 text-center">
                  <i className="fas fa-spinner fa-spin text-4xl text-blue-600"></i>
                  <p className="text-gray-500 mt-2">Loading employees...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {employeeList.map((emp) => (
                        <tr key={emp.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-medium text-gray-900">{emp.employee_id}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                                <span className="text-blue-600 font-medium text-sm">{emp.full_name?.charAt(0)}</span>
                              </div>
                              <div>
                                <span className="text-gray-900 font-medium">{emp.full_name}</span>
                                <p className="text-xs text-gray-500">{emp.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-500">{emp.department || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              emp.role === 'HR' ? 'bg-blue-100 text-blue-800' :
                              emp.role === 'Admin' ? 'bg-purple-100 text-purple-800' :
                              emp.role === 'MD' ? 'bg-indigo-100 text-indigo-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {emp.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              emp.account_status === 'Active' ? 'bg-green-100 text-green-800' :
                              emp.account_status === 'Inactive' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {emp.account_status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              {/* Edit Button */}
                              <button
                                onClick={() => setEditEmployeeModal({ show: true, employee: {...emp} })}
                                className="text-blue-600 hover:text-blue-900 text-sm"
                                title="Edit Employee"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              
                              {/* Resend Credentials */}
                              <button
                                onClick={() => handleResendCredentials(emp.employee_id)}
                                disabled={resendingCredentials === emp.employee_id}
                                className="text-green-600 hover:text-green-900 text-sm disabled:opacity-50"
                                title="Resend Credentials"
                              >
                                {resendingCredentials === emp.employee_id ? (
                                  <i className="fas fa-spinner fa-spin"></i>
                                ) : (
                                  <i className="fas fa-envelope"></i>
                                )}
                              </button>
                              
                              {/* Status Toggle */}
                              {emp.account_status === 'Active' ? (
                                <button
                                  onClick={() => handleUpdateEmployeeStatus(emp.employee_id, 'Inactive')}
                                  disabled={employeeActionLoading === emp.employee_id}
                                  className="text-orange-600 hover:text-orange-900 text-sm disabled:opacity-50"
                                  title="Deactivate"
                                >
                                  <i className={employeeActionLoading === emp.employee_id ? 'fas fa-spinner fa-spin' : 'fas fa-user-slash'}></i>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUpdateEmployeeStatus(emp.employee_id, 'Active')}
                                  disabled={employeeActionLoading === emp.employee_id}
                                  className="text-green-600 hover:text-green-900 text-sm disabled:opacity-50"
                                  title="Activate"
                                >
                                  <i className={employeeActionLoading === emp.employee_id ? 'fas fa-spinner fa-spin' : 'fas fa-user-check'}></i>
                                </button>
                              )}
                              
                              {/* Delete Button (Admin/MD only) */}
                              {(user?.role === 'Admin' || user?.role === 'MD') && emp.role !== 'Admin' && emp.role !== 'MD' && (
                                <button
                                  onClick={() => setDeleteConfirmModal({ show: true, employee: emp })}
                                  className="text-red-600 hover:text-red-900 text-sm"
                                  title="Delete Employee"
                                >
                                  <i className="fas fa-trash"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {employeeList.length === 0 && (
                        <tr>
                          <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                            <i className="fas fa-users text-4xl mb-2"></i>
                            <p>No employees found. Click "Add New Employee" to create one.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Edit Employee Modal */}
            {editEmployeeModal.show && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-xl mx-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-900">
                      <i className="fas fa-user-edit text-blue-600 mr-2"></i>
                      Edit Employee
                    </h3>
                    <button onClick={() => setEditEmployeeModal({ show: false, employee: null })} className="text-gray-400 hover:text-gray-600">
                      <i className="fas fa-times text-xl"></i>
                    </button>
                  </div>
                  
                  <form onSubmit={handleUpdateEmployee}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={editEmployeeModal.employee?.full_name || ''}
                          onChange={(e) => setEditEmployeeModal({...editEmployeeModal, employee: {...editEmployeeModal.employee, full_name: e.target.value}})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={editEmployeeModal.employee?.email || ''}
                          onChange={(e) => setEditEmployeeModal({...editEmployeeModal, employee: {...editEmployeeModal.employee, email: e.target.value}})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                        <input
                          type="text"
                          value={editEmployeeModal.employee?.department || ''}
                          onChange={(e) => setEditEmployeeModal({...editEmployeeModal, employee: {...editEmployeeModal.employee, department: e.target.value}})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                        <input
                          type="text"
                          value={editEmployeeModal.employee?.designation || ''}
                          onChange={(e) => setEditEmployeeModal({...editEmployeeModal, employee: {...editEmployeeModal.employee, designation: e.target.value}})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select
                          value={editEmployeeModal.employee?.role || ''}
                          onChange={(e) => setEditEmployeeModal({...editEmployeeModal, employee: {...editEmployeeModal.employee, role: e.target.value}})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="Employee">Employee</option>
                          <option value="HR">HR</option>
                          <option value="Admin">Admin</option>
                          <option value="MD">MD</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Shift</label>
                        <select
                          value={editEmployeeModal.employee?.shift || ''}
                          onChange={(e) => setEditEmployeeModal({...editEmployeeModal, employee: {...editEmployeeModal.employee, shift: e.target.value}})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="General">General</option>
                          <option value="Morning">Morning</option>
                          <option value="Evening">Evening</option>
                          <option value="Night">Night</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-3 mt-6">
                      <button type="button" onClick={() => setEditEmployeeModal({ show: false, employee: null })} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
                      <button type="submit" disabled={employeeActionLoading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50" style={{backgroundColor: '#4169E1'}}>
                        {employeeActionLoading ? <><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</> : <><i className="fas fa-save mr-2"></i>Save Changes</>}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Delete Confirm Modal */}
            {deleteConfirmModal.show && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
                  <div className="text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                      <i className="fas fa-exclamation-triangle text-red-600 text-xl"></i>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Employee</h3>
                    <p className="text-gray-500 mb-4">
                      Are you sure you want to permanently delete <strong>{deleteConfirmModal.employee?.full_name}</strong>?
                      This action cannot be undone.
                    </p>
                    <div className="flex justify-center gap-3">
                      <button onClick={() => setDeleteConfirmModal({ show: false, employee: null })} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
                      <button onClick={handleDeleteEmployee} disabled={employeeActionLoading} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
                        {employeeActionLoading ? <><i className="fas fa-spinner fa-spin mr-2"></i>Deleting...</> : <><i className="fas fa-trash mr-2"></i>Delete</>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Create Employee Modal */}
            {showCreateEmployee && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-900">
                      <i className="fas fa-user-plus text-blue-600 mr-2"></i>
                      Add New Employee
                    </h3>
                    <button
                      onClick={() => setShowCreateEmployee(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <i className="fas fa-times text-xl"></i>
                    </button>
                  </div>

                  <form onSubmit={handleCreateEmployee}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Employee ID */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Employee ID <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newEmployee.employee_id}
                          onChange={(e) => setNewEmployee({...newEmployee, employee_id: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., EMP001"
                          required
                        />
                      </div>

                      {/* Full Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newEmployee.full_name}
                          onChange={(e) => setNewEmployee({...newEmployee, full_name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter full name"
                          required
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={newEmployee.email}
                          onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          placeholder="employee@company.com"
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          <i className="fas fa-info-circle mr-1"></i>
                          Login credentials will be sent to this email
                        </p>
                      </div>

                      {/* Role */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select
                          value={newEmployee.role}
                          onChange={(e) => setNewEmployee({...newEmployee, role: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="Employee">Employee</option>
                          <option value="HR">HR</option>
                          <option value="Admin">Admin</option>
                          <option value="MD">MD</option>
                        </select>
                      </div>

                      {/* Department */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                        <input
                          type="text"
                          value={newEmployee.department}
                          onChange={(e) => setNewEmployee({...newEmployee, department: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., Engineering"
                        />
                      </div>

                      {/* Designation */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                        <input
                          type="text"
                          value={newEmployee.designation}
                          onChange={(e) => setNewEmployee({...newEmployee, designation: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., Software Engineer"
                        />
                      </div>

                      {/* Employee Category */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Employee Category</label>
                        <select
                          value={newEmployee.employee_category}
                          onChange={(e) => setNewEmployee({...newEmployee, employee_category: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="S001">S001 - Staff (12 leaves)</option>
                          <option value="W001">W001 - Workers (6 leaves)</option>
                          <option value="M001">M001 - Migrants (0 leaves)</option>
                          <option value="T001">T001 - Trainees (0 leaves)</option>
                        </select>
                      </div>

                      {/* Shift */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Shift</label>
                        <select
                          value={newEmployee.shift}
                          onChange={(e) => setNewEmployee({...newEmployee, shift: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="General">General (9AM - 6PM)</option>
                          <option value="Morning">Morning (6AM - 2PM)</option>
                          <option value="Evening">Evening (2PM - 10PM)</option>
                          <option value="Night">Night (10PM - 6AM)</option>
                        </select>
                      </div>

                      {/* Hire Date */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date</label>
                        <input
                          type="date"
                          value={newEmployee.hire_date}
                          onChange={(e) => setNewEmployee({...newEmployee, hire_date: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Info Box */}
                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        <i className="fas fa-envelope mr-2"></i>
                        <strong>Email Notification:</strong> A welcome email with login credentials will be automatically sent to the employee's email address.
                      </p>
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end gap-3 mt-6">
                      <button
                        type="button"
                        onClick={() => setShowCreateEmployee(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={createEmployeeLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        style={{backgroundColor: '#4169E1'}}
                      >
                        {createEmployeeLoading ? (
                          <><i className="fas fa-spinner fa-spin mr-2"></i>Creating...</>
                        ) : (
                          <><i className="fas fa-save mr-2"></i>Create Employee</>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'employee-master' && (
          <EmployeeManagement />
        )}

        {activeTab === 'company-attendance' && (
          <div>
            {/* Filters Section */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                  <input
                    type="date"
                    value={attendanceFilters.date_from}
                    onChange={(e) => setAttendanceFilters({...attendanceFilters, date_from: e.target.value})}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                  <input
                    type="date"
                    value={attendanceFilters.date_to}
                    onChange={(e) => setAttendanceFilters({...attendanceFilters, date_to: e.target.value})}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={attendanceFilters.department}
                    onChange={(e) => setAttendanceFilters({...attendanceFilters, department: e.target.value})}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="all">All Departments</option>
                    {filterOptions.departments?.map(dept => (
                      <option key={dept.id} value={dept.dept_name}>{dept.dept_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shift</label>
                  <select
                    value={attendanceFilters.shift}
                    onChange={(e) => setAttendanceFilters({...attendanceFilters, shift: e.target.value})}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="all">All Shifts</option>
                    {filterOptions.shifts?.map(shift => (
                      <option key={shift} value={shift}>{shift}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={attendanceFilters.status}
                    onChange={(e) => setAttendanceFilters({...attendanceFilters, status: e.target.value})}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="all">All Status</option>
                    {filterOptions.statuses?.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={fetchHrAttendance}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  style={{backgroundColor: '#4169E1'}}
                >
                  <i className="fas fa-search mr-2"></i>Apply Filters
                </button>
                <button
                  onClick={() => setAddAttendanceModal({ show: true })}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <i className="fas fa-plus mr-2"></i>Add Record
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-100 mr-4">
                    <i className="fas fa-users text-blue-600"></i>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Records</p>
                    <p className="text-2xl font-bold text-gray-900">{hrAttendance.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-green-100 mr-4">
                    <i className="fas fa-check-circle text-green-600"></i>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Present</p>
                    <p className="text-2xl font-bold text-green-600">{hrAttendance.filter(a => a.status === 'Present').length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-orange-100 mr-4">
                    <i className="fas fa-clock text-orange-600"></i>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Late</p>
                    <p className="text-2xl font-bold text-orange-600">{hrAttendance.filter(a => a.is_late).length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-red-100 mr-4">
                    <i className="fas fa-times-circle text-red-600"></i>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Absent</p>
                    <p className="text-2xl font-bold text-red-600">{hrAttendance.filter(a => a.status === 'Absent').length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Attendance Records</h3>
                <span className="text-sm text-gray-500">{hrAttendance.length} records</span>
              </div>
              
              {hrAttendanceLoading ? (
                <div className="p-8 text-center">
                  <i className="fas fa-spinner fa-spin text-4xl text-blue-600"></i>
                  <p className="text-gray-500 mt-2">Loading attendance...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock In</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock Out</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {hrAttendance.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{record.full_name}</div>
                            <div className="text-sm text-gray-500">{record.employee_id}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.department || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.date}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              record.status === 'Present' ? 'bg-green-100 text-green-800' :
                              record.status === 'Late' ? 'bg-orange-100 text-orange-800' :
                              record.status === 'Half-Day' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {record.status}
                              {record.is_late === 1 && record.status === 'Present' && <span className="ml-1">(Late)</span>}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.clock_in || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.clock_out || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.hours_worked ? `${record.hours_worked}h` : '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setEditAttendanceModal({ show: true, record });
                                setAttendanceFormData({
                                  clock_in: record.clock_in || '',
                                  clock_out: record.clock_out || '',
                                  status: record.status,
                                  notes: record.notes || ''
                                });
                              }}
                              className="text-blue-600 hover:text-blue-900 text-sm"
                              title="Edit"
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {hrAttendance.length === 0 && (
                        <tr>
                          <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                            <i className="fas fa-calendar-times text-4xl mb-2"></i>
                            <p>No attendance records found for the selected filters.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Edit Attendance Modal */}
            {editAttendanceModal.show && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      <i className="fas fa-edit text-blue-600 mr-2"></i>
                      Edit Attendance
                    </h3>
                    <button onClick={() => setEditAttendanceModal({ show: false, record: null })} className="text-gray-400 hover:text-gray-600">
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                  
                  <form onSubmit={handleModifyAttendance}>
                    <div className="mb-3">
                      <p className="text-sm text-gray-600">
                        <strong>Employee:</strong> {editAttendanceModal.record?.full_name} ({editAttendanceModal.record?.employee_id})
                      </p>
                      <p className="text-sm text-gray-600"><strong>Date:</strong> {editAttendanceModal.record?.date}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Clock In</label>
                        <input
                          type="time"
                          value={attendanceFormData.clock_in}
                          onChange={(e) => setAttendanceFormData({...attendanceFormData, clock_in: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Clock Out</label>
                        <input
                          type="time"
                          value={attendanceFormData.clock_out}
                          onChange={(e) => setAttendanceFormData({...attendanceFormData, clock_out: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={attendanceFormData.status}
                        onChange={(e) => setAttendanceFormData({...attendanceFormData, status: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                        <option value="Late">Late</option>
                        <option value="Half-Day">Half-Day</option>
                        <option value="On Leave">On Leave</option>
                      </select>
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={attendanceFormData.notes}
                        onChange={(e) => setAttendanceFormData({...attendanceFormData, notes: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        rows="2"
                        placeholder="Reason for modification..."
                      ></textarea>
                    </div>
                    
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setEditAttendanceModal({ show: false, record: null })} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
                      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" style={{backgroundColor: '#4169E1'}}>
                        <i className="fas fa-save mr-2"></i>Save Changes
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Add Attendance Modal */}
            {addAttendanceModal.show && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      <i className="fas fa-plus text-green-600 mr-2"></i>
                      Add Attendance Record
                    </h3>
                    <button onClick={() => setAddAttendanceModal({ show: false })} className="text-gray-400 hover:text-gray-600">
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                  
                  <form onSubmit={handleAddAttendance}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                      <input
                        type="text"
                        value={attendanceFormData.employee_id}
                        onChange={(e) => setAttendanceFormData({...attendanceFormData, employee_id: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="e.g., 1012"
                        required
                      />
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={attendanceFormData.date}
                        onChange={(e) => setAttendanceFormData({...attendanceFormData, date: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Clock In</label>
                        <input
                          type="time"
                          value={attendanceFormData.clock_in}
                          onChange={(e) => setAttendanceFormData({...attendanceFormData, clock_in: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Clock Out</label>
                        <input
                          type="time"
                          value={attendanceFormData.clock_out}
                          onChange={(e) => setAttendanceFormData({...attendanceFormData, clock_out: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={attendanceFormData.status}
                        onChange={(e) => setAttendanceFormData({...attendanceFormData, status: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                        <option value="Late">Late</option>
                        <option value="Half-Day">Half-Day</option>
                        <option value="On Leave">On Leave</option>
                      </select>
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={attendanceFormData.notes}
                        onChange={(e) => setAttendanceFormData({...attendanceFormData, notes: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        rows="2"
                        placeholder="Optional notes..."
                      ></textarea>
                    </div>
                    
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setAddAttendanceModal({ show: false })} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
                      <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                        <i className="fas fa-plus mr-2"></i>Add Record
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'payroll-management' && (
          <div>
            {/* Header with Month Selector and Process Button */}
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Payroll Management</h2>
                <p className="text-gray-600">Calculate salaries based on attendance, leaves & overtime</p>
              </div>
              <div className="flex gap-3 items-center">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Month</label>
                  <input
                    type="month"
                    value={payrollMonth}
                    onChange={(e) => setPayrollMonth(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <button
                  onClick={() => fetchPayrollData(payrollMonth)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 mt-6"
                >
                  <i className="fas fa-sync-alt mr-2"></i>Refresh
                </button>
                <button
                  onClick={handleProcessPayroll}
                  disabled={processingPayroll}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 mt-6"
                >
                  {processingPayroll ? (
                    <><i className="fas fa-spinner fa-spin mr-2"></i>Processing...</>
                  ) : (
                    <><i className="fas fa-calculator mr-2"></i>Process Payroll</>
                  )}
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            {payrollSummary && (
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow-md p-4">
                  <p className="text-sm text-gray-500">Employees</p>
                  <p className="text-2xl font-bold text-blue-600">{payrollSummary.total_employees}</p>
                </div>
                <div className="bg-white rounded-lg shadow-md p-4">
                  <p className="text-sm text-gray-500">Total Basic</p>
                  <p className="text-xl font-bold text-gray-700">₹{payrollSummary.total_basic?.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg shadow-md p-4">
                  <p className="text-sm text-gray-500">Allowances</p>
                  <p className="text-xl font-bold text-purple-600">₹{payrollSummary.total_allowances?.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg shadow-md p-4">
                  <p className="text-sm text-gray-500">Overtime</p>
                  <p className="text-xl font-bold text-orange-600">₹{payrollSummary.total_overtime?.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg shadow-md p-4">
                  <p className="text-sm text-gray-500">Deductions</p>
                  <p className="text-xl font-bold text-red-600">₹{payrollSummary.total_deductions?.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg shadow-md p-4">
                  <p className="text-sm text-gray-500">Net Payroll</p>
                  <p className="text-xl font-bold text-green-600">₹{payrollSummary.total_net_pay?.toLocaleString()}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Payroll Table */}
              <div className="lg:col-span-2 bg-white rounded-lg shadow-md">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    <i className="fas fa-file-invoice-dollar mr-2 text-blue-600"></i>
                    Payroll for {payrollMonth}
                  </h3>
                </div>
                
                {payrollLoading ? (
                  <div className="p-8 text-center">
                    <i className="fas fa-spinner fa-spin text-4xl text-blue-600"></i>
                    <p className="text-gray-500 mt-2">Loading payroll data...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Basic</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Allowances</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Overtime</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deductions</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Pay</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {payrollData.map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{record.full_name}</div>
                              <div className="text-xs text-gray-500">{record.employee_id}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{record.department || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">₹{record.basic_salary?.toLocaleString()}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-purple-600">₹{record.allowances?.toLocaleString()}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-orange-600">₹{record.overtime_pay?.toLocaleString()}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-600">₹{record.deductions?.toLocaleString()}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-green-600">₹{record.net_pay?.toLocaleString()}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <button
                                onClick={() => handleViewPayslip(record.employee_id)}
                                className="text-blue-600 hover:text-blue-900 text-sm"
                                title="View Payslip"
                              >
                                <i className="fas fa-file-alt"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                        {payrollData.length === 0 && (
                          <tr>
                            <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                              <i className="fas fa-calculator text-4xl mb-2"></i>
                              <p>No payroll data for {payrollMonth}.</p>
                              <p className="text-sm">Click "Process Payroll" to calculate salaries.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Salary Configuration */}
              <div className="bg-white rounded-lg shadow-md">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    <i className="fas fa-cog mr-2 text-gray-600"></i>
                    Salary Configuration
                  </h3>
                  <p className="text-sm text-gray-500">Set base salary for employees</p>
                </div>
                <div className="overflow-y-auto max-h-96">
                  {salaryConfigs.map((emp) => (
                    <div key={emp.employee_id} className="px-4 py-3 border-b hover:bg-gray-50 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{emp.full_name}</p>
                        <p className="text-xs text-gray-500">{emp.department || 'No Dept'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-green-600">
                          ₹{(emp.basic_salary || 0).toLocaleString()}
                        </span>
                        <button
                          onClick={() => setEditSalaryModal({ show: true, employee: {...emp} })}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit Salary"
                        >
                          <i className="fas fa-edit text-sm"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                  {salaryConfigs.length === 0 && (
                    <div className="p-4 text-center text-gray-500">
                      <p>No employees found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Payroll Info Box */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">
                <i className="fas fa-info-circle mr-2"></i>Payroll Calculation Formula
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                <div>
                  <p><strong>Earnings:</strong></p>
                  <ul className="list-disc list-inside ml-2">
                    <li>Basic Salary (per day × days worked)</li>
                    <li>HRA (10% of basic)</li>
                    <li>Conveyance: ₹1,600</li>
                    <li>Medical: ₹1,250</li>
                    <li>Overtime: 1.5× hourly rate</li>
                  </ul>
                </div>
                <div>
                  <p><strong>Deductions:</strong></p>
                  <ul className="list-disc list-inside ml-2">
                    <li>PF: 12% of basic (max ₹15,000 base)</li>
                    <li>Professional Tax: ₹200</li>
                    <li>LOP: Per day deduction</li>
                    <li>Absent Days: Per day deduction</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Edit Salary Modal */}
            {editSalaryModal.show && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      <i className="fas fa-rupee-sign text-green-600 mr-2"></i>
                      Edit Salary
                    </h3>
                    <button onClick={() => setEditSalaryModal({ show: false, employee: null })} className="text-gray-400 hover:text-gray-600">
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                  
                  <form onSubmit={handleUpdateSalary}>
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">
                        <strong>Employee:</strong> {editSalaryModal.employee?.full_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Department:</strong> {editSalaryModal.employee?.department || 'N/A'}
                      </p>
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Basic Salary (₹)</label>
                      <input
                        type="number"
                        value={editSalaryModal.employee?.basic_salary || ''}
                        onChange={(e) => setEditSalaryModal({
                          ...editSalaryModal,
                          employee: {...editSalaryModal.employee, basic_salary: parseFloat(e.target.value) || 0}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="e.g., 50000"
                        min="0"
                        step="100"
                      />
                    </div>
                    
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setEditSalaryModal({ show: false, employee: null })} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
                      <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                        <i className="fas fa-save mr-2"></i>Save
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Payslip Modal */}
            {payslipModal.show && payslipModal.data && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 my-8">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      <i className="fas fa-file-invoice-dollar text-blue-600 mr-2"></i>
                      Payslip - {payslipModal.data.month}
                    </h3>
                    <div className="flex gap-2">
                      <button onClick={handleDownloadPayslip} className="text-green-600 hover:text-green-800" title="Download">
                        <i className="fas fa-download text-xl"></i>
                      </button>
                      <button onClick={() => setPayslipModal({ show: false, data: null })} className="text-gray-400 hover:text-gray-600">
                        <i className="fas fa-times text-xl"></i>
                      </button>
                    </div>
                  </div>
                  
                  {/* Company Header */}
                  <div className="text-center border-b pb-4 mb-4">
                    <h2 className="text-xl font-bold text-gray-900">{payslipModal.data.company_name}</h2>
                    <p className="text-sm text-gray-600">Payslip for {payslipModal.data.month}</p>
                  </div>
                  
                  {/* Employee Details */}
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <p><strong>Employee ID:</strong> {payslipModal.data.employee.employee_id}</p>
                      <p><strong>Name:</strong> {payslipModal.data.employee.name}</p>
                    </div>
                    <div>
                      <p><strong>Department:</strong> {payslipModal.data.employee.department || 'N/A'}</p>
                      <p><strong>Designation:</strong> {payslipModal.data.employee.designation || 'N/A'}</p>
                    </div>
                  </div>
                  
                  {/* Attendance Summary */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <h4 className="font-medium text-gray-700 mb-2">Attendance Summary</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div><strong>Working Days:</strong> {payslipModal.data.attendance.working_days}</div>
                      <div><strong>Days Worked:</strong> {payslipModal.data.attendance.days_worked}</div>
                      <div><strong>Leave Days:</strong> {payslipModal.data.attendance.leave_days}</div>
                    </div>
                  </div>
                  
                  {/* Earnings & Deductions */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="border rounded-lg p-3">
                      <h4 className="font-medium text-green-700 mb-2 border-b pb-1">Earnings</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span>Basic Salary</span><span>₹{payslipModal.data.earnings.basic_salary?.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>HRA</span><span>₹{payslipModal.data.earnings.hra?.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Conveyance</span><span>₹{payslipModal.data.earnings.conveyance_allowance?.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Medical</span><span>₹{payslipModal.data.earnings.medical_allowance?.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Overtime</span><span>₹{payslipModal.data.earnings.overtime_pay?.toLocaleString()}</span></div>
                        <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Total Earnings</span><span className="text-green-600">₹{payslipModal.data.earnings.total_earnings?.toLocaleString()}</span></div>
                      </div>
                    </div>
                    <div className="border rounded-lg p-3">
                      <h4 className="font-medium text-red-700 mb-2 border-b pb-1">Deductions</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span>Provident Fund</span><span>₹{payslipModal.data.deductions.provident_fund?.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Professional Tax</span><span>₹{payslipModal.data.deductions.professional_tax?.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>LOP Deduction</span><span>₹{payslipModal.data.deductions.lop_deduction?.toLocaleString()}</span></div>
                        <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Total Deductions</span><span className="text-red-600">₹{payslipModal.data.deductions.total_deductions?.toLocaleString()}</span></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Net Pay */}
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-600">Net Pay</p>
                    <p className="text-3xl font-bold text-green-600">₹{payslipModal.data.net_pay?.toLocaleString()}</p>
                  </div>
                  
                  <p className="text-xs text-gray-400 text-center mt-4">This is a computer-generated payslip</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'document-review' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Document Review Center</h2>
              <p className="text-gray-600">Review and manage employee submitted documents</p>
            </div>

            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Pending Document Reviews</h3>
                  <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">8 Pending</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {[
                      { name: 'Ananya Murugaiyan', docType: 'Medical Certificate', submitted: '2 hours ago', status: 'pending' },
                      { name: 'Rohit Kumar', docType: 'Expense Receipt', submitted: '5 hours ago', status: 'pending' },
                      { name: 'Priya Shah', docType: 'Training Certificate', submitted: '1 day ago', status: 'pending' },
                      { name: 'Vikram Singh', docType: 'Address Proof', submitted: '2 days ago', status: 'pending' }
                    ].map((doc, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{doc.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{doc.docType}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.submitted}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Pending Review
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button className="text-blue-600 hover:text-blue-900">View</button>
                          <button className="text-green-600 hover:text-green-900">Approve</button>
                          <button className="text-red-600 hover:text-red-900">Reject</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leave-approvals' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Leave Approval Center</h2>
              <p className="text-gray-600">Review and approve employee leave requests</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Pending Approvals</h3>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">{stats.pendingApprovals}</div>
                  <p className="text-sm text-gray-600">Requests awaiting review</p>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Filter by Status</h3>
                <div className="flex flex-wrap gap-2">
                  {['Pending', 'Approved', 'Rejected', ''].map((status) => (
                    <button
                      key={status || 'All'}
                      onClick={() => {
                        setLeaveFilter(status);
                        fetchPendingLeaves(status);
                      }}
                      className={`px-3 py-1 rounded-full text-sm ${
                        leaveFilter === status 
                          ? 'text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      style={leaveFilter === status ? {backgroundColor: '#4169E1'} : {}}
                    >
                      {status || 'All'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Leave Types Legend</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center"><span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>CL - Casual Leave</div>
                  <div className="flex items-center"><span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>SL - Sick Leave</div>
                  <div className="flex items-center"><span className="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>EL - Earned Leave</div>
                  <div className="flex items-center"><span className="w-3 h-3 bg-orange-500 rounded-full mr-2"></span>LOP - Loss of Pay</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Leave Requests ({pendingLeaves.length})</h3>
                <button 
                  onClick={() => fetchPendingLeaves(leaveFilter)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  <i className="fas fa-sync-alt mr-1"></i>Refresh
                </button>
              </div>
              <div className="overflow-x-auto">
                {pendingLeaves.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <i className="fas fa-inbox text-4xl mb-3 text-gray-300"></i>
                    <p>No {leaveFilter.toLowerCase()} leave requests found</p>
                  </div>
                ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pendingLeaves.map((leave) => (
                      <tr key={leave.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{leave.employee_name}</div>
                          <div className="text-xs text-gray-500">{leave.department} • {leave.category}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            leave.leave_type === 'CL' ? 'bg-blue-100 text-blue-800' :
                            leave.leave_type === 'SL' ? 'bg-green-100 text-green-800' :
                            leave.leave_type === 'EL' ? 'bg-purple-100 text-purple-800' :
                            leave.leave_type === 'LOP' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {leave.leave_type_name || leave.leave_type}
                          </span>
                          {leave.is_half_day && (
                            <span className="ml-1 text-xs text-gray-500">½</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {leave.start_date}
                          {leave.start_date !== leave.end_date && <span> to {leave.end_date}</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {leave.days_requested}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={leave.reason}>
                          {leave.reason}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            leave.status === 'Approved' ? 'bg-green-100 text-green-800' :
                            leave.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                            leave.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {leave.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          {leave.status === 'Pending' ? (
                            <>
                              <button 
                                onClick={() => handleApproveLeave(leave.id)}
                                disabled={processingLeave === leave.id}
                                className="text-white px-3 py-1 rounded text-xs transition-colors disabled:opacity-50"
                                style={{backgroundColor: '#4169E1'}}
                              >
                                {processingLeave === leave.id ? '...' : 'Approve'}
                              </button>
                              <button 
                                onClick={() => setRejectModal({ show: true, leaveId: leave.id, reason: '' })}
                                disabled={processingLeave === leave.id}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs transition-colors disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-gray-400 text-xs">Processed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                )}
              </div>
            </div>
            
            {/* Reject Modal */}
            {rejectModal.show && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Reject Leave Request</h3>
                  <p className="text-sm text-gray-600 mb-4">Please provide a reason for rejection:</p>
                  <textarea
                    value={rejectModal.reason}
                    onChange={(e) => setRejectModal({...rejectModal, reason: e.target.value})}
                    className="w-full border border-gray-300 rounded-md p-3 mb-4"
                    rows={3}
                    placeholder="Enter rejection reason..."
                  ></textarea>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setRejectModal({ show: false, leaveId: null, reason: '' })}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRejectLeave}
                      disabled={processingLeave !== null}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded disabled:opacity-50"
                    >
                      {processingLeave ? 'Processing...' : 'Confirm Reject'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'meal-reports' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Daily Meal Reports 🍽️</h2>
              <p className="text-gray-600">Track meal token usage and generate daily meal reports by shift</p>
            </div>

            {/* Today's Meal Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-r from-orange-400 to-orange-500 rounded-lg shadow-md p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Breakfast (Shift 3)</p>
                    <p className="text-3xl font-bold">12</p>
                    <p className="text-xs opacity-80">tokens issued today</p>
                  </div>
                  <div className="text-4xl opacity-80">🌅</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-lg shadow-md p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Lunch (Shift 1)</p>
                    <p className="text-3xl font-bold">45</p>
                    <p className="text-xs opacity-80">tokens issued today</p>
                  </div>
                  <div className="text-4xl opacity-80">☀️</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-lg shadow-md p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Dinner (Shift 2)</p>
                    <p className="text-3xl font-bold">28</p>
                    <p className="text-xs opacity-80">tokens issued today</p>
                  </div>
                  <div className="text-4xl opacity-80">🌙</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-green-400 to-green-500 rounded-lg shadow-md p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Total Today</p>
                    <p className="text-3xl font-bold">85</p>
                    <p className="text-xs opacity-80">total meals served</p>
                  </div>
                  <div className="text-4xl opacity-80">📊</div>
                </div>
              </div>
            </div>

            {/* Category-wise Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Eligible vs Issued Today</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Workers (W001)</span>
                      <span className="font-medium">42/50 tokens used</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{width: '84%'}}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Migrants (M001)</span>
                      <span className="font-medium">28/35 tokens used</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full" style={{width: '80%'}}></div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500">
                    <span className="inline-block w-3 h-3 bg-gray-300 rounded mr-2"></span>
                    Staff (S001) & Trainees (T001) are not eligible for meal tokens
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Token Status Overview</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center">
                      <span className="w-3 h-3 bg-green-500 rounded-full mr-3"></span>
                      <span className="text-gray-700">Used Tokens</span>
                    </div>
                    <span className="font-bold text-green-600">68</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-center">
                      <span className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></span>
                      <span className="text-gray-700">Pending Tokens</span>
                    </div>
                    <span className="font-bold text-yellow-600">17</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center">
                      <span className="w-3 h-3 bg-red-500 rounded-full mr-3"></span>
                      <span className="text-gray-700">Cancelled/Expired</span>
                    </div>
                    <span className="font-bold text-red-600">3</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Token List */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Today's Meal Tokens</h3>
                  <div className="flex space-x-3">
                    <select className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="all">All Shifts</option>
                      <option value="1">Shift 1 - Lunch</option>
                      <option value="2">Shift 2 - Dinner</option>
                      <option value="3">Shift 3 - Breakfast</option>
                    </select>
                    <select className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="all">All Categories</option>
                      <option value="W001">Workers (W001)</option>
                      <option value="M001">Migrants (M001)</option>
                    </select>
                    <button 
                      className="text-white px-4 py-2 rounded-md transition-colors flex items-center"
                      style={{backgroundColor: '#4169E1'}}
                    >
                      <i className="fas fa-download mr-2"></i>
                      Export Report
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meal Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Used At</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {[
                      { tokenId: 'MTK-20251027-001', employee: 'Ajith.B', empId: '1012', category: 'W001', shift: 1, meal: 'Lunch', status: 'Used', usedAt: '12:35 PM' },
                      { tokenId: 'MTK-20251027-002', employee: 'Akhil.S', empId: '1002', category: 'W001', shift: 1, meal: 'Lunch', status: 'Used', usedAt: '12:42 PM' },
                      { tokenId: 'MTK-20251027-003', employee: 'Baby', empId: '1006', category: 'M001', shift: 2, meal: 'Dinner', status: 'Pending', usedAt: '-' },
                      { tokenId: 'MTK-20251027-004', employee: 'Balaji.T', empId: '1010', category: 'W001', shift: 3, meal: 'Breakfast', status: 'Used', usedAt: '07:15 AM' },
                      { tokenId: 'MTK-20251027-005', employee: 'Rajesh.P', empId: '1015', category: 'M001', shift: 1, meal: 'Lunch', status: 'Cancelled', usedAt: '-' },
                    ].map((token, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono text-sm text-blue-600">{token.tokenId}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{token.employee}</div>
                          <div className="text-xs text-gray-500">ID: {token.empId}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            token.category === 'W001' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {token.category === 'W001' ? 'Worker' : 'Migrant'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          Shift {token.shift}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center text-sm ${
                            token.meal === 'Breakfast' ? 'text-orange-600' :
                            token.meal === 'Lunch' ? 'text-yellow-600' : 'text-indigo-600'
                          }`}>
                            {token.meal === 'Breakfast' && '🌅'}
                            {token.meal === 'Lunch' && '☀️'}
                            {token.meal === 'Dinner' && '🌙'}
                            <span className="ml-1">{token.meal}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            token.status === 'Used' ? 'bg-green-100 text-green-800' :
                            token.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {token.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {token.usedAt}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button className="text-blue-600 hover:text-blue-900 mr-3">
                            <i className="fas fa-eye"></i>
                          </button>
                          {token.status === 'Pending' && (
                            <button className="text-green-600 hover:text-green-900 mr-3">
                              <i className="fas fa-check"></i>
                            </button>
                          )}
                          {token.status !== 'Used' && (
                            <button className="text-red-600 hover:text-red-900">
                              <i className="fas fa-times"></i>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>Showing 5 of 85 tokens</span>
                  <div className="flex space-x-2">
                    <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100">Previous</button>
                    <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100">Next</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'employee-database' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Employee Database</h2>
              <p className="text-gray-600">Complete employee information and management</p>
            </div>

            <div className="bg-white rounded-lg shadow-md mb-6">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">All Employees</h3>
                  <button 
                    className="text-white px-4 py-2 rounded-md transition-colors"
                    style={{backgroundColor: '#4169E1'}}
                  >
                    Add New Employee
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <input 
                    type="text" 
                    placeholder="Search employees..." 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Designation</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Join Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {employees.slice(0, 10).map((employee) => (
                        <tr key={employee.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <span className="text-sm font-medium text-blue-600">
                                  {employee.name.split(' ').map(n => n[0]).join('')}
                                </span>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                                <div className="text-sm text-gray-500">{employee.empId}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.department}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.designation}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.joinDate}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Active
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <button className="text-blue-600 hover:text-blue-900">View</button>
                            <button className="text-green-600 hover:text-green-900">Edit</button>
                            <button className="text-red-600 hover:text-red-900">Deactivate</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'designations' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Designation Management</h2>
              <p className="text-gray-600">Manage job roles and organizational structure</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Add New Designation */}
              <div className="bg-white rounded-lg shadow-md">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Add New Designation</h3>
                </div>
                <div className="p-6">
                  <form className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Designation Title</label>
                      <input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="e.g., Senior Software Engineer" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Department</label>
                      <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                        <option>Engineering</option>
                        <option>HR</option>
                        <option>Admin</option>
                        <option>Finance</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Salary Range</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" placeholder="Min" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                        <input type="number" placeholder="Max" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Job Description</label>
                      <textarea rows="3" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"></textarea>
                    </div>
                    <button 
                      type="submit" 
                      className="w-full text-white py-2 px-4 rounded-md transition-colors"
                      style={{backgroundColor: '#4169E1'}}
                    >
                      Create Designation
                    </button>
                  </form>
                </div>
              </div>

              {/* Existing Designations */}
              <div className="bg-white rounded-lg shadow-md">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Current Designations</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {[
                      { title: 'Software Engineer', dept: 'Engineering', employees: 8, salaryRange: '₹40k - ₹80k' },
                      { title: 'Senior Software Engineer', dept: 'Engineering', employees: 5, salaryRange: '₹80k - ₹1.2L' },
                      { title: 'HR Manager', dept: 'HR', employees: 1, salaryRange: '₹60k - ₹90k' },
                      { title: 'Admin Officer', dept: 'Admin', employees: 3, salaryRange: '₹30k - ₹50k' },
                      { title: 'Finance Executive', dept: 'Finance', employees: 2, salaryRange: '₹45k - ₹70k' }
                    ].map((designation, index) => (
                      <div key={index} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-gray-900">{designation.title}</h4>
                            <p className="text-sm text-gray-600">{designation.dept} • {designation.employees} employees</p>
                            <p className="text-sm text-green-600">{designation.salaryRange}</p>
                          </div>
                          <div className="flex space-x-2">
                            <button className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
                            <button className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
                <p className="text-gray-600">Generate and export attendance and leave reports</p>
              </div>
            </div>

            {/* Report Type Selector */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
                  <select
                    value={reportType}
                    onChange={(e) => {
                      setReportType(e.target.value);
                      setReportData(null);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="attendance">Attendance Report</option>
                    <option value="leaves">Leave Report</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                  <input
                    type="date"
                    value={reportFilters.date_from}
                    onChange={(e) => setReportFilters({...reportFilters, date_from: e.target.value})}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                  <input
                    type="date"
                    value={reportFilters.date_to}
                    onChange={(e) => setReportFilters({...reportFilters, date_to: e.target.value})}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={reportFilters.department}
                    onChange={(e) => setReportFilters({...reportFilters, department: e.target.value})}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="all">All Departments</option>
                    {filterOptions.departments?.map(dept => (
                      <option key={dept.id} value={dept.dept_name}>{dept.dept_name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => fetchReport(reportType)}
                  disabled={reportLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  style={{backgroundColor: '#4169E1'}}
                >
                  {reportLoading ? (
                    <><i className="fas fa-spinner fa-spin mr-2"></i>Generating...</>
                  ) : (
                    <><i className="fas fa-chart-bar mr-2"></i>Generate Report</>
                  )}
                </button>
                <button
                  onClick={() => handleExportCSV(reportType)}
                  disabled={!reportData}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  <i className="fas fa-file-csv mr-2"></i>Export CSV
                </button>
              </div>
            </div>

            {/* Report Content */}
            {reportData && (
              <div className="bg-white rounded-lg shadow-md">
                {reportType === 'attendance' ? (
                  <>
                    {/* Attendance Report Summary */}
                    <div className="p-4 border-b bg-gray-50">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Attendance Summary</h3>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="bg-white p-3 rounded border">
                          <p className="text-sm text-gray-600">Total Employees</p>
                          <p className="text-2xl font-bold text-blue-600">{reportData.summary?.total_employees || 0}</p>
                        </div>
                        <div className="bg-white p-3 rounded border">
                          <p className="text-sm text-gray-600">Total Present</p>
                          <p className="text-2xl font-bold text-green-600">{reportData.summary?.total_present || 0}</p>
                        </div>
                        <div className="bg-white p-3 rounded border">
                          <p className="text-sm text-gray-600">Total Absent</p>
                          <p className="text-2xl font-bold text-red-600">{reportData.summary?.total_absent || 0}</p>
                        </div>
                        <div className="bg-white p-3 rounded border">
                          <p className="text-sm text-gray-600">Avg Hours/Day</p>
                          <p className="text-2xl font-bold text-purple-600">{reportData.summary?.avg_hours_all || 0}h</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Attendance Report Table */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Present Days</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Absent Days</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Late Days</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Hours</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {reportData.report?.map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{row.full_name}</div>
                                <div className="text-sm text-gray-500">{row.employee_id}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.department || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">{row.present_days || 0}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">{row.absent_days || 0}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800">{row.late_days || 0}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.avg_hours || 0}h</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.total_hours || 0}h</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Leave Report Summary */}
                    <div className="p-4 border-b bg-gray-50">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Leave Summary by Type</h3>
                      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                        {reportData.summary_by_type?.map((item, idx) => (
                          <div key={idx} className="bg-white p-3 rounded border">
                            <p className="text-sm text-gray-600">{item.leave_type}</p>
                            <p className="text-xl font-bold text-blue-600">{item.count}</p>
                            <p className="text-xs text-gray-500">{item.total_days} days</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Leave Report Table */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leave Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applied On</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {reportData.leaves?.map((leave, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{leave.full_name}</div>
                                <div className="text-sm text-gray-500">{leave.employee_id}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{leave.department || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  leave.leave_type === 'Casual Leave' ? 'bg-blue-100 text-blue-800' :
                                  leave.leave_type === 'Sick Leave' ? 'bg-yellow-100 text-yellow-800' :
                                  leave.leave_type === 'Earned Leave' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {leave.leave_type}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {leave.start_date} - {leave.end_date}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{leave.total_days}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  leave.status === 'Approved' ? 'bg-green-100 text-green-800' :
                                  leave.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {leave.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{leave.applied_on}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                
                {/* Report Footer */}
                <div className="p-4 border-t bg-gray-50 text-sm text-gray-600">
                  <i className="fas fa-info-circle mr-2"></i>
                  Report Period: {reportFilters.date_from} to {reportFilters.date_to}
                  {reportType === 'attendance' ? ` | ${reportData.report?.length || 0} employees` : ` | ${reportData.total || 0} leave records`}
                </div>
              </div>
            )}

            {!reportData && !reportLoading && (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <i className="fas fa-chart-pie text-6xl text-gray-300 mb-4"></i>
                <h3 className="text-lg font-medium text-gray-700 mb-2">No Report Generated</h3>
                <p className="text-gray-500">Select report type, date range and click "Generate Report" to view data.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'exit-tracking' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Exit Tracking & Management</h2>
              <p className="text-gray-600">Track resignations, manage exit processes, and conduct exit interviews</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Exit Statistics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">This Month:</span>
                    <span className="font-medium">2 exits</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">This Quarter:</span>
                    <span className="font-medium">7 exits</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Turnover Rate:</span>
                    <span className="font-medium text-red-600">12%</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Pending Exit Tasks</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Exit Interviews:</span>
                    <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">3 pending</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Asset Returns:</span>
                    <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">2 pending</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Final Settlements:</span>
                    <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">1 pending</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Top Exit Reasons</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Better Opportunity:</span>
                    <span className="text-sm font-medium">40%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Personal Reasons:</span>
                    <span className="text-sm font-medium">25%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Work-Life Balance:</span>
                    <span className="text-sm font-medium">20%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Exit Processes */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Active Exit Processes</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resignation Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Working Day</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exit Interview</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset Return</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {[
                      { 
                        name: 'Rajesh Kumar', 
                        resignationDate: 'Oct 15, 2025', 
                        lastWorkingDay: 'Nov 15, 2025',
                        exitInterview: 'pending',
                        assetReturn: 'pending'
                      },
                      { 
                        name: 'Sneha Patel', 
                        resignationDate: 'Oct 20, 2025', 
                        lastWorkingDay: 'Nov 20, 2025',
                        exitInterview: 'scheduled',
                        assetReturn: 'completed'
                      }
                    ].map((exit, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{exit.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{exit.resignationDate}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{exit.lastWorkingDay}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            exit.exitInterview === 'completed' ? 'bg-green-100 text-green-800' :
                            exit.exitInterview === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {exit.exitInterview}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            exit.assetReturn === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {exit.assetReturn}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button className="text-blue-600 hover:text-blue-900">View Details</button>
                          <button className="text-green-600 hover:text-green-900">Schedule Interview</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'employees' && (
          <div>
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Employee Management</h3>
                <p className="text-sm text-gray-600">View and manage employee details, permissions, and access</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {employees.map((employee) => (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-medium text-sm">{employee.name.charAt(0)}</span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                              <div className="text-sm text-gray-500">{employee.role}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.empId}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.department}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {employee.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.lastLogin}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button className="text-blue-600 hover:text-blue-900 mr-3">View</button>
                          <button className="text-green-600 hover:text-green-900 mr-3">Edit</button>
                          <button className="text-red-600 hover:text-red-900">Suspend</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div>
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Today's Attendance</h3>
                <p className="text-sm text-gray-600">Real-time attendance tracking and monitoring</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendanceData.map((record, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{record.name}</div>
                          <div className="text-sm text-gray-500">ID: {record.empId}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            record.status === 'Present' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.checkIn}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.checkOut}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.status === 'Present' ? '8.5h' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Punch In/Out Records Section */}
            <div className="bg-white rounded-lg shadow-md mt-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Punch In/Out Records</h3>
                    <p className="text-sm text-gray-600">Device-tracked punch times from CheckInOut system</p>
                  </div>
                  {punchSummary && (
                    <div className="flex items-center space-x-6 text-sm">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Total Employees</p>
                        <p className="text-lg font-bold text-blue-600">{punchSummary.total_employees}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Total Punches</p>
                        <p className="text-lg font-bold text-blue-600">{punchSummary.total_punch_records}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Date Columns</p>
                        <p className="text-lg font-bold text-blue-600">{punchSummary.date_columns}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Filters */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Employee ID</label>
                    <input
                      type="text"
                      value={punchFilters.employee_id}
                      onChange={(e) => setPunchFilters({...punchFilters, employee_id: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 1001"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                    <select
                      value={punchFilters.department}
                      onChange={(e) => setPunchFilters({...punchFilters, department: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Departments</option>
                      {filterOptions.departments?.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={fetchPunchRecords}
                      className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <i className="fas fa-search mr-2"></i>
                      Search
                    </button>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setPunchFilters({ employee_id: '', date_from: '', date_to: '', department: 'all' });
                        fetchPunchRecords();
                      }}
                      className="w-full px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      <i className="fas fa-redo mr-2"></i>
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {loadingPunchRecords ? (
                  <div className="text-center py-8">
                    <i className="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
                    <p className="mt-2 text-gray-600">Loading punch records...</p>
                  </div>
                ) : punchRecords.length === 0 ? (
                  <div className="text-center py-12">
                    <i className="fas fa-clock text-4xl text-gray-300 mb-4"></i>
                    <p className="text-gray-500">No punch records found</p>
                    <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Employee
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Department
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Category
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Date Column
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Punch Time
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {punchRecords.map((record, index) => (
                            <tr key={index} className="hover:bg-blue-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{record.employee_name}</div>
                                <div className="text-xs text-gray-500">ID: {record.employee_id}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {record.department}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {record.employee_category}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {record.column_name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                                {record.punch_time}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="mt-4 text-sm text-gray-600 text-center border-t border-gray-200 pt-4">
                      Showing {punchRecords.length} punch record{punchRecords.length !== 1 ? 's' : ''}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'approvals' && (
          <div>
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Pending Approvals</h3>
                <p className="text-sm text-gray-600">Leave requests and permission approvals</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {[
                    { employee: 'Ajith.B', type: 'Sick Leave', dates: 'Oct 28-29, 2025', reason: 'Medical appointment' },
                    { employee: 'Akhil.S', type: 'Vacation', dates: 'Nov 1-3, 2025', reason: 'Family function' },
                    { employee: 'Baby', type: 'Personal Leave', dates: 'Oct 30, 2025', reason: 'Personal work' },
                  ].map((approval, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900">{approval.employee}</h4>
                          <p className="text-sm text-gray-600">{approval.type}: {approval.dates}</p>
                          <p className="text-sm text-gray-500 mt-1">{approval.reason}</p>
                        </div>
                        <div className="flex space-x-2">
                          <button className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm">
                            Approve
                          </button>
                          <button className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
              <p className="text-gray-600">Configure email and system preferences</p>
            </div>

            {settingsLoading ? (
              <div className="flex items-center justify-center py-12">
                <i className="fas fa-spinner fa-spin text-blue-600 text-2xl"></i>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Email Configuration */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    <i className="fas fa-envelope text-blue-600 mr-2"></i>
                    Email Configuration (SMTP)
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Configure SMTP settings for sending employee credentials and notifications.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Server</label>
                      <input
                        type="text"
                        value={settings.smtp_server || ''}
                        onChange={(e) => setSettings({...settings, smtp_server: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
                      <input
                        type="text"
                        value={settings.smtp_port || ''}
                        onChange={(e) => setSettings({...settings, smtp_port: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="587"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                      <input
                        type="email"
                        value={settings.smtp_email || ''}
                        onChange={(e) => setSettings({...settings, smtp_email: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="your-email@gmail.com"
                      />
                      <p className="text-xs text-gray-500 mt-1">This email will be used to send notifications</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email Password / App Password
                      </label>
                      <input
                        type="password"
                        value={settings.smtp_password || ''}
                        onChange={(e) => setSettings({...settings, smtp_password: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="••••••••"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        For Gmail, use an <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">App Password</a>
                      </p>
                    </div>
                  </div>
                  
                  {/* Gmail Setup Guide */}
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">
                      <i className="fas fa-info-circle mr-1"></i>
                      Gmail Setup Guide:
                    </h4>
                    <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                      <li>Enable 2-Step Verification in your Google Account</li>
                      <li>Go to Google Account → Security → App Passwords</li>
                      <li>Generate a new App Password for "Mail"</li>
                      <li>Use that 16-character password above</li>
                    </ol>
                  </div>
                </div>

                {/* Company Settings */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    <i className="fas fa-building text-blue-600 mr-2"></i>
                    Company Settings
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                      <input
                        type="text"
                        value={settings.company_name || ''}
                        onChange={(e) => setSettings({...settings, company_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="VES Engineering Services"
                      />
                      <p className="text-xs text-gray-500 mt-1">Used in email templates and headers</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Frontend URL</label>
                      <input
                        type="text"
                        value={settings.frontend_url || ''}
                        onChange={(e) => setSettings({...settings, frontend_url: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="http://localhost:3000"
                      />
                      <p className="text-xs text-gray-500 mt-1">URL used in password reset emails</p>
                    </div>
                  </div>
                  
                  {/* Test Email Section */}
                  <div className="mt-6 pt-4 border-t">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      <i className="fas fa-paper-plane mr-1"></i>
                      Test Email Configuration
                    </h4>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="test@example.com"
                      />
                      <button
                        onClick={handleTestEmail}
                        disabled={testingEmail}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        {testingEmail ? (
                          <><i className="fas fa-spinner fa-spin mr-1"></i>Sending...</>
                        ) : (
                          <><i className="fas fa-paper-plane mr-1"></i>Send Test</>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Save settings first, then send a test email to verify configuration
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                style={{backgroundColor: '#4169E1'}}
              >
                {savingSettings ? (
                  <><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</>
                ) : (
                  <><i className="fas fa-save mr-2"></i>Save Settings</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HRDashboard;