-- ============================================================
-- VES HRMS - SQL Server Database Schema
-- For Production Deployment with SQL Server Management Studio (SSMS)
-- ============================================================
-- 
-- INSTRUCTIONS:
-- 1. Open SSMS and connect to your SQL Server
-- 2. Create database: CREATE DATABASE VES_HRMS;
-- 3. Select VES_HRMS database
-- 4. Run this entire script
-- ============================================================

USE VES_HRMS;
GO

-- ============================================================
-- TABLE: users - All employees, HR, and admin users
-- ============================================================
CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    employee_id NVARCHAR(50) UNIQUE NOT NULL,
    username NVARCHAR(100) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    email NVARCHAR(255),
    full_name NVARCHAR(255) NOT NULL,
    role NVARCHAR(50) DEFAULT 'employee' CHECK (role IN ('employee', 'hr', 'admin', 'super_admin')),
    department NVARCHAR(100),
    designation NVARCHAR(100),
    phone NVARCHAR(20),
    date_of_joining DATE,
    date_of_birth DATE,
    gender NVARCHAR(20),
    address NVARCHAR(MAX),
    emergency_contact NVARCHAR(100),
    blood_group NVARCHAR(10),
    profile_image NVARCHAR(255),
    is_active BIT DEFAULT 1,
    is_blocked BIT DEFAULT 0,
    employee_category NVARCHAR(10) DEFAULT 'S001' CHECK (employee_category IN ('S001', 'W001', 'M001', 'T001')),
    shift INT DEFAULT 1 CHECK (shift IN (1, 2, 3)),
    salary DECIMAL(12, 2) DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    last_login DATETIME,
    password_changed_at DATETIME,
    must_change_password BIT DEFAULT 0,
    current_session_id NVARCHAR(255)
);
GO

-- Create indexes for users table
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_department ON users(department);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_employee_category ON users(employee_category);
GO

-- ============================================================
-- TABLE: attendance - Daily attendance records
-- ============================================================
CREATE TABLE attendance (
    id INT IDENTITY(1,1) PRIMARY KEY,
    employee_id NVARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    clock_in TIME,
    clock_out TIME,
    status NVARCHAR(20) DEFAULT 'Absent' CHECK (status IN ('Present', 'Absent', 'Half Day', 'Leave', 'Holiday', 'Weekend')),
    hours_worked DECIMAL(5, 2),
    overtime_hours DECIMAL(5, 2) DEFAULT 0,
    is_late BIT DEFAULT 0,
    late_by_minutes INT DEFAULT 0,
    is_early_leave BIT DEFAULT 0,
    early_by_minutes INT DEFAULT 0,
    notes NVARCHAR(MAX),
    modified_by NVARCHAR(50),
    modification_reason NVARCHAR(MAX),
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    CONSTRAINT fk_attendance_employee FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE,
    CONSTRAINT uq_attendance_employee_date UNIQUE (employee_id, date)
);
GO

CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_status ON attendance(status);
GO

