-- ================================================================
-- VES HRMS - SQL Server Production Database Schema
-- ================================================================
-- Version: 2.0
-- Database: VES_HRMS
-- Target: Microsoft SQL Server 2016+
-- Created: December 13, 2025
-- ================================================================

-- Database Creation (Run separately if needed)
/*
USE master;
GO

IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'VES_HRMS')
BEGIN
    CREATE DATABASE VES_HRMS;
END;
GO

USE VES_HRMS;
GO
*/

-- ================================================================
-- CORE TABLES
-- ================================================================

-- Users Table: Core employee data with role-based access (matches production Eview)
CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    employee_id NVARCHAR(50) UNIQUE NOT NULL,
    username NVARCHAR(100) UNIQUE NOT NULL,
    email NVARCHAR(255) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    full_name NVARCHAR(200) NOT NULL,
    role NVARCHAR(20) DEFAULT 'Employee' CHECK (role IN ('Employee', 'HR', 'Admin', 'MD')),
    employee_category NVARCHAR(10) DEFAULT 'S001' CHECK (employee_category IN ('S001', 'W001', 'M001', 'T001')),
    shift NVARCHAR(10) CHECK (shift IN ('1', '2', '3') OR shift IS NULL),
    department NVARCHAR(100),
    position NVARCHAR(100),
    hire_date DATE NOT NULL,
    salary DECIMAL(12,2),
    phone NVARCHAR(20),
    address NVARCHAR(500),
    emergency_contact NVARCHAR(200),
    leave_balance INT DEFAULT 12,
    is_active BIT DEFAULT 1,
    account_status NVARCHAR(20) DEFAULT 'Active' CHECK (account_status IN ('Active', 'Inactive', 'Blocked')),
    active_session_id NVARCHAR(500),
    
    -- Personal Information (from Eview)
    gender NVARCHAR(20) CHECK (gender IN ('Male', 'Female', 'Other')),
    date_of_birth DATE,
    blood_group_id INT,
    marital_status NVARCHAR(20) CHECK (marital_status IN ('Single', 'Married', 'Divorced', 'Widowed')),
    
    -- Address Information
    address_type NVARCHAR(20) DEFAULT 'Current' CHECK (address_type IN ('Current', 'Permanent')),
    address_line2 NVARCHAR(500),
    city NVARCHAR(100),
    pincode NVARCHAR(10),
    
    -- Assignment & Hierarchy
    designation_id INT,
    reporting_to_id INT,
    reporting_manager_name NVARCHAR(200),
    branch_id INT,
    branch_name NVARCHAR(200),
    branch_code NVARCHAR(50),
    
    -- Grade & Level System
    grade_id INT,
    grade_name NVARCHAR(100),
    level_id INT,
    level_name NVARCHAR(100),
    
    -- Section & Job Role
    section_id INT,
    section_name NVARCHAR(100),
    job_role_id INT,
    job_role_name NVARCHAR(200),
    
    -- Category Details
    category_id INT,
    category_group_id INT,
    
    -- Work Hours & Shift
    working_hours_per_day DECIMAL(5,2),
    contract_hours DECIMAL(5,2),
    ot_hours DECIMAL(5,2),
    shift_code NVARCHAR(50),
    shift_period NVARCHAR(50),
    shift_day NVARCHAR(50),
    
    -- Compensation
    pf_contribution DECIMAL(12,2),
    esi_contribution DECIMAL(12,2),
    net_pay DECIMAL(12,2),
    salary_per_hour DECIMAL(12,2),
    
    -- PF/ESI Eligibility
    pf_applicable BIT DEFAULT 0,
    pf_contribution_enabled BIT DEFAULT 0,
    esi_applicable BIT DEFAULT 0,
    esi_day NVARCHAR(50),
    esi_date_of_joining DATE,
    
    -- Experience & Photo
    experience NVARCHAR(100),
    has_photo BIT DEFAULT 0,
    photo_path NVARCHAR(500),
    
    -- Status & Important Dates
    date_of_leaving DATE,
    left_status BIT DEFAULT 0,
    confirmation_status BIT DEFAULT 0,
    actual_date_of_birth DATE,
    actual_date_of_joining DATE,
    adjusted_date_of_joining DATE,
    relieving_date DATE,
    resignation_date DATE,
    resignation_acceptance_date DATE,
    
    -- Notice Period
    notice_period_days INT,
    
    -- Cost Center
    cost_center_id INT,
    cost_center_name NVARCHAR(200),
    salary_center_id INT,
    salary_center_name NVARCHAR(200),
    
    -- Skills & Facilities
    skill_id INT,
    skill_name NVARCHAR(200),
    hostel_flag BIT DEFAULT 0,
    hostel_id INT,
    hostel_name NVARCHAR(200),
    bus_id INT,
    bus_number NVARCHAR(50),
    room_number NVARCHAR(50),
    room_name NVARCHAR(100),
    
    -- Ledger & Access
    salary_ledger NVARCHAR(100),
    loan_ledger NVARCHAR(100),
    savings_ledger NVARCHAR(100),
    access_code NVARCHAR(50),
    employee_code NVARCHAR(50),
    
    -- System fields
    last_login DATETIME2,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Indexes for users table
