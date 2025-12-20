import React, { useState } from 'react';

export const AddEditEmployeeModal = ({ 
  show, 
  isEdit, 
  formData, 
  setFormData, 
  formErrors, 
  masterData, 
  onSubmit, 
  onClose, 
  submitLoading 
}) => {
  if (!show) return null;

  const categoryOptions = [
    { value: 'S001', label: 'S001 - Staff' },
    { value: 'W001', label: 'W001 - Worker' },
    { value: 'M001', label: 'M001 - Migrant Worker' },
    { value: 'T001', label: 'T001 - Trainee' }
  ];

  const shiftOptions = [
    { value: '1', label: 'Shift 1 (08:00 - 16:00)' },
    { value: '2', label: 'Shift 2 (16:00 - 00:00)' },
    { value: '3', label: 'Shift 3 (00:00 - 08:00)' }
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-xl font-semibold text-gray-900">
            {isEdit ? 'Edit Employee' : 'Add New Employee'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Employee ID - Auto-generated, Read-only */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employee ID (Auto-generated)
              </label>
              <input
                type="text"
                value={formData.employee_id}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                disabled
                readOnly
              />
              <p className="mt-1 text-xs text-gray-500">
                {isEdit ? 'Employee ID cannot be changed' : 'ID will be assigned automatically'}
              </p>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  formErrors.full_name ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {formErrors.full_name && (
                <p className="mt-1 text-sm text-red-600">{formErrors.full_name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  formErrors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {formErrors.email && (
                <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="+91 9876543210"
              />
            </div>

            {/* Department */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department
              </label>
              <select
                value={formData.department}
                onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Department</option>
                {masterData.departments.map(dept => (
                  <option key={dept.id} value={dept.dept_name}>{dept.dept_name}</option>
                ))}
              </select>
            </div>

            {/* Designation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Designation
              </label>
              <select
                value={formData.position}
                onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Designation</option>
                {masterData.designations.map(desig => (
                  <option key={desig.id} value={desig.designation_name}>{desig.designation_name}</option>
                ))}
              </select>
            </div>

            {/* Hire Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hire Date
              </label>
              <input
                type="date"
                value={formData.hire_date}
                onChange={(e) => setFormData(prev => ({ ...prev, hire_date: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Employee Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employee Category
              </label>
              <select
                value={formData.employee_category}
                onChange={(e) => setFormData(prev => ({ ...prev, employee_category: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {categoryOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Shift */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shift
              </label>
              <select
                value={formData.shift}
                onChange={(e) => setFormData(prev => ({ ...prev, shift: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None (Staff)</option>
                {shiftOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Leave Balance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Leave Balance
              </label>
              <input
                type="number"
                value={formData.leave_balance}
                onChange={(e) => setFormData(prev => ({ ...prev, leave_balance: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
              />
            </div>

            {/* Username - Only for new employee */}
            {!isEdit && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    formErrors.username ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                  placeholder="Enter username for login"
                />
                {formErrors.username && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.username}</p>
                )}
              </div>
            )}

            {/* Password - Only for new employee */}
            {!isEdit && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    formErrors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                  placeholder="Create password for employee"
                  minLength="6"
                />
                {formErrors.password && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Minimum 6 characters. You will need to provide this to the employee.
                </p>
              </div>
            )}

            {/* Address */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows="3"
                placeholder="Full address with city, state, pincode"
              />
            </div>
          </div>

          {!isEdit && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>⚠️ Important:</strong> After creating the employee, a popup will display the credentials. 
                Please save them and provide to the employee manually. No email will be sent.
              </p>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {isEdit ? 'Update Employee' : 'Create Employee'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ViewEmployeeModal = ({ show, employee, onClose }) => {
  const [generatingCredentials, setGeneratingCredentials] = useState(false);
  const [credentials, setCredentials] = useState(null);

  if (!show || !employee) return null;

  const hasCredentials = employee.username && employee.password_hash;

  const handleGenerateCredentials = async () => {
    if (!window.confirm(`Generate login credentials for ${employee.full_name}?`)) {
      return;
    }

    setGeneratingCredentials(true);
    try {
      const token = localStorage.getItem('ves_token');
      const response = await fetch(`http://localhost:5000/api/hr/employees/${employee.employee_id}/credentials`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCredentials(data);
        // Update the employee object with new credentials
        employee.username = data.username;
        employee.password_hash = 'generated';
        alert('Credentials generated successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to generate credentials: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error generating credentials:', error);
      alert('Failed to generate credentials. Please try again.');
    } finally {
      setGeneratingCredentials(false);
    }
  };

  const InfoRow = ({ label, value }) => (
    <div className="py-3 border-b border-gray-200">
      <dt className="text-sm font-medium text-gray-500 mb-1">{label}</dt>
      <dd className="text-sm text-gray-900">{value || '-'}</dd>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-xl font-semibold text-gray-900">Employee Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4">
          <div className="flex items-center mb-6 pb-6 border-b border-gray-200">
            <div className="flex-shrink-0 h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-3xl font-bold text-blue-600">
                {employee.full_name?.charAt(0) || '?'}
              </span>
            </div>
            <div className="ml-6">
              <h4 className="text-2xl font-bold text-gray-900">{employee.full_name}</h4>
              <p className="text-sm text-gray-500 mt-1">{employee.position || 'No designation'}</p>
              <span className={`mt-2 inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                employee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {employee.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <InfoRow label="Employee ID" value={employee.employee_id} />
            <InfoRow label="Email" value={employee.email} />
            <InfoRow label="Phone" value={employee.phone} />
            <InfoRow label="Department" value={employee.department} />
            <InfoRow label="Designation" value={employee.position} />
            <InfoRow label="Category" value={employee.employee_category} />
            <InfoRow label="Shift" value={employee.shift ? `Shift ${employee.shift}` : 'None (Staff)'} />
            <InfoRow label="Hire Date" value={employee.hire_date} />
            <InfoRow label="Leave Balance" value={`${employee.leave_balance} days`} />
            <InfoRow label="Address" value={employee.address} />
          </dl>

          {/* Login Credentials Section */}
          <div className="mt-6 border-t border-gray-200 pt-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Login Credentials
            </h4>

            {hasCredentials || credentials ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-blue-700 mb-1">Username</p>
                    <p className="text-sm font-mono font-semibold text-blue-900 select-all">
                      {credentials?.username || employee.username}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(credentials?.username || employee.username);
                      alert('Username copied!');
                    }}
                    className="ml-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Copy
                  </button>
                </div>

                {credentials?.password && (
                  <div className="flex items-center justify-between border-t border-blue-300 pt-3">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-blue-700 mb-1">Password (Temporary)</p>
                      <p className="text-sm font-mono font-semibold text-blue-900 select-all">
                        {credentials.password}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">⚠️ Save this now - it won't be shown again</p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(credentials.password);
                        alert('Password copied!');
                      }}
                      className="ml-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Copy
                    </button>
                  </div>
                )}

                {!credentials && hasCredentials && (
                  <div className="border-t border-blue-300 pt-3">
                    <p className="text-xs font-medium text-blue-700 mb-1">Password</p>
                    <p className="text-sm text-gray-700">
                      Default: <code className="bg-white px-2 py-1 rounded font-mono text-blue-900">Ves@{employee.employee_id}</code>
                    </p>
                    <p className="text-xs text-gray-600 mt-2 italic">
                      ℹ️ Employee can change password anytime from their profile
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-3">
                  No login credentials generated yet. Generate credentials to allow this employee to access the system.
                </p>
                <button
                  onClick={handleGenerateCredentials}
                  disabled={generatingCredentials}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {generatingCredentials ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Generate Credentials
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end border-t border-gray-200 pt-4">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