-- ============================================================
-- TABLE: leaves - Leave requests and approvals
-- ============================================================
CREATE TABLE leaves (
    id INT IDENTITY(1,1) PRIMARY KEY,
    employee_id NVARCHAR(50) NOT NULL,
    leave_type NVARCHAR(20) NOT NULL CHECK (leave_type IN ('CL', 'SL', 'EL', 'LOP', 'Half Day', 'Comp Off')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(4, 1) NOT NULL,
    is_half_day BIT DEFAULT 0,
    half_day_session NVARCHAR(20) CHECK (half_day_session IN ('First Half', 'Second Half')),
    reason NVARCHAR(MAX) NOT NULL,
    status NVARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
    approved_by NVARCHAR(50),
    approved_at DATETIME,
    rejection_reason NVARCHAR(MAX),
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    CONSTRAINT fk_leaves_employee FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE
);
GO

CREATE INDEX idx_leaves_status ON leaves(status);
CREATE INDEX idx_leaves_dates ON leaves(start_date, end_date);
GO

-- ============================================================
-- TABLE: leave_balance - Annual leave balance tracking
-- ============================================================
CREATE TABLE leave_balance (
    id INT IDENTITY(1,1) PRIMARY KEY,
    employee_id NVARCHAR(50) NOT NULL,
    year INT NOT NULL,
    casual_leave DECIMAL(4, 1) DEFAULT 12,
    sick_leave DECIMAL(4, 1) DEFAULT 12,
    earned_leave DECIMAL(4, 1) DEFAULT 15,
    casual_leave_used DECIMAL(4, 1) DEFAULT 0,
    sick_leave_used DECIMAL(4, 1) DEFAULT 0,
    earned_leave_used DECIMAL(4, 1) DEFAULT 0,
    lop_days DECIMAL(4, 1) DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    CONSTRAINT fk_leave_balance_employee FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE,
    CONSTRAINT uq_leave_balance_employee_year UNIQUE (employee_id, year)
);
GO

-- ============================================================
-- TABLE: documents - Employee document uploads
-- ============================================================
CREATE TABLE documents (
    id INT IDENTITY(1,1) PRIMARY KEY,
    employee_id NVARCHAR(50) NOT NULL,
    document_type NVARCHAR(50) NOT NULL,
    document_name NVARCHAR(255) NOT NULL,
    file_path NVARCHAR(500) NOT NULL,
    file_size INT,
    mime_type NVARCHAR(100),
    status NVARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    reviewed_by NVARCHAR(50),
    reviewed_at DATETIME,
    notes NVARCHAR(MAX),
    uploaded_at DATETIME DEFAULT GETDATE(),
    CONSTRAINT fk_documents_employee FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE
);
GO

-- ============================================================
-- TABLE: payroll - Monthly payroll records
-- ============================================================
CREATE TABLE payroll (
    id INT IDENTITY(1,1) PRIMARY KEY,
    employee_id NVARCHAR(50) NOT NULL,
    month NVARCHAR(7) NOT NULL,
    basic_salary DECIMAL(12, 2) NOT NULL,
    hra DECIMAL(12, 2) DEFAULT 0,
    conveyance_allowance DECIMAL(12, 2) DEFAULT 0,
    medical_allowance DECIMAL(12, 2) DEFAULT 0,
    special_allowance DECIMAL(12, 2) DEFAULT 0,
    overtime_pay DECIMAL(12, 2) DEFAULT 0,
    bonus DECIMAL(12, 2) DEFAULT 0,
    gross_salary DECIMAL(12, 2) DEFAULT 0,
    pf_deduction DECIMAL(12, 2) DEFAULT 0,
    esi_deduction DECIMAL(12, 2) DEFAULT 0,
    tax_deduction DECIMAL(12, 2) DEFAULT 0,
    professional_tax DECIMAL(12, 2) DEFAULT 0,
    other_deductions DECIMAL(12, 2) DEFAULT 0,
    lop_deduction DECIMAL(12, 2) DEFAULT 0,
    total_deductions DECIMAL(12, 2) DEFAULT 0,
    net_pay DECIMAL(12, 2) NOT NULL,
    worked_days INT DEFAULT 0,
    leave_days INT DEFAULT 0,
    lop_days INT DEFAULT 0,
    overtime_hours DECIMAL(5, 2) DEFAULT 0,
    payment_status NVARCHAR(20) DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Processed', 'Paid')),
    payment_date DATE,
    processed_by NVARCHAR(50),
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    CONSTRAINT fk_payroll_employee FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE,
    CONSTRAINT uq_payroll_employee_month UNIQUE (employee_id, month)
);
GO

CREATE INDEX idx_payroll_month ON payroll(month);
CREATE INDEX idx_payroll_status ON payroll(payment_status);
GO

-- ============================================================
-- TABLE: audit_logs - Security and compliance tracking
-- ============================================================
CREATE TABLE audit_logs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id NVARCHAR(50),
    action NVARCHAR(100) NOT NULL,
    details NVARCHAR(MAX),
    ip_address NVARCHAR(50),
    user_agent NVARCHAR(500),
    timestamp DATETIME DEFAULT GETDATE()
);
GO

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
GO