CREATE NONCLUSTERED INDEX idx_users_employee_id ON users(employee_id);
CREATE NONCLUSTERED INDEX idx_users_username ON users(username);
CREATE NONCLUSTERED INDEX idx_users_role ON users(role);
CREATE NONCLUSTERED INDEX idx_users_active ON users(is_active);
CREATE NONCLUSTERED INDEX idx_users_department ON users(department);
CREATE NONCLUSTERED INDEX idx_users_gender ON users(gender);
CREATE NONCLUSTERED INDEX idx_users_blood_group ON users(blood_group_id);
CREATE NONCLUSTERED INDEX idx_users_designation ON users(designation_id);
CREATE NONCLUSTERED INDEX idx_users_branch ON users(branch_id);
CREATE NONCLUSTERED INDEX idx_users_grade ON users(grade_id);
CREATE NONCLUSTERED INDEX idx_users_level ON users(level_id);
CREATE NONCLUSTERED INDEX idx_users_section ON users(section_id);
CREATE NONCLUSTERED INDEX idx_users_job_role ON users(job_role_id);
CREATE NONCLUSTERED INDEX idx_users_reporting_to ON users(reporting_to_id);
CREATE NONCLUSTERED INDEX idx_users_left_status ON users(left_status);
CREATE NONCLUSTERED INDEX idx_users_pincode ON users(pincode);
CREATE NONCLUSTERED INDEX idx_users_city ON users(city);
GO

-- ================================================================
-- ATTENDANCE & TIME MANAGEMENT
-- ================================================================

-- Attendance Table: Daily punch records
CREATE TABLE attendance (
    id INT IDENTITY(1,1) PRIMARY KEY,
    employee_id NVARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    clock_in TIME,
    clock_out TIME,
    status NVARCHAR(20) DEFAULT 'Absent' CHECK (status IN ('Present', 'Absent', 'Half-Day', 'Leave', 'OT')),
    hours_worked DECIMAL(5,2),
    notes NVARCHAR(500),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_attendance_employee FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE,
    CONSTRAINT UQ_attendance_emp_date UNIQUE(employee_id, date)
);
GO

-- Indexes for attendance table
CREATE NONCLUSTERED INDEX idx_attendance_emp_date ON attendance(employee_id, date);
CREATE NONCLUSTERED INDEX idx_attendance_date ON attendance(date);
CREATE NONCLUSTERED INDEX idx_attendance_status ON attendance(status);
GO

-- ================================================================
-- MEAL TOKEN MANAGEMENT
-- ================================================================

