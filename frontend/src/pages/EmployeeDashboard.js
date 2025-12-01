import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';

const EmployeeDashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [payrollData, setPayrollData] = useState(null);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  
  // Employee category and meal entitlement
  const [employeeCategory, setEmployeeCategory] = useState('W001'); // W001, S001, M001, T001
  const [shift, setShift] = useState('1'); // 1, 2, 3
  const [leaveBalance, setLeaveBalance] = useState(12);
  const [todayMealToken, setTodayMealToken] = useState(null);
  
  // Meal Token Modal States
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [mealTokenHistory, setMealTokenHistory] = useState([]);
  const [tokenSummary, setTokenSummary] = useState({ issued: 0, used: 0, cancelled: 0 });
  
  // Attendance Check-in/out States
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState({
    present: 0, absent: 0, half_day: 0, leave: 0, late_days: 0, early_leaves: 0
  });
  
  // Leave Form States
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'CL',
    start_date: '',
    end_date: '',
    is_half_day: false,
    half_day_session: 'First Half',
    reason: ''
  });
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [leaveSuccess, setLeaveSuccess] = useState('');
  const [leaveBalanceDetails, setLeaveBalanceDetails] = useState(null);
  
  // Payslip States
  const [payslipMonth, setPayslipMonth] = useState(new Date().toISOString().slice(0, 7));
  const [currentPayslip, setCurrentPayslip] = useState(null);
  const [payslipHistory, setPayslipHistory] = useState([]);
  const [payslipLoading, setPayslipLoading] = useState(false);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  
  // Meal type mapping based on shift
  const getMealType = (shiftNum) => {
    const mealMap = { '1': 'Lunch', '2': 'Dinner', '3': 'Breakfast' };
    return mealMap[shiftNum] || 'N/A';
  };
  
  // Leave entitlement based on category
  const getLeaveEntitlement = (category) => {
    const entitlementMap = {
      'S001': { leaves: 12, description: 'Staff' },
      'W001': { leaves: 12, description: 'Worker/Operator' },
      'M001': { leaves: 0, description: 'Migrant Worker' },
      'T001': { leaves: 0, description: 'Trainee' }
    };
    return entitlementMap[category] || { leaves: 0, description: 'Unknown' };
  };
  
  // Check if employee is eligible for meal token
  const isMealEligible = (category) => {
    return category === 'W001' || category === 'M001';
  };
  
  // Generate Token ID for display
  const generateTokenId = () => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    return `MT-${user?.employee_id || 'EMP'}-${dateStr}-${shift}`;
  };
  
  // Fetch meal token history
  const fetchTokenHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/meal-tokens/history?days=30', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMealTokenHistory(data.tokens || []);
        setTokenSummary(data.summary || { issued: 0, used: 0, cancelled: 0 });
      } else {
        // Use mock data if API fails
        const mockHistory = generateMockTokenHistory();
        setMealTokenHistory(mockHistory);
        calculateTokenSummary(mockHistory);
      }
    } catch (error) {
      console.error('Error fetching token history:', error);
      const mockHistory = generateMockTokenHistory();
      setMealTokenHistory(mockHistory);
      calculateTokenSummary(mockHistory);
    }
  };
  
  // Generate mock token history for demo
  const generateMockTokenHistory = () => {
    const history = [];
    const today = new Date();
    for (let i = 0; i < 20; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const statuses = ['Used', 'Used', 'Used', 'Issued', 'Cancelled'];
      history.push({
        id: i + 1,
        token_date: date.toISOString().slice(0, 10),
        shift: shift,
        meal_type: getMealType(shift),
        status: i === 0 ? 'Issued' : statuses[Math.floor(Math.random() * statuses.length)],
        generated_at: date.toISOString(),
        used_at: statuses[Math.floor(Math.random() * statuses.length)] === 'Used' ? date.toISOString() : null
      });
    }
    return history;
  };
  
  // Calculate token summary from history
  const calculateTokenSummary = (history) => {
    const summary = {
      issued: history.filter(t => t.status === 'Issued').length,
      used: history.filter(t => t.status === 'Used').length,
      cancelled: history.filter(t => t.status === 'Cancelled').length
    };
    setTokenSummary(summary);
  };
  
  // Handle Show Token button click
  const handleShowToken = () => {
    setShowTokenModal(true);
  };
  
  // Handle View History button click
  const handleViewHistory = async () => {
    await fetchTokenHistory();
    setShowHistoryModal(true);
  };
  
  // Fetch today's attendance status
  const fetchTodayAttendance = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/attendance/today', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTodayAttendance(data);
      }
    } catch (error) {
      console.error('Error fetching today attendance:', error);
    }
  };
  
  // Fetch attendance summary for pie chart
  const fetchAttendanceSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      const now = new Date();
      const response = await fetch(
        `http://localhost:5000/api/attendance/summary?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setAttendanceSummary({
          present: data.summary?.present || 0,
          absent: data.summary?.absent || 0,
          half_day: data.summary?.half_day || 0,
          leave: data.summary?.leave || 0,
          late_days: data.late_days || 0,
          early_leaves: data.early_leaves || 0,
          attendance_rate: data.attendance_rate || 0,
          total_hours: data.total_hours || 0
        });
      }
    } catch (error) {
      console.error('Error fetching attendance summary:', error);
    }
  };
  
  // Fetch Leave Balance
  const fetchLeaveBalance = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/leaves/balance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLeaveBalanceDetails(data);
        if (data.eligible && data.balance) {
          // Calculate total available leaves
          const total = (data.balance.casual_leave?.available || 0) + 
                       (data.balance.sick_leave?.available || 0) + 
                       (data.balance.earned_leave?.available || 0);
          setLeaveBalance(total);
        }
      }
    } catch (error) {
      console.error('Error fetching leave balance:', error);
    }
  };
  
  // Fetch Leave Requests
  const fetchLeaveRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/leaves', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLeaveRequests(data.leaves || []);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    }
  };
  
  // Handle Leave Form Submit
  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    setLeaveError('');
    setLeaveSuccess('');
    
    // Validation
    if (!leaveForm.start_date || !leaveForm.end_date || !leaveForm.reason.trim()) {
      setLeaveError('Please fill all required fields');
      return;
    }
    
    // Date validation
    const today = new Date().toISOString().split('T')[0];
    if (leaveForm.start_date < today) {
      setLeaveError('Cannot apply leave for past dates');
      return;
    }
    
    if (leaveForm.end_date < leaveForm.start_date) {
      setLeaveError('End date cannot be before start date');
      return;
    }
    
    setLeaveSubmitting(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/leaves', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(leaveForm)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setLeaveSuccess(`Leave request submitted successfully! ${data.days_requested} day(s) of ${data.leave_type} requested.`);
        setLeaveForm({
          leave_type: 'CL',
          start_date: '',
          end_date: '',
          is_half_day: false,
          half_day_session: 'First Half',
          reason: ''
        });
        fetchLeaveRequests();
        fetchLeaveBalance();
      } else {
        setLeaveError(data.error || 'Failed to submit leave request');
      }
    } catch (error) {
      console.error('Leave submission error:', error);
      setLeaveError('Failed to submit leave request. Please try again.');
    } finally {
      setLeaveSubmitting(false);
    }
  };
  
  // Cancel Leave Request
  const handleCancelLeave = async (leaveId) => {
    if (!window.confirm('Are you sure you want to cancel this leave request?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/leaves/${leaveId}/cancel`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        alert('Leave request cancelled successfully');
        fetchLeaveRequests();
        fetchLeaveBalance();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to cancel leave request');
      }
    } catch (error) {
      console.error('Cancel leave error:', error);
      alert('Failed to cancel leave request');
    }
  };
  
  // Fetch Current Payslip
  const fetchPayslip = async (month = payslipMonth) => {
    setPayslipLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/employee/payslip?month=${month}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentPayslip(data);
        // Update legacy payrollData for backward compatibility
        setPayrollData({
          basicSalary: data.earnings?.basic_salary || 0,
          allowances: (data.earnings?.hra || 0) + (data.earnings?.conveyance_allowance || 0) + (data.earnings?.medical_allowance || 0),
          deductions: data.deductions?.total_deductions || 0,
          netSalary: data.net_pay || 0,
          lastPayDate: data.month,
          nextPayDate: getNextMonth(data.month)
        });
      } else {
        setCurrentPayslip(null);
      }
    } catch (error) {
      console.error('Fetch payslip error:', error);
    } finally {
      setPayslipLoading(false);
    }
  };
  
  // Fetch Payslip History
  const fetchPayslipHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/employee/payslip-history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPayslipHistory(data);
      }
    } catch (error) {
      console.error('Fetch payslip history error:', error);
    }
  };
  
  // Helper to get next month
  const getNextMonth = (monthStr) => {
    if (!monthStr) return '-';
    const [year, month] = monthStr.split('-').map(Number);
    const nextDate = new Date(year, month, 1);
    return nextDate.toISOString().slice(0, 7);
  };
  
  // Download Payslip
  const handleDownloadPayslip = (payslip = currentPayslip) => {
    if (!payslip) {
      alert('No payslip data available');
      return;
    }
    
    // Create printable HTML
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payslip - ${payslip.month}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
          .header h1 { margin: 0; color: #333; }
          .header p { color: #666; margin: 5px 0; }
          .section { margin-bottom: 20px; }
          .section h3 { background: #f0f0f0; padding: 8px; margin: 0 0 10px 0; }
          .row { display: flex; justify-content: space-between; padding: 5px 10px; border-bottom: 1px solid #eee; }
          .row.total { font-weight: bold; background: #f9f9f9; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .net-pay { text-align: center; background: #e8f5e9; padding: 20px; border-radius: 8px; margin-top: 20px; }
          .net-pay h2 { color: #2e7d32; margin: 0; font-size: 28px; }
          .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${payslip.company_name || 'VES HRMS'}</h1>
          <p>Payslip for ${payslip.month}</p>
        </div>
        
        <div class="section">
          <h3>Employee Details</h3>
          <div class="row"><span>Employee ID:</span><span>${payslip.employee?.employee_id || '-'}</span></div>
          <div class="row"><span>Name:</span><span>${payslip.employee?.name || '-'}</span></div>
          <div class="row"><span>Department:</span><span>${payslip.employee?.department || '-'}</span></div>
          <div class="row"><span>Designation:</span><span>${payslip.employee?.designation || '-'}</span></div>
        </div>
        
        <div class="section">
          <h3>Attendance</h3>
          <div class="row"><span>Working Days:</span><span>${payslip.attendance?.working_days || 0}</span></div>
          <div class="row"><span>Days Worked:</span><span>${payslip.attendance?.days_worked || 0}</span></div>
          <div class="row"><span>Leave Days:</span><span>${payslip.attendance?.leave_days || 0}</span></div>
        </div>
        
        <div class="grid">
          <div class="section">
            <h3>Earnings</h3>
            <div class="row"><span>Basic Salary</span><span>₹${(payslip.earnings?.basic_salary || 0).toLocaleString()}</span></div>
            <div class="row"><span>HRA</span><span>₹${(payslip.earnings?.hra || 0).toLocaleString()}</span></div>
            <div class="row"><span>Conveyance</span><span>₹${(payslip.earnings?.conveyance_allowance || 0).toLocaleString()}</span></div>
            <div class="row"><span>Medical</span><span>₹${(payslip.earnings?.medical_allowance || 0).toLocaleString()}</span></div>
            <div class="row"><span>Overtime</span><span>₹${(payslip.earnings?.overtime_pay || 0).toLocaleString()}</span></div>
            <div class="row total"><span>Total Earnings</span><span>₹${(payslip.earnings?.total_earnings || 0).toLocaleString()}</span></div>
          </div>
          
          <div class="section">
            <h3>Deductions</h3>
            <div class="row"><span>Provident Fund</span><span>₹${(payslip.deductions?.provident_fund || 0).toLocaleString()}</span></div>
            <div class="row"><span>Professional Tax</span><span>₹${(payslip.deductions?.professional_tax || 0).toLocaleString()}</span></div>
            <div class="row"><span>LOP Deduction</span><span>₹${(payslip.deductions?.lop_deduction || 0).toLocaleString()}</span></div>
            <div class="row total"><span>Total Deductions</span><span>₹${(payslip.deductions?.total_deductions || 0).toLocaleString()}</span></div>
          </div>
        </div>
        
        <div class="net-pay">
          <p style="margin:0 0 5px 0;color:#666;">Net Pay</p>
          <h2>₹${(payslip.net_pay || 0).toLocaleString()}</h2>
        </div>
        
        <div class="footer">
          <p>This is a computer-generated payslip</p>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };
  
  // Handle Check-in
  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/attendance/check-in', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        let message = `✅ Check-in successful at ${data.check_in_time}`;
        if (data.is_late) {
          message += ` (Late by ${data.late_by_minutes} mins)`;
        }
        if (data.meal_token) {
          message += `\n🍽️ Meal token generated for ${data.meal_token.meal_type}!`;
          // Refresh meal token data
          try {
            const mealResponse = await fetch('http://localhost:5000/api/meal-tokens/today', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (mealResponse.ok) {
              const mealData = await mealResponse.json();
              setTodayMealToken(mealData.token);
            }
          } catch (e) { /* ignore */ }
        }
        alert(message);
        fetchTodayAttendance();
        fetchAttendanceSummary();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      console.error('Check-in error:', error);
      alert('❌ Check-in failed. Please try again.');
    } finally {
      setCheckingIn(false);
    }
  };
  
  // Handle Check-out
  const handleCheckOut = async () => {
    setCheckingOut(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/attendance/check-out', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`✅ Check-out successful at ${data.check_out_time}\nHours worked: ${data.hours_worked}h${data.is_early ? ` (Early by ${data.early_by_minutes} mins)` : ''}`);
        fetchTodayAttendance();
        fetchAttendanceSummary();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      console.error('Check-out error:', error);
      alert('❌ Check-out failed. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };
  
  // Current time state for real-time display
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  // Get current time formatted
  const getCurrentTime = () => {
    return currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  // Calculate pie chart segments
  const getPieChartData = () => {
    const total = attendanceSummary.present + attendanceSummary.absent + attendanceSummary.leave + attendanceSummary.half_day;
    if (total === 0) return { present: 0, absent: 0, leave: 0, half_day: 0 };
    
    return {
      present: (attendanceSummary.present / total) * 100,
      absent: (attendanceSummary.absent / total) * 100,
      leave: (attendanceSummary.leave / total) * 100,
      half_day: (attendanceSummary.half_day / total) * 100
    };
  };

  useEffect(() => {
    loadDashboardData();
    fetchTodayAttendance();
    fetchAttendanceSummary();
    fetchLeaveBalance();
    fetchLeaveRequests();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Fetch employee category and meal token data from backend
      const token = localStorage.getItem('token');
      
      // Get employee category info
      try {
        const categoryResponse = await fetch('http://localhost:5000/api/employee/category', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (categoryResponse.ok) {
          const categoryData = await categoryResponse.json();
          setEmployeeCategory(categoryData.employee_category || 'W001');
          setShift(categoryData.shift || '1');
          setLeaveBalance(categoryData.leave_balance || 12);
        }
      } catch (error) {
        console.error('Error fetching employee category:', error);
      }
      
      // Get today's meal token
      try {
        const mealResponse = await fetch('http://localhost:5000/api/meal-tokens/today', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (mealResponse.ok) {
          const mealData = await mealResponse.json();
          setTodayMealToken(mealData.token);
        }
      } catch (error) {
        console.error('Error fetching meal token:', error);
      }
      
      // Fetch payslip data from API
      try {
        await fetchPayslip();
        await fetchPayslipHistory();
      } catch (error) {
        console.error('Error fetching payslip:', error);
        // Fallback to default data if API fails
        setPayrollData({
          basicSalary: 0,
          allowances: 0,
          deductions: 0,
          netSalary: 0,
          lastPayDate: '-',
          nextPayDate: '-'
        });
      }
      
      // Employee personal data - Purple Branch features
      const mockAttendance = [
        { date: '2025-10-27', status: 'Present', checkIn: '09:15', checkOut: '18:30', hours: 9.25 },
        { date: '2025-10-26', status: 'Present', checkIn: '09:00', checkOut: '18:15', hours: 9.25 },
        { date: '2025-10-25', status: 'Present', checkIn: '08:45', checkOut: '17:45', hours: 9.0 },
        { date: '2025-10-24', status: 'Present', checkIn: '09:30', checkOut: '18:00', hours: 8.5 },
        { date: '2025-10-23', status: 'Absent', checkIn: '-', checkOut: '-', hours: 0 },
      ];

      const mockLeaveRequests = [
        { id: 1, type: 'Sick Leave', startDate: '2025-11-01', endDate: '2025-11-02', status: 'Pending', reason: 'Medical checkup' },
        { id: 2, type: 'Vacation', startDate: '2025-10-20', endDate: '2025-10-22', status: 'Approved', reason: 'Family function' },
      ];

      const mockDocs = [
        { id: 1, name: 'Aadhar Card.pdf', type: 'ID Proof', uploadDate: '2025-10-15', status: 'Approved' },
        { id: 2, name: 'Experience Letter.pdf', type: 'Certificate', uploadDate: '2025-10-10', status: 'Pending' },
      ];

      setAttendanceData(mockAttendance);
      setLeaveRequests(mockLeaveRequests);
      setUploadedDocs(mockDocs);
      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mr-3">
                <i className="fas fa-user text-white text-sm"></i>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">People App - Employee Portal</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs" style={{color: '#A020F0'}}>{user?.role}</p>
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

      {/* Tab Navigation - Purple Branch */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: 'fas fa-home' },
              { id: 'leave-request', name: 'Leave Request', icon: 'fas fa-calendar-plus' },
              { id: 'payroll', name: 'Payroll', icon: 'fas fa-money-bill-wave' },
              { id: 'documents', name: 'Document Upload', icon: 'fas fa-file-upload' },
              { id: 'attendance', name: 'Track Attendance', icon: 'fas fa-clock' },
              { id: 'custom-requests', name: 'Custom Requests', icon: 'fas fa-plus-circle' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'text-purple-600 border-purple-500'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                style={activeTab === tab.id ? {color: '#A020F0', borderColor: '#A020F0'} : {}}
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
            <div className="rounded-lg p-6 mb-8 text-white" style={{background: 'linear-gradient(135deg, #A020F0 0%, #FF6B9D 100%)'}}>
              <h2 className="text-3xl font-bold mb-2">Welcome back, {user?.name}! 👋</h2>
              <p className="text-purple-100">Your personal dashboard - empowering you to manage your work life</p>
            </div>

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Category</p>
                    <p className="text-xl font-bold text-gray-900">{employeeCategory}</p>
                    <p className="text-sm" style={{color: '#A020F0'}}>{getLeaveEntitlement(employeeCategory).description}</p>
                  </div>
                  <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{backgroundColor: '#A020F0', opacity: 0.1}}>
                    <i className="fas fa-id-badge text-xl" style={{color: '#A020F0'}}></i>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">This Month</p>
                    <p className="text-2xl font-bold text-gray-900">22 Days</p>
                    <p className="text-sm text-green-600">Present</p>
                  </div>
                  <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{backgroundColor: '#A020F0', opacity: 0.1}}>
                    <i className="fas fa-calendar-check text-xl" style={{color: '#A020F0'}}></i>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Leave Balance</p>
                    <p className="text-2xl font-bold text-gray-900">{leaveBalance} Days</p>
                    <p className="text-sm text-blue-600">
                      {employeeCategory === 'M001' || employeeCategory === 'T001' ? 'Not Eligible' : 'Available'}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-umbrella-beach text-blue-600 text-xl"></i>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Meal Today</p>
                    <p className="text-xl font-bold text-gray-900">
                      {isMealEligible(employeeCategory) ? getMealType(shift) : 'N/A'}
                    </p>
                    <p className="text-sm" style={{color: isMealEligible(employeeCategory) ? '#10B981' : '#6B7280'}}>
                      {isMealEligible(employeeCategory) ? `Shift ${shift}` : 'Not Eligible'}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-utensils text-green-600 text-xl"></i>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Net Salary</p>
                    <p className="text-2xl font-bold text-gray-900">₹{payrollData?.netSalary?.toLocaleString()}</p>
                    <p className="text-sm text-green-600">This Month</p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-money-bill-wave text-green-600 text-xl"></i>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button 
                  onClick={() => setActiveTab('leave-request')}
                  className="p-4 text-center rounded-lg border-2 transition-all hover:shadow-md"
                  style={{borderColor: '#A020F0', color: '#A020F0'}}
                >
                  <i className="fas fa-calendar-plus text-2xl mb-2"></i>
                  <p className="text-sm font-medium">Request Leave</p>
                </button>
                <button 
                  onClick={() => setActiveTab('documents')}
                  className="bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg p-4 text-center transition-colors"
                >
                  <i className="fas fa-file-upload text-blue-600 text-2xl mb-2"></i>
                  <p className="text-sm font-medium text-gray-900">Upload Document</p>
                </button>
                <button 
                  onClick={() => setActiveTab('payroll')}
                  className="bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg p-4 text-center transition-colors"
                >
                  <i className="fas fa-money-bill text-green-600 text-2xl mb-2"></i>
                  <p className="text-sm font-medium text-gray-900">View Payroll</p>
                </button>
                <button 
                  onClick={() => setActiveTab('custom-requests')}
                  className="bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg p-4 text-center transition-colors"
                >
                  <i className="fas fa-plus-circle text-orange-600 text-2xl mb-2"></i>
                  <p className="text-sm font-medium text-gray-900">Custom Request</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leave-request' && (
          <div>
            {/* Leave Eligibility Notice */}
            {(employeeCategory === 'M001' || employeeCategory === 'T001') && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <div className="flex items-start">
                  <i className="fas fa-exclamation-triangle text-red-600 mt-1 mr-3"></i>
                  <div>
                    <h4 className="text-sm font-medium text-red-800">Leave Not Eligible</h4>
                    <p className="text-sm text-red-700 mt-1">
                      As a {getLeaveEntitlement(employeeCategory).description} ({employeeCategory}), you are not entitled to paid leave. 
                      Any leave requests submitted will be automatically rejected.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Leave Balance Cards */}
            {leaveBalanceDetails?.eligible && (
              <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Casual Leave (CL)</p>
                      <p className="text-2xl font-bold text-blue-800">
                        {leaveBalanceDetails.balance?.casual_leave?.available || 0}
                        <span className="text-sm font-normal text-blue-600">
                          /{leaveBalanceDetails.balance?.casual_leave?.total || 12}
                        </span>
                      </p>
                    </div>
                    <i className="fas fa-umbrella-beach text-blue-400 text-2xl"></i>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-medium">Sick Leave (SL)</p>
                      <p className="text-2xl font-bold text-green-800">
                        {leaveBalanceDetails.balance?.sick_leave?.available || 0}
                        <span className="text-sm font-normal text-green-600">
                          /{leaveBalanceDetails.balance?.sick_leave?.total || 12}
                        </span>
                      </p>
                    </div>
                    <i className="fas fa-medkit text-green-400 text-2xl"></i>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600 font-medium">Earned Leave (EL)</p>
                      <p className="text-2xl font-bold text-purple-800">
                        {leaveBalanceDetails.balance?.earned_leave?.available || 0}
                        <span className="text-sm font-normal text-purple-600">
                          /{leaveBalanceDetails.balance?.earned_leave?.total || 15}
                        </span>
                      </p>
                    </div>
                    <i className="fas fa-award text-purple-400 text-2xl"></i>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Leave Request Form */}
              <div className="bg-white rounded-lg shadow-md">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Submit Leave Request</h3>
                  <p className="text-sm text-gray-600">Request time off for vacation, sick leave, or personal reasons</p>
                </div>
                <div className="p-6">
                  {leaveError && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                      <i className="fas fa-exclamation-circle mr-2"></i>{leaveError}
                    </div>
                  )}
                  {leaveSuccess && (
                    <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                      <i className="fas fa-check-circle mr-2"></i>{leaveSuccess}
                    </div>
                  )}
                  <form className="space-y-4" onSubmit={handleLeaveSubmit}>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Leave Type *</label>
                      <select 
                        value={leaveForm.leave_type}
                        onChange={(e) => setLeaveForm({...leaveForm, leave_type: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                        required
                      >
                        <option value="CL">Casual Leave (CL)</option>
                        <option value="SL">Sick Leave (SL)</option>
                        <option value="EL">Earned Leave (EL)</option>
                        <option value="Half-Day">Half Day Leave</option>
                        <option value="LOP">Loss of Pay (LOP)</option>
                      </select>
                    </div>
                    
                    {/* Half Day Options */}
                    {leaveForm.leave_type === 'Half-Day' && (
                      <div className="bg-purple-50 p-3 rounded-md">
                        <label className="flex items-center mb-2">
                          <input
                            type="checkbox"
                            checked={leaveForm.is_half_day}
                            onChange={(e) => setLeaveForm({...leaveForm, is_half_day: e.target.checked})}
                            className="mr-2 rounded text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-sm text-gray-700">Half Day Leave</span>
                        </label>
                        {leaveForm.is_half_day && (
                          <select
                            value={leaveForm.half_day_session}
                            onChange={(e) => setLeaveForm({...leaveForm, half_day_session: e.target.value})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                          >
                            <option value="First Half">First Half (Morning)</option>
                            <option value="Second Half">Second Half (Afternoon)</option>
                          </select>
                        )}
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Start Date *</label>
                        <input 
                          type="date" 
                          value={leaveForm.start_date}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => setLeaveForm({...leaveForm, start_date: e.target.value})}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">End Date *</label>
                        <input 
                          type="date" 
                          value={leaveForm.end_date}
                          min={leaveForm.start_date || new Date().toISOString().split('T')[0]}
                          onChange={(e) => setLeaveForm({...leaveForm, end_date: e.target.value})}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                          required
                        />
                      </div>
                    </div>
                    
                    {/* Days Calculation */}
                    {leaveForm.start_date && leaveForm.end_date && (
                      <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-600">
                        <i className="fas fa-calculator mr-2"></i>
                        Total Days: <strong>
                          {leaveForm.leave_type === 'Half-Day' || leaveForm.is_half_day 
                            ? '0.5' 
                            : Math.ceil((new Date(leaveForm.end_date) - new Date(leaveForm.start_date)) / (1000 * 60 * 60 * 24)) + 1}
                        </strong> day(s)
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Reason *</label>
                      <textarea 
                        rows={3} 
                        value={leaveForm.reason}
                        onChange={(e) => setLeaveForm({...leaveForm, reason: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500" 
                        placeholder="Brief description of reason for leave"
                        required
                      ></textarea>
                    </div>
                    <button 
                      type="submit" 
                      disabled={leaveSubmitting}
                      className="w-full text-white py-2 px-4 rounded-md transition-colors disabled:opacity-50"
                      style={{backgroundColor: '#A020F0'}}
                    >
                      {leaveSubmitting ? (
                        <><i className="fas fa-spinner fa-spin mr-2"></i>Submitting...</>
                      ) : (
                        <><i className="fas fa-paper-plane mr-2"></i>Submit Leave Request</>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Leave History */}
              <div className="bg-white rounded-lg shadow-md">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">My Leave Requests</h3>
                  <p className="text-sm text-gray-600">Track your submitted leave requests</p>
                </div>
                <div className="p-6">
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {leaveRequests.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <i className="fas fa-calendar-times text-4xl mb-3 text-gray-300"></i>
                        <p>No leave requests found</p>
                      </div>
                    ) : (
                      leaveRequests.map((request) => (
                        <div key={request.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-gray-900">{request.leave_type_name || request.leave_type}</h4>
                                {request.is_half_day && (
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                    {request.half_day_session}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mt-1">
                                <i className="fas fa-calendar mr-1"></i>
                                {request.start_date} {request.start_date !== request.end_date && `to ${request.end_date}`}
                              </p>
                              <p className="text-sm text-gray-500 mt-1">
                                <i className="fas fa-clock mr-1"></i>
                                {request.days_requested} day(s)
                              </p>
                              <p className="text-sm text-gray-500 mt-1 truncate" title={request.reason}>
                                {request.reason}
                              </p>
                              {request.rejection_reason && (
                                <p className="text-sm text-red-500 mt-1">
                                  <i className="fas fa-times-circle mr-1"></i>
                                  {request.rejection_reason}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                request.status === 'Approved' ? 'bg-green-100 text-green-800' :
                                request.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                request.status === 'Cancelled' ? 'bg-gray-100 text-gray-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {request.status}
                              </span>
                              {request.status === 'Pending' && (
                                <button
                                  onClick={() => handleCancelLeave(request.id)}
                                  className="text-xs text-red-600 hover:text-red-800"
                                >
                                  <i className="fas fa-times mr-1"></i>Cancel
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payroll' && (
          <div>
            {/* Header with Month Selector */}
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">My Payroll</h2>
                <p className="text-gray-600">View your salary details and download payslips</p>
              </div>
              <div className="flex gap-3 items-center">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Month</label>
                  <input
                    type="month"
                    value={payslipMonth}
                    onChange={(e) => {
                      setPayslipMonth(e.target.value);
                      fetchPayslip(e.target.value);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>

            {payslipLoading ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <i className="fas fa-spinner fa-spin text-4xl text-purple-600"></i>
                <p className="text-gray-500 mt-2">Loading payslip...</p>
              </div>
            ) : currentPayslip ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Current Month Salary */}
                <div className="bg-white rounded-lg shadow-md">
                  <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">Payslip - {currentPayslip.month}</h3>
                    <button 
                      onClick={() => handleDownloadPayslip(currentPayslip)}
                      className="text-purple-600 hover:text-purple-800"
                      title="Download Payslip"
                    >
                      <i className="fas fa-download text-xl"></i>
                    </button>
                  </div>
                  <div className="p-6">
                    {/* Attendance Summary */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Attendance</h4>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-center">
                          <span className="text-gray-500 block">Working Days</span>
                          <span className="font-bold">{currentPayslip.attendance?.working_days || 0}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-gray-500 block">Days Worked</span>
                          <span className="font-bold text-green-600">{currentPayslip.attendance?.days_worked || 0}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-gray-500 block">Leave Days</span>
                          <span className="font-bold text-blue-600">{currentPayslip.attendance?.leave_days || 0}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Earnings */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-green-700 mb-2">Earnings</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Basic Salary</span>
                          <span className="font-medium">₹{(currentPayslip.earnings?.basic_salary || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">HRA</span>
                          <span className="font-medium">₹{(currentPayslip.earnings?.hra || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Conveyance</span>
                          <span className="font-medium">₹{(currentPayslip.earnings?.conveyance_allowance || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Medical</span>
                          <span className="font-medium">₹{(currentPayslip.earnings?.medical_allowance || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Overtime</span>
                          <span className="font-medium text-orange-600">₹{(currentPayslip.earnings?.overtime_pay || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-bold border-t pt-2">
                          <span>Total Earnings</span>
                          <span className="text-green-600">₹{(currentPayslip.earnings?.total_earnings || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Deductions */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-red-700 mb-2">Deductions</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Provident Fund</span>
                          <span className="font-medium">₹{(currentPayslip.deductions?.provident_fund || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Professional Tax</span>
                          <span className="font-medium">₹{(currentPayslip.deductions?.professional_tax || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">LOP Deduction</span>
                          <span className="font-medium">₹{(currentPayslip.deductions?.lop_deduction || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-bold border-t pt-2">
                          <span>Total Deductions</span>
                          <span className="text-red-600">₹{(currentPayslip.deductions?.total_deductions || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Net Pay */}
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-600">Net Pay</p>
                      <p className="text-3xl font-bold text-green-600">₹{(currentPayslip.net_pay || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Payslip History */}
                <div className="bg-white rounded-lg shadow-md">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">
                      <i className="fas fa-history mr-2 text-purple-600"></i>
                      Payslip History
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                    {payslipHistory.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">
                        <i className="fas fa-file-invoice text-4xl mb-2"></i>
                        <p>No payslip history available</p>
                      </div>
                    ) : (
                      payslipHistory.map((slip) => (
                        <div key={slip.id} className="px-6 py-4 hover:bg-gray-50 flex justify-between items-center">
                          <div>
                            <p className="font-medium text-gray-900">{slip.month}</p>
                            <p className="text-sm text-gray-500">Days worked: {slip.worked_days}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">₹{slip.net_pay?.toLocaleString()}</p>
                            <button
                              onClick={() => {
                                setPayslipMonth(slip.month);
                                fetchPayslip(slip.month);
                              }}
                              className="text-sm text-purple-600 hover:text-purple-800"
                            >
                              <i className="fas fa-eye mr-1"></i>View
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <i className="fas fa-file-invoice-dollar text-6xl text-gray-300 mb-4"></i>
                <h3 className="text-lg font-medium text-gray-700">No Payslip Available</h3>
                <p className="text-gray-500 mt-2">No payslip has been generated for {payslipMonth}.</p>
                <p className="text-sm text-gray-400 mt-1">Please contact HR if you believe this is an error.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Document Upload */}
              <div className="bg-white rounded-lg shadow-md">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Upload Documents</h3>
                  <p className="text-sm text-gray-600">Upload ID proofs, certificates, and other documents</p>
                </div>
                <div className="p-6">
                  <form className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Document Type</label>
                      <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500">
                        <option>ID Proof</option>
                        <option>Address Proof</option>
                        <option>Educational Certificate</option>
                        <option>Experience Letter</option>
                        <option>Medical Certificate</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">File Upload</label>
                      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                        <div className="space-y-1 text-center">
                          <i className="fas fa-cloud-upload-alt text-gray-400 text-3xl"></i>
                          <div className="flex text-sm text-gray-600">
                            <label className="relative cursor-pointer bg-white rounded-md font-medium text-purple-600 hover:text-purple-500">
                              <span>Upload a file</span>
                              <input type="file" className="sr-only" />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                          </div>
                          <p className="text-xs text-gray-500">PNG, JPG, PDF up to 10MB</p>
                        </div>
                      </div>
                    </div>
                    <button 
                      type="submit" 
                      className="w-full text-white py-2 px-4 rounded-md transition-colors"
                      style={{backgroundColor: '#A020F0'}}
                    >
                      Upload Document
                    </button>
                  </form>
                </div>
              </div>

              {/* Uploaded Documents */}
              <div className="bg-white rounded-lg shadow-md">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">My Documents</h3>
                  <p className="text-sm text-gray-600">Track your uploaded documents</p>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {uploadedDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <i className="fas fa-file-pdf text-red-500 text-xl"></i>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                            <p className="text-xs text-gray-500">{doc.type} • {doc.uploadDate}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            doc.status === 'Approved' ? 'bg-green-100 text-green-800' :
                            doc.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {doc.status}
                          </span>
                          <button className="text-blue-600 hover:text-blue-900 text-sm">View</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Calendar View */}
              <div className="bg-white rounded-lg shadow-md">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Attendance Calendar</h3>
                      <p className="text-sm text-gray-600">
                        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })} - Click on dates to view details
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                        className="p-2 rounded-lg border border-gray-300 hover:bg-purple-50 hover:border-purple-300 transition-colors"
                        title="Previous Month"
                      >
                        <i className="fas fa-chevron-left text-gray-600"></i>
                      </button>
                      <button
                        onClick={() => setCurrentDate(new Date())}
                        className="px-3 py-1 text-sm rounded-lg border border-gray-300 hover:bg-purple-50 hover:border-purple-300 transition-colors"
                        title="Go to Today"
                      >
                        Today
                      </button>
                      <button
                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                        className="p-2 rounded-lg border border-gray-300 hover:bg-purple-50 hover:border-purple-300 transition-colors"
                        title="Next Month"
                      >
                        <i className="fas fa-chevron-right text-gray-600"></i>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  {/* Calendar Header */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {/* Empty cells for days before the 1st */}
                    {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }, (_, i) => (
                      <div key={`empty-${i}`} className="p-2 h-16"></div>
                    ))}
                    {/* Generate calendar days for current month */}
                    {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }, (_, i) => {
                      const day = i + 1;
                      const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                      const dayData = attendanceData.find(record => record.date === dateStr || record.date.includes(`${day.toString().padStart(2, '0')}`));
                      const isToday = new Date().getDate() === day && 
                                     new Date().getMonth() === currentDate.getMonth() && 
                                     new Date().getFullYear() === currentDate.getFullYear();
                      
                      return (
                        <div 
                          key={day} 
                          className={`relative p-2 h-16 border rounded cursor-pointer hover:bg-gray-50 ${
                            isToday ? 'ring-2 ring-purple-500' : ''
                          } ${
                            dayData?.status === 'Present' ? 'bg-green-50 border-green-200' :
                            dayData?.status === 'Absent' ? 'bg-red-50 border-red-200' :
                            'bg-gray-50 border-gray-200'
                          }`}
                          title={dayData ? `${dayData.status} - In: ${dayData.checkIn}, Out: ${dayData.checkOut}` : 'No data'}
                          onClick={() => setSelectedDate(dateStr)}
                        >
                          <div className={`text-sm font-medium ${isToday ? 'text-purple-600' : 'text-gray-900'}`}>{day}</div>
                          {dayData && (
                            <div className="text-xs text-gray-600">
                              <div>{dayData.checkIn}</div>
                              <div>{dayData.checkOut}</div>
                            </div>
                          )}
                          {dayData && (
                            <div className={`absolute bottom-1 right-1 w-2 h-2 rounded-full ${
                              dayData.status === 'Present' ? 'bg-green-500' : 'bg-red-500'
                            }`}></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Legend */}
                  <div className="mt-4 flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>Present</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span>Absent</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                      <span>No Data</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Today's Status & Summary */}
              <div className="space-y-6">
                {/* Real-time Check-in/Check-out */}
                <div className="bg-white rounded-lg shadow-md">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">Today's Attendance</h3>
                        <p className="text-sm text-gray-600">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-mono font-bold" style={{color: '#A020F0'}}>{getCurrentTime()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    {/* Status Display */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="border-r border-purple-200">
                          <p className="text-xs text-gray-500 uppercase">Check-in</p>
                          <p className="text-xl font-bold text-green-600">
                            {todayAttendance?.clock_in || '--:--'}
                          </p>
                          {todayAttendance?.notes?.includes('Late') && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Late</span>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Check-out</p>
                          <p className="text-xl font-bold text-blue-600">
                            {todayAttendance?.clock_out || '--:--'}
                          </p>
                          {todayAttendance?.notes?.includes('Early') && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Early</span>
                          )}
                        </div>
                      </div>
                      {todayAttendance?.hours_worked && (
                        <div className="mt-3 text-center border-t border-purple-200 pt-3">
                          <span className="text-sm text-gray-600">Hours Worked: </span>
                          <span className="font-bold" style={{color: '#A020F0'}}>{todayAttendance.hours_worked}h</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Check-in/out Buttons */}
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={handleCheckIn}
                        disabled={checkingIn || todayAttendance?.clock_in}
                        className={`flex items-center justify-center py-3 px-4 rounded-lg font-medium transition-all ${
                          todayAttendance?.clock_in 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl'
                        }`}
                      >
                        {checkingIn ? (
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                        ) : (
                          <i className="fas fa-sign-in-alt mr-2"></i>
                        )}
                        {todayAttendance?.clock_in ? 'Checked In ✓' : 'Check In'}
                      </button>
                      
                      <button
                        onClick={handleCheckOut}
                        disabled={checkingOut || !todayAttendance?.clock_in || todayAttendance?.clock_out}
                        className={`flex items-center justify-center py-3 px-4 rounded-lg font-medium transition-all ${
                          !todayAttendance?.clock_in || todayAttendance?.clock_out
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl'
                        }`}
                      >
                        {checkingOut ? (
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                        ) : (
                          <i className="fas fa-sign-out-alt mr-2"></i>
                        )}
                        {todayAttendance?.clock_out ? 'Checked Out ✓' : 'Check Out'}
                      </button>
                    </div>
                    
                    {/* Status Badge */}
                    <div className="mt-4 flex justify-center">
                      <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                        todayAttendance?.status === 'Present' ? 'bg-green-100 text-green-800' :
                        todayAttendance?.status === 'Half-Day' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {todayAttendance?.status || 'Not Marked'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Attendance Pie Chart */}
                <div className="bg-white rounded-lg shadow-md">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Monthly Overview</h3>
                    <p className="text-sm text-gray-600">Attendance distribution this month</p>
                  </div>
                  <div className="p-6">
                    {/* SVG Pie Chart */}
                    <div className="flex items-center justify-center mb-4">
                      <svg width="160" height="160" viewBox="0 0 160 160">
                        {(() => {
                          const pieData = getPieChartData();
                          const total = pieData.present + pieData.absent + pieData.leave + pieData.half_day;
                          if (total === 0) {
                            return <circle cx="80" cy="80" r="70" fill="#E5E7EB" />;
                          }
                          
                          let currentAngle = -90;
                          const segments = [];
                          const colors = { present: '#10B981', absent: '#EF4444', leave: '#6366F1', half_day: '#F59E0B' };
                          
                          Object.entries(pieData).forEach(([key, value]) => {
                            if (value > 0) {
                              const angle = (value / 100) * 360;
                              const startAngle = currentAngle;
                              const endAngle = currentAngle + angle;
                              
                              const x1 = 80 + 70 * Math.cos((startAngle * Math.PI) / 180);
                              const y1 = 80 + 70 * Math.sin((startAngle * Math.PI) / 180);
                              const x2 = 80 + 70 * Math.cos((endAngle * Math.PI) / 180);
                              const y2 = 80 + 70 * Math.sin((endAngle * Math.PI) / 180);
                              
                              const largeArc = angle > 180 ? 1 : 0;
                              
                              segments.push(
                                <path
                                  key={key}
                                  d={`M 80 80 L ${x1} ${y1} A 70 70 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                  fill={colors[key]}
                                />
                              );
                              currentAngle = endAngle;
                            }
                          });
                          
                          return segments;
                        })()}
                        {/* Center circle for donut effect */}
                        <circle cx="80" cy="80" r="40" fill="white" />
                        <text x="80" y="75" textAnchor="middle" className="text-2xl font-bold" fill="#A020F0">
                          {attendanceSummary.attendance_rate || 0}%
                        </text>
                        <text x="80" y="95" textAnchor="middle" className="text-xs" fill="#6B7280">
                          Attendance
                        </text>
                      </svg>
                    </div>
                    
                    {/* Legend */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                        <span>Present ({attendanceSummary.present})</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                        <span>Absent ({attendanceSummary.absent})</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-indigo-500 mr-2"></div>
                        <span>Leave ({attendanceSummary.leave})</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                        <span>Half-Day ({attendanceSummary.half_day})</span>
                      </div>
                    </div>
                    
                    {/* Late/Early Stats */}
                    <div className="mt-4 pt-4 border-t flex justify-around text-center">
                      <div>
                        <p className="text-lg font-bold text-orange-500">{attendanceSummary.late_days}</p>
                        <p className="text-xs text-gray-500">Late Days</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-yellow-500">{attendanceSummary.early_leaves}</p>
                        <p className="text-xs text-gray-500">Early Leaves</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold" style={{color: '#A020F0'}}>{attendanceSummary.total_hours || 0}h</p>
                        <p className="text-xs text-gray-500">Total Hours</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Monthly Summary */}
                <div className="bg-white rounded-lg shadow-md">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Monthly Summary</h3>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {attendanceData.filter(record => record.status === 'Present').length}
                        </div>
                        <div className="text-sm text-gray-600">Days Present</div>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">
                          {attendanceData.filter(record => record.status === 'Absent').length}
                        </div>
                        <div className="text-sm text-gray-600">Days Absent</div>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {attendanceData.reduce((total, record) => total + (record.hours || 0), 0).toFixed(1)}
                        </div>
                        <div className="text-sm text-gray-600">Total Hours</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold" style={{color: '#A020F0'}}>
                          {((attendanceData.filter(record => record.status === 'Present').length / attendanceData.length) * 100).toFixed(0)}%
                        </div>
                        <div className="text-sm text-gray-600">Attendance Rate</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Attendance History */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Detailed Attendance History</h3>
                <p className="text-sm text-gray-600">Complete record of your attendance</p>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {attendanceData.map((record, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.date}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              record.status === 'Present' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {record.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.checkIn}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.checkOut}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.hours}h</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Auto-tracked</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'custom-requests' && (
          <div>
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Custom Requests & Meal Tokens</h3>
                <p className="text-sm text-gray-600">Submit custom requests and manage your meal tokens</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Custom Request Form */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Submit Custom Request</h4>
                    <form className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Request Type</label>
                        <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500">
                          <option>Equipment Request</option>
                          <option>Software Access</option>
                          <option>Training Request</option>
                          <option>Workspace Change</option>
                          <option>Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Subject</label>
                        <input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea rows={4} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"></textarea>
                      </div>
                      <button 
                        type="submit" 
                        className="w-full text-white py-2 px-4 rounded-md transition-colors"
                        style={{backgroundColor: '#A020F0'}}
                      >
                        Submit Request
                      </button>
                    </form>
                  </div>

                  {/* Meal Token Management */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Meal Token Management</h4>
                    
                    {!isMealEligible(employeeCategory) ? (
                      <div className="bg-gray-50 rounded-lg p-6 text-center">
                        <i className="fas fa-ban text-gray-400 text-4xl mb-3"></i>
                        <h5 className="text-lg font-semibold text-gray-700 mb-2">Not Eligible for Meal Tokens</h5>
                        <p className="text-sm text-gray-600">
                          As a {getLeaveEntitlement(employeeCategory).description} ({employeeCategory}), 
                          you are not entitled to meal tokens.
                        </p>
                      </div>
                    ) : (
                      <div>
                        {/* Meal Entitlement Info */}
                        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded mb-4">
                          <div className="flex items-start">
                            <i className="fas fa-check-circle text-green-600 mt-1 mr-3"></i>
                            <div>
                              <h5 className="text-sm font-medium text-green-800">Meal Token Eligible</h5>
                              <p className="text-sm text-green-700 mt-1">
                                Shift {shift} - Daily {getMealType(shift)} provided
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Today's Token */}
                        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg p-6 mb-4">
                          <div className="text-center">
                            <i className="fas fa-utensils text-orange-600 text-4xl mb-2"></i>
                            <h5 className="text-xl font-bold text-gray-900">Today's Meal</h5>
                            <p className="text-2xl font-bold text-orange-600 my-2">{getMealType(shift)}</p>
                            <p className="text-sm text-gray-600">Shift {shift} - Token Status: Pending</p>
                          </div>
                        </div>
                        
                        {/* Token Actions */}
                        <div className="space-y-3">
                          <button 
                            onClick={handleShowToken}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-md transition-colors flex items-center justify-center"
                          >
                            <i className="fas fa-qrcode mr-2"></i>
                            Show Today's Token
                          </button>
                          <button 
                            onClick={handleViewHistory}
                            className="w-full bg-white border border-orange-500 text-orange-500 py-2 px-4 rounded-md transition-colors hover:bg-orange-50 flex items-center justify-center"
                          >
                            <i className="fas fa-history mr-2"></i>
                            View Token History
                          </button>
                        </div>
                        
                        {/* This Month Summary */}
                        <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
                          <h6 className="text-sm font-medium text-gray-700 mb-2">This Month Summary</h6>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Tokens Issued:</span>
                              <span className="font-medium">{tokenSummary.issued + tokenSummary.used}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Tokens Used:</span>
                              <span className="font-medium text-green-600">{tokenSummary.used}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Tokens Cancelled:</span>
                              <span className="font-medium text-red-600">{tokenSummary.cancelled}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Token Display Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Today's Meal Token</h3>
              <button onClick={() => setShowTokenModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="p-6">
              {/* Token Card */}
              <div className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl p-6 text-white text-center shadow-lg">
                <div className="mb-4">
                  <i className="fas fa-utensils text-5xl opacity-80"></i>
                </div>
                <h4 className="text-2xl font-bold mb-1">{getMealType(shift)}</h4>
                <p className="text-orange-100 text-sm mb-4">Shift {shift} - {new Date().toLocaleDateString()}</p>
                
                {/* QR Code */}
                <div className="bg-white rounded-lg p-4 inline-block mb-4">
                  <QRCodeSVG 
                    value={JSON.stringify({
                      token_id: generateTokenId(),
                      employee_id: user?.employee_id,
                      employee_name: user?.name,
                      date: new Date().toISOString().slice(0, 10),
                      meal_type: getMealType(shift),
                      shift: shift,
                      category: employeeCategory
                    })}
                    size={128}
                    level="H"
                    includeMargin={true}
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>
                
                {/* Token ID */}
                <div className="bg-orange-700 bg-opacity-50 rounded-lg px-4 py-2">
                  <p className="text-xs text-orange-200">Token ID</p>
                  <p className="font-mono font-bold text-lg tracking-wider">{generateTokenId()}</p>
                </div>
              </div>
              
              {/* Token Details */}
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Employee</span>
                  <span className="font-medium">{user?.name || 'Employee'}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Category</span>
                  <span className="font-medium">{employeeCategory} - {getLeaveEntitlement(employeeCategory).description}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Valid For</span>
                  <span className="font-medium">Today Only</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Status</span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Active</span>
                </div>
              </div>
              
              {/* Instructions */}
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  <i className="fas fa-info-circle mr-1"></i>
                  Show this token at the cafeteria counter. Token is valid for today's {getMealType(shift).toLowerCase()} only.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg">
              <button 
                onClick={() => setShowTokenModal(false)}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Token History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Meal Token History</h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            
            {/* Summary Cards */}
            <div className="px-6 py-4 bg-gray-50 grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-blue-600">{tokenSummary.issued + tokenSummary.used}</div>
                <div className="text-xs text-gray-600">Total Issued</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-green-600">{tokenSummary.used}</div>
                <div className="text-xs text-gray-600">Used</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-red-600">{tokenSummary.cancelled}</div>
                <div className="text-xs text-gray-600">Cancelled</div>
              </div>
            </div>
            
            {/* History Table */}
            <div className="overflow-y-auto max-h-[400px]">
              <table className="min-w-full">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meal</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shift</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mealTokenHistory.map((token, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(token.token_date).toLocaleDateString('en-US', { 
                          weekday: 'short', month: 'short', day: 'numeric' 
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <span className="flex items-center">
                          <i className={`fas fa-${token.meal_type === 'Breakfast' ? 'coffee' : token.meal_type === 'Lunch' ? 'sun' : 'moon'} mr-2 text-orange-500`}></i>
                          {token.meal_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">Shift {token.shift}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          token.status === 'Used' ? 'bg-green-100 text-green-700' :
                          token.status === 'Issued' ? 'bg-blue-100 text-blue-700' :
                          token.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {token.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg">
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;