-- ============================================================
-- TABLE: meal_tokens - Cafeteria meal tokens
-- ============================================================
CREATE TABLE meal_tokens (
    id INT IDENTITY(1,1) PRIMARY KEY,
    employee_id NVARCHAR(50) NOT NULL,
    token_date DATE NOT NULL,
    shift INT DEFAULT 1,
    meal_type NVARCHAR(20) CHECK (meal_type IN ('Breakfast', 'Lunch', 'Dinner')),
    status NVARCHAR(20) DEFAULT 'Issued' CHECK (status IN ('Issued', 'Used', 'Cancelled')),
    generated_at DATETIME DEFAULT GETDATE(),
    used_at DATETIME,
    CONSTRAINT fk_meal_tokens_employee FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE,
    CONSTRAINT uq_meal_token_employee_date UNIQUE (employee_id, token_date)
);
GO

-- ============================================================
-- TABLE: custom_requests - Special requests
-- ============================================================
CREATE TABLE custom_requests (
    id INT IDENTITY(1,1) PRIMARY KEY,
    employee_id NVARCHAR(50) NOT NULL,
    request_type NVARCHAR(50) NOT NULL CHECK (request_type IN ('Lunch Token', 'Early Exit', 'Late Entry', 'Equipment', 'Other')),
    description NVARCHAR(MAX) NOT NULL,
    date_needed DATE NOT NULL,
    status NVARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    approved_by NVARCHAR(50),
    approved_at DATETIME,
    notes NVARCHAR(MAX),
    created_at DATETIME DEFAULT GETDATE(),
    CONSTRAINT fk_custom_requests_employee FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE
);
GO

-- ============================================================
-- TABLE: system_settings - Application configuration
-- ============================================================
CREATE TABLE system_settings (
    id INT IDENTITY(1,1) PRIMARY KEY,
    setting_key NVARCHAR(100) UNIQUE NOT NULL,
    setting_value NVARCHAR(MAX),
    setting_type NVARCHAR(50) DEFAULT 'string',
    description NVARCHAR(MAX),
    updated_at DATETIME DEFAULT GETDATE(),
    updated_by NVARCHAR(50)
);
GO

-- ============================================================
-- TABLE: password_reset_tokens - For forgot password
-- ============================================================
CREATE TABLE password_reset_tokens (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id NVARCHAR(50) NOT NULL,
    token NVARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    used BIT DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE(),
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(employee_id) ON DELETE CASCADE
);
GO

-- ============================================================
-- TABLE: otp_tokens - For email verification
-- ============================================================
CREATE TABLE otp_tokens (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id NVARCHAR(50) NOT NULL,
    otp_code NVARCHAR(10) NOT NULL,
    purpose NVARCHAR(50) NOT NULL,
    expires_at DATETIME NOT NULL,
    used BIT DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE(),
    CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES users(employee_id) ON DELETE CASCADE
);
GO

-- ============================================================
-- INSERT DEFAULT DATA
-- ============================================================

-- Default system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('company_name', 'VES HRMS', 'string', 'Company name displayed in emails and UI'),
('smtp_server', 'smtp.gmail.com', 'string', 'SMTP server address'),
('smtp_port', '587', 'number', 'SMTP server port'),
('smtp_email', '', 'string', 'SMTP email address'),
('smtp_password', '', 'password', 'SMTP email password'),
('frontend_url', 'http://localhost:3000', 'string', 'Frontend application URL'),
('office_start_time', '09:00', 'time', 'Office start time'),
('office_end_time', '18:00', 'time', 'Office end time'),
('late_threshold_minutes', '15', 'number', 'Minutes after which employee is marked late'),
('working_days_per_month', '26', 'number', 'Standard working days per month');
GO

-- Default admin user (password: admin123)
-- Password hash for 'admin123' using bcrypt
INSERT INTO users (employee_id, username, password_hash, email, full_name, role, department, designation, is_active)
VALUES ('ADMIN001', 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VUlm.h/HqK0qeG', 'admin@company.com', 'System Administrator', 'admin', 'IT', 'Administrator', 1);
GO

PRINT 'VES HRMS Database Schema Created Successfully!';
PRINT 'Default admin user created: admin / admin123';
PRINT 'Please change the admin password after first login.';
GO