-- Meal Tokens Table
CREATE TABLE meal_tokens (
    id INT IDENTITY(1,1) PRIMARY KEY,
    employee_id NVARCHAR(50) NOT NULL,
    token_date DATE NOT NULL,
    shift NVARCHAR(10) NOT NULL CHECK (shift IN ('1', '2', '3')),
    meal_type NVARCHAR(20) NOT NULL CHECK (meal_type IN ('Lunch', 'Dinner', 'Breakfast')),
    employee_category NVARCHAR(10) NOT NULL CHECK (employee_category IN ('W001', 'M001')),
    status NVARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Issued', 'Used', 'Cancelled')),
    generated_at DATETIME2 DEFAULT GETDATE(),
    used_at DATETIME2,
    notes NVARCHAR(500),
    CONSTRAINT FK_meal_tokens_employee FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE,
    CONSTRAINT UQ_meal_token_emp_date UNIQUE(employee_id, token_date)
);
GO

-- Indexes for meal_tokens table
CREATE NONCLUSTERED INDEX idx_meal_tokens_employee ON meal_tokens(employee_id);
CREATE NONCLUSTERED INDEX idx_meal_tokens_date ON meal_tokens(token_date);
CREATE NONCLUSTERED INDEX idx_meal_tokens_status ON meal_tokens(status);
GO

-- ================================================================
-- LEAVE MANAGEMENT
-- ================================================================

-- Leave Applications Table
CREATE TABLE leave_applications (
    id INT IDENTITY(1,1) PRIMARY KEY,
    employee_id NVARCHAR(50) NOT NULL,
    leave_type NVARCHAR(50) NOT NULL CHECK (leave_type IN ('CL', 'SL', 'EL', 'Half-Day', 'Maternity Leave', 'Paternity Leave', 'Emergency Leave', 'LOP')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested DECIMAL(5,2) NOT NULL,
    is_half_day BIT DEFAULT 0,
    half_day_session NVARCHAR(20) CHECK (half_day_session IN ('First Half', 'Second Half') OR half_day_session IS NULL),
    reason NVARCHAR(1000) NOT NULL,
    status NVARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
    approved_by NVARCHAR(100),
    approved_on DATETIME2,
    rejection_reason NVARCHAR(500),
    applied_on DATETIME2 DEFAULT GETDATE(),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_leave_applications_employee FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE
);
GO

-- Indexes for leave_applications
CREATE NONCLUSTERED INDEX idx_leave_applications_employee ON leave_applications(employee_id);
CREATE NONCLUSTERED INDEX idx_leave_applications_status ON leave_applications(status);
CREATE NONCLUSTERED INDEX idx_leave_applications_dates ON leave_applications(start_date, end_date);
GO

-- Leave Balances Table
CREATE TABLE leave_balances (
    id INT IDENTITY(1,1) PRIMARY KEY,
    employee_id NVARCHAR(50) NOT NULL,
    leave_year INT NOT NULL,
    casual_leave_total INT DEFAULT 12,
    casual_leave_used DECIMAL(5,2) DEFAULT 0,
    sick_leave_total INT DEFAULT 12,
    sick_leave_used DECIMAL(5,2) DEFAULT 0,
    earned_leave_total INT DEFAULT 15,
    earned_leave_used DECIMAL(5,2) DEFAULT 0,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_leave_balances_employee FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE,
    CONSTRAINT UQ_leave_balances_emp_year UNIQUE(employee_id, leave_year)
);
GO

-- Indexes for leave_balances
CREATE NONCLUSTERED INDEX idx_leave_balances_employee ON leave_balances(employee_id);
CREATE NONCLUSTERED INDEX idx_leave_balances_year ON leave_balances(leave_year);
GO

-- ================================================================
-- PAYROLL MANAGEMENT
-- ================================================================

-- Payroll Table
CREATE TABLE payroll (
    id INT IDENTITY(1,1) PRIMARY KEY,
    employee_id NVARCHAR(50) NOT NULL,
    month NVARCHAR(7) NOT NULL, -- Format: YYYY-MM
    basic_salary DECIMAL(12,2) DEFAULT 0,
    hra DECIMAL(12,2) DEFAULT 0,
    allowances DECIMAL(12,2) DEFAULT 0,
    overtime_amount DECIMAL(12,2) DEFAULT 0,
    gross_salary DECIMAL(12,2) DEFAULT 0,
    pf_deduction DECIMAL(12,2) DEFAULT 0,
    tax_deduction DECIMAL(12,2) DEFAULT 0,
    other_deductions DECIMAL(12,2) DEFAULT 0,
    net_salary DECIMAL(12,2) DEFAULT 0,
    present_days INT DEFAULT 0,
    absent_days INT DEFAULT 0,
    leave_days DECIMAL(5,2) DEFAULT 0,
    working_days INT DEFAULT 0,
    status NVARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Approved', 'Paid', 'Cancelled')),
    paid_on DATETIME2,
    payment_mode NVARCHAR(50) CHECK (payment_mode IN ('Bank Transfer', 'Cash', 'Cheque')),
    notes NVARCHAR(500),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_payroll_employee FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE,
    CONSTRAINT UQ_payroll_emp_month UNIQUE(employee_id, month)
);
GO

-- Indexes for payroll
CREATE NONCLUSTERED INDEX idx_payroll_employee ON payroll(employee_id);
CREATE NONCLUSTERED INDEX idx_payroll_month ON payroll(month);
CREATE NONCLUSTERED INDEX idx_payroll_status ON payroll(status);
GO

-- ================================================================
-- MASTER DATA TABLES
-- ================================================================

-- Master Departments
CREATE TABLE master_departments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    dept_name NVARCHAR(100) UNIQUE NOT NULL,
    description NVARCHAR(500),
    created_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Master Designations
CREATE TABLE master_designations (
    id INT IDENTITY(1,1) PRIMARY KEY,
    designation_name NVARCHAR(100) UNIQUE NOT NULL,
    description NVARCHAR(500),
    created_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Master Branches
CREATE TABLE master_branches (
    id INT IDENTITY(1,1) PRIMARY KEY,
    branch_name NVARCHAR(100) UNIQUE NOT NULL,
    location NVARCHAR(200),
    created_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Master Divisions
CREATE TABLE master_divisions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    division_name NVARCHAR(100) UNIQUE NOT NULL,
    description NVARCHAR(500),
    created_at DATETIME2 DEFAULT GETDATE()
);
GO

-- ================================================================
-- AUDIT & LOGGING
-- ================================================================

-- Audit Log Table
CREATE TABLE audit_logs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    action_type NVARCHAR(50) NOT NULL,
    username NVARCHAR(100),
    employee_id NVARCHAR(50),
    details NVARCHAR(MAX), -- JSON format
    ip_address NVARCHAR(50),
    user_agent NVARCHAR(500),
    timestamp DATETIME2 DEFAULT GETDATE()
);
GO

-- Indexes for audit_logs
CREATE NONCLUSTERED INDEX idx_audit_logs_action ON audit_logs(action_type);
CREATE NONCLUSTERED INDEX idx_audit_logs_user ON audit_logs(username);
CREATE NONCLUSTERED INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
GO

-- Blacklisted Tokens Table (for JWT invalidation)
CREATE TABLE blacklisted_tokens (
    id INT IDENTITY(1,1) PRIMARY KEY,
    jti NVARCHAR(255) UNIQUE NOT NULL,
    token NVARCHAR(MAX) NOT NULL,
    blacklisted_at DATETIME2 DEFAULT GETDATE(),
    expires_at DATETIME2 NOT NULL
);
GO

CREATE NONCLUSTERED INDEX idx_blacklisted_tokens_jti ON blacklisted_tokens(jti);
CREATE NONCLUSTERED INDEX idx_blacklisted_tokens_expires ON blacklisted_tokens(expires_at);
GO

-- ================================================================
-- SYSTEM SETTINGS
-- ================================================================

-- System Settings Table
CREATE TABLE system_settings (
    id INT IDENTITY(1,1) PRIMARY KEY,
    setting_key NVARCHAR(100) UNIQUE NOT NULL,
    setting_value NVARCHAR(MAX),
    description NVARCHAR(500),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

-- ================================================================
-- VIEWS FOR REPORTING
-- ================================================================

-- Employee Summary View
CREATE VIEW vw_employee_summary AS
SELECT 
    u.employee_id,
    u.full_name,
    u.email,
    u.department,
    u.position,
    u.employee_category,
    u.shift,
    u.is_active,
    u.account_status,
    u.hire_date,
    lb.casual_leave_total - lb.casual_leave_used AS casual_leave_available,
    lb.sick_leave_total - lb.sick_leave_used AS sick_leave_available,
    lb.earned_leave_total - lb.earned_leave_used AS earned_leave_available
FROM users u
LEFT JOIN leave_balances lb ON u.employee_id = lb.employee_id 
    AND lb.leave_year = YEAR(GETDATE());
GO

-- Monthly Attendance Summary View
CREATE VIEW vw_monthly_attendance AS
SELECT 
    u.employee_id,
    u.full_name,
    u.department,
    FORMAT(a.date, 'yyyy-MM') AS month,
    COUNT(CASE WHEN a.status = 'Present' THEN 1 END) AS present_days,
    COUNT(CASE WHEN a.status = 'Absent' THEN 1 END) AS absent_days,
    COUNT(CASE WHEN a.status = 'Leave' THEN 1 END) AS leave_days,
    COUNT(CASE WHEN a.status = 'Half-Day' THEN 1 END) AS half_days,
    AVG(a.hours_worked) AS avg_hours_worked
FROM users u
LEFT JOIN attendance a ON u.employee_id = a.employee_id
WHERE u.is_active = 1
GROUP BY u.employee_id, u.full_name, u.department, FORMAT(a.date, 'yyyy-MM');
GO

-- ================================================================
-- STORED PROCEDURES (Optional - for complex operations)
-- ================================================================

-- Procedure to auto-generate meal tokens
CREATE PROCEDURE sp_generate_daily_meal_tokens
    @token_date DATE
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO meal_tokens (employee_id, token_date, shift, meal_type, employee_category, status)
    SELECT 
        a.employee_id,
        a.date,
        u.shift,
        CASE u.shift
            WHEN '1' THEN 'Lunch'
            WHEN '2' THEN 'Dinner'
            WHEN '3' THEN 'Breakfast'
        END AS meal_type,
        u.employee_category,
        'Pending'
    FROM attendance a
    JOIN users u ON a.employee_id = u.employee_id
    WHERE a.date = @token_date
        AND a.status = 'Present'
        AND u.employee_category IN ('W001', 'M001')
        AND u.shift IN ('1', '2', '3')
        AND NOT EXISTS (
            SELECT 1 FROM meal_tokens mt 
            WHERE mt.employee_id = a.employee_id 
            AND mt.token_date = a.date
        );
END;
GO

-- ================================================================
-- TRIGGERS (for automatic timestamp updates)
-- ================================================================

-- Update timestamp trigger for users table
CREATE TRIGGER tr_users_update
ON users
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE users
    SET updated_at = GETDATE()
    FROM users u
    INNER JOIN inserted i ON u.id = i.id;
END;
GO

-- Update timestamp trigger for attendance table
CREATE TRIGGER tr_attendance_update
ON attendance
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE attendance
    SET updated_at = GETDATE()
    FROM attendance a
    INNER JOIN inserted i ON a.id = i.id;
END;
GO

-- ================================================================
-- INITIAL DATA SEEDING (Optional)
-- ================================================================

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('company_name', 'VES HRMS', 'Company name'),
('smtp_host', '', 'SMTP server host'),
('smtp_port', '587', 'SMTP server port'),
('smtp_email', '', 'SMTP email address'),
('smtp_password', '', 'SMTP password (encrypted)'),
('working_days_per_month', '26', 'Standard working days per month'),
('grace_period_minutes', '15', 'Late grace period in minutes'),
('office_start_time', '09:00', 'Office start time'),
('office_end_time', '18:00', 'Office end time');
GO

-- ================================================================
-- LOOKUP TABLES - Master Data (from Production Eview)
-- ================================================================

-- Blood Groups lookup table
CREATE TABLE blood_groups (
    id INT IDENTITY(1,1) PRIMARY KEY,
    blood_group_id INT UNIQUE NOT NULL,
    blood_group_name NVARCHAR(20) NOT NULL,
    description NVARCHAR(200)
);
GO

-- Designations lookup table
CREATE TABLE designations (
    id INT IDENTITY(1,1) PRIMARY KEY,
    designation_id INT UNIQUE NOT NULL,
    designation_name NVARCHAR(100) NOT NULL,
    description NVARCHAR(200)
);
GO

-- Departments lookup table
CREATE TABLE departments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    dept_id INT UNIQUE NOT NULL,
    dept_name NVARCHAR(100) NOT NULL,
    dept_short NVARCHAR(20),
    description NVARCHAR(200)
);
GO

-- Divisions lookup table
CREATE TABLE divisions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    division_id INT UNIQUE NOT NULL,
    division_name NVARCHAR(100) NOT NULL,
    dept_id INT,
    description NVARCHAR(200)
);
GO

-- Branches lookup table
CREATE TABLE branches (
    id INT IDENTITY(1,1) PRIMARY KEY,
    branch_id INT UNIQUE NOT NULL,
    branch_name NVARCHAR(200) NOT NULL,
    branch_code NVARCHAR(50),
    branch_short NVARCHAR(50),
    is_active BIT DEFAULT 1
);
GO

-- Grades lookup table
CREATE TABLE grades (
    id INT IDENTITY(1,1) PRIMARY KEY,
    grade_id INT UNIQUE NOT NULL,
    grade_name NVARCHAR(100) NOT NULL,
    description NVARCHAR(200)
);
GO

-- Levels lookup table
CREATE TABLE levels (
    id INT IDENTITY(1,1) PRIMARY KEY,
    level_id INT UNIQUE NOT NULL,
    level_name NVARCHAR(100) NOT NULL,
    description NVARCHAR(200)
);
GO

-- Sections lookup table
CREATE TABLE sections (
    id INT IDENTITY(1,1) PRIMARY KEY,
    section_id INT UNIQUE NOT NULL,
    section_name NVARCHAR(100) NOT NULL,
    dept_id INT,
    description NVARCHAR(200)
);
GO

-- Job Roles lookup table
CREATE TABLE job_roles (
    id INT IDENTITY(1,1) PRIMARY KEY,
    job_role_id INT UNIQUE NOT NULL,
    job_role_name NVARCHAR(200) NOT NULL,
    description NVARCHAR(200)
);
GO

-- Skills lookup table
CREATE TABLE skills (
    id INT IDENTITY(1,1) PRIMARY KEY,
    skill_id INT UNIQUE NOT NULL,
    skill_name NVARCHAR(200) NOT NULL,
    description NVARCHAR(200)
);
GO

-- Cost Centers lookup table
CREATE TABLE cost_centers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    cost_center_id INT UNIQUE NOT NULL,
    cost_center_name NVARCHAR(200) NOT NULL,
    is_active BIT DEFAULT 1
);
GO

-- Hostels lookup table
CREATE TABLE hostels (
    id INT IDENTITY(1,1) PRIMARY KEY,
    hostel_id INT UNIQUE NOT NULL,
    hostel_name NVARCHAR(200) NOT NULL,
    capacity INT,
    is_active BIT DEFAULT 1
);
GO

-- ================================================================
-- SECURITY & PERMISSIONS
-- ================================================================

-- Create roles for different access levels
/*
CREATE ROLE hr_role;
CREATE ROLE admin_role;
CREATE ROLE employee_role;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON users TO hr_role;
GRANT SELECT, INSERT, UPDATE ON attendance TO hr_role;
GRANT SELECT ON payroll TO hr_role;

GRANT ALL ON DATABASE::VES_HRMS TO admin_role;

GRANT SELECT ON vw_employee_summary TO employee_role;
*/

-- ================================================================
-- END OF SCHEMA
-- ================================================================

PRINT 'VES_HRMS database schema created successfully!';
PRINT 'Tables: 23 (with 8 new lookup tables for Eview compatibility)';
PRINT 'Views: 2';
PRINT 'Stored Procedures: 1';
PRINT 'Triggers: 2';
PRINT 'New Columns in users table: 50+ fields matching production Eview';
GO
