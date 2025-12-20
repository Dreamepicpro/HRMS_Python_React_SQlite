-- VES HRMS SQLite Database Schema
-- Portable database - no admin privileges required!

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Users table: Core employee data with role-based access (matches production Eview)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'Employee' CHECK (role IN ('Employee', 'HR', 'Admin', 'MD')),
    employee_category TEXT DEFAULT 'S001' CHECK (employee_category IN ('S001', 'W001', 'M001', 'T001')),
    shift TEXT CHECK (shift IN ('1', '2', '3') OR shift IS NULL),
    department TEXT,
    position TEXT,
    hire_date DATE NOT NULL,
    salary DECIMAL(10,2),
    phone TEXT,
    address TEXT,
    emergency_contact TEXT,
    leave_balance INTEGER DEFAULT 12,
    is_active INTEGER DEFAULT 1,
    account_status TEXT DEFAULT 'Active' CHECK (account_status IN ('Active', 'Inactive', 'Blocked')),
    active_session_id TEXT,
    last_login DATETIME,
    
    -- Personal Information (from Eview)
    gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
    date_of_birth DATE,
    blood_group_id INTEGER,
    marital_status TEXT CHECK (marital_status IN ('Single', 'Married', 'Divorced', 'Widowed')),
    
    -- Address Information
    address_type TEXT DEFAULT 'Current' CHECK (address_type IN ('Current', 'Permanent')),
    address_line2 TEXT,
    city TEXT,
    pincode TEXT,
    
    -- Assignment & Hierarchy
    designation_id INTEGER,
    reporting_to_id INTEGER,
    reporting_manager_name TEXT,
    branch_id INTEGER,
    branch_name TEXT,
    branch_code TEXT,
    
    -- Grade & Level System
    grade_id INTEGER,
    grade_name TEXT,
    level_id INTEGER,
    level_name TEXT,
    
    -- Section & Job Role
    section_id INTEGER,
    section_name TEXT,
    job_role_id INTEGER,
    job_role_name TEXT,
    
    -- Category Details
    category_id INTEGER,
    category_group_id INTEGER,
    
    -- Work Hours & Shift
    working_hours_per_day DECIMAL(5,2),
    contract_hours DECIMAL(5,2),
    ot_hours DECIMAL(5,2),
    shift_code TEXT,
    shift_period TEXT,
    shift_day TEXT,
    
    -- Compensation
    pf_contribution DECIMAL(10,2),
    esi_contribution DECIMAL(10,2),
    net_pay DECIMAL(10,2),
    salary_per_hour DECIMAL(10,2),
    
    -- PF/ESI Eligibility
    pf_applicable INTEGER DEFAULT 0,
    pf_contribution_enabled INTEGER DEFAULT 0,
    esi_applicable INTEGER DEFAULT 0,
    esi_day TEXT,
    esi_date_of_joining DATE,
    
    -- Experience & Photo
    experience TEXT,
    has_photo INTEGER DEFAULT 0,
    photo_path TEXT,
    
    -- Status & Important Dates
    date_of_leaving DATE,
    left_status INTEGER DEFAULT 0,
    confirmation_status INTEGER DEFAULT 0,
    actual_date_of_birth DATE,
    actual_date_of_joining DATE,
    adjusted_date_of_joining DATE,
    relieving_date DATE,
    resignation_date DATE,
    resignation_acceptance_date DATE,
    
    -- Notice Period
    notice_period_days INTEGER,
    
    -- Cost Center
    cost_center_id INTEGER,
    cost_center_name TEXT,
    salary_center_id INTEGER,
    salary_center_name TEXT,
    
    -- Skills & Facilities
    skill_id INTEGER,
    skill_name TEXT,
    hostel_flag INTEGER DEFAULT 0,
    hostel_id INTEGER,
    hostel_name TEXT,
    bus_id INTEGER,
    bus_number TEXT,
    room_number TEXT,
    room_name TEXT,
    
    -- Ledger & Access
    salary_ledger TEXT,
    loan_ledger TEXT,
    savings_ledger TEXT,
    access_code TEXT,
    employee_code TEXT,
    
    -- System fields
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender);
CREATE INDEX IF NOT EXISTS idx_users_blood_group ON users(blood_group_id);
CREATE INDEX IF NOT EXISTS idx_users_designation ON users(designation_id);
CREATE INDEX IF NOT EXISTS idx_users_pincode ON users(pincode);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_grade ON users(grade_id);
CREATE INDEX IF NOT EXISTS idx_users_level ON users(level_id);
CREATE INDEX IF NOT EXISTS idx_users_section ON users(section_id);
CREATE INDEX IF NOT EXISTS idx_users_job_role ON users(job_role_id);
CREATE INDEX IF NOT EXISTS idx_users_reporting_to ON users(reporting_to_id);
CREATE INDEX IF NOT EXISTS idx_users_left_status ON users(left_status);

-- ============================================================
-- LOOKUP TABLES - Master Data (from Production Eview)
-- ============================================================

-- Blood Groups lookup table
CREATE TABLE IF NOT EXISTS blood_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blood_group_id INTEGER UNIQUE NOT NULL,
    blood_group_name TEXT NOT NULL,
    description TEXT
);

-- Designations lookup table
CREATE TABLE IF NOT EXISTS designations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    designation_id INTEGER UNIQUE NOT NULL,
    designation_name TEXT NOT NULL,
    description TEXT
);

-- Departments lookup table
CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dept_id INTEGER UNIQUE NOT NULL,
    dept_name TEXT NOT NULL,
    dept_short TEXT,
    description TEXT
);

-- Divisions lookup table
CREATE TABLE IF NOT EXISTS divisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    division_id INTEGER UNIQUE NOT NULL,
    division_name TEXT NOT NULL,
    dept_id INTEGER,
    description TEXT
);

-- Branches lookup table
CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER UNIQUE NOT NULL,
    branch_name TEXT NOT NULL,
    branch_code TEXT,
    branch_short TEXT,
    is_active INTEGER DEFAULT 1
);

-- Grades lookup table
CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grade_id INTEGER UNIQUE NOT NULL,
    grade_name TEXT NOT NULL,
    description TEXT
);

-- Levels lookup table
CREATE TABLE IF NOT EXISTS levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level_id INTEGER UNIQUE NOT NULL,
    level_name TEXT NOT NULL,
    description TEXT
);

-- Sections lookup table
CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER UNIQUE NOT NULL,
    section_name TEXT NOT NULL,
    dept_id INTEGER,
    description TEXT
);

-- Job Roles lookup table
CREATE TABLE IF NOT EXISTS job_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_role_id INTEGER UNIQUE NOT NULL,
    job_role_name TEXT NOT NULL,
    description TEXT
);

-- Skills lookup table
CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_id INTEGER UNIQUE NOT NULL,
    skill_name TEXT NOT NULL,
    description TEXT
);

-- Cost Centers lookup table
CREATE TABLE IF NOT EXISTS cost_centers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cost_center_id INTEGER UNIQUE NOT NULL,
    cost_center_name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
);

-- Hostels lookup table
CREATE TABLE IF NOT EXISTS hostels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hostel_id INTEGER UNIQUE NOT NULL,
    hostel_name TEXT NOT NULL,
    capacity INTEGER,
    is_active INTEGER DEFAULT 1
);

-- Attendance table: Daily punch records with computed hours
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    date DATE NOT NULL,
    clock_in TIME,
    clock_out TIME,
    status TEXT DEFAULT 'Absent' CHECK (status IN ('Present', 'Absent', 'Half-Day', 'Leave', 'OT')),
    hours_worked REAL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE,
    UNIQUE(employee_id, date)
);

-- Create indexes for attendance table
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

-- Meal Tokens table: Daily meal entitlements based on attendance and shift
CREATE TABLE IF NOT EXISTS meal_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    token_date DATE NOT NULL,
    shift TEXT NOT NULL CHECK (shift IN ('1', '2', '3')),
    meal_type TEXT NOT NULL CHECK (meal_type IN ('Lunch', 'Dinner', 'Breakfast')),
    employee_category TEXT NOT NULL CHECK (employee_category IN ('W001', 'M001')),
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Issued', 'Used', 'Cancelled')),
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME,
    notes TEXT,
    FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE,
    UNIQUE(employee_id, token_date)
);

-- Create indexes for meal_tokens table
CREATE INDEX IF NOT EXISTS idx_meal_tokens_employee ON meal_tokens(employee_id);
CREATE INDEX IF NOT EXISTS idx_meal_tokens_date ON meal_tokens(token_date);
CREATE INDEX IF NOT EXISTS idx_meal_tokens_status ON meal_tokens(status);
CREATE INDEX IF NOT EXISTS idx_meal_tokens_meal_type ON meal_tokens(meal_type);

-- Leave applications table: Leave requests with approval workflow
CREATE TABLE IF NOT EXISTS leave_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('CL', 'SL', 'EL', 'Half-Day', 'Maternity Leave', 'Paternity Leave', 'Emergency Leave', 'LOP')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested REAL NOT NULL,
    is_half_day INTEGER DEFAULT 0,
    half_day_session TEXT CHECK (half_day_session IN ('First Half', 'Second Half') OR half_day_session IS NULL),
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
    approved_by TEXT,
    approved_on DATETIME,
    rejection_reason TEXT,
    applied_on DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(employee_id) ON DELETE SET NULL
);

-- Leave balance table: Track leave balances by type
CREATE TABLE IF NOT EXISTS leave_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    leave_year INTEGER NOT NULL,
    casual_leave_total INTEGER DEFAULT 12,
    casual_leave_used REAL DEFAULT 0,
    sick_leave_total INTEGER DEFAULT 12,
    sick_leave_used REAL DEFAULT 0,
    earned_leave_total INTEGER DEFAULT 12,
    earned_leave_used REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE,
    UNIQUE(employee_id, leave_year)
);

-- Create indexes for leave_applications table
CREATE INDEX IF NOT EXISTS idx_leave_applications_emp_id ON leave_applications(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_applications_status ON leave_applications(status);
CREATE INDEX IF NOT EXISTS idx_leave_applications_start_date ON leave_applications(start_date);
CREATE INDEX IF NOT EXISTS idx_leave_applications_approved_by ON leave_applications(approved_by);

-- Documents table: File uploads with approval tracking
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('Leave Proof', 'ID Copy', 'Medical Certificate', 'Other')),
    uploaded_by TEXT NOT NULL,
    approved INTEGER DEFAULT 0,
    approved_by TEXT,
    approved_at DATETIME,
    file_size INTEGER,
    mime_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(employee_id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(employee_id) ON DELETE SET NULL
);

-- Create indexes for documents table
CREATE INDEX IF NOT EXISTS idx_documents_emp_id ON documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_approved ON documents(approved);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);

-- Holidays table: Company-wide holiday calendar
CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL UNIQUE,
    description TEXT NOT NULL,
    is_optional INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for holidays table
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_optional ON holidays(is_optional);

-- Payroll table: Monthly salary computation
CREATE TABLE IF NOT EXISTS payroll (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    month TEXT NOT NULL, -- 'YYYY-MM' format
    basic_salary REAL NOT NULL,
    allowances REAL DEFAULT 0,
    overtime_pay REAL DEFAULT 0,
    deductions REAL DEFAULT 0,
    net_pay REAL NOT NULL,
    worked_days INTEGER DEFAULT 0,
    leave_days INTEGER DEFAULT 0,
    processed_by TEXT,
    processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE,
    FOREIGN KEY (processed_by) REFERENCES users(employee_id) ON DELETE SET NULL,
    UNIQUE(employee_id, month)
);

-- Create indexes for payroll table
CREATE INDEX IF NOT EXISTS idx_payroll_month ON payroll(month);
CREATE INDEX IF NOT EXISTS idx_payroll_processed_by ON payroll(processed_by);

-- Audit logs table: Security and compliance tracking
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(employee_id) ON DELETE SET NULL
);

-- Create indexes for audit_logs table
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- Custom requests table: Lunch tokens, special permissions
CREATE TABLE IF NOT EXISTS custom_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    request_type TEXT NOT NULL CHECK (request_type IN ('Lunch Token', 'Early Exit', 'Late Entry', 'Equipment', 'Other')),
    description TEXT NOT NULL,
    date_needed DATE NOT NULL,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    approved_by TEXT,
    approved_at DATETIME,
    rejection_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(employee_id) ON DELETE SET NULL
);

-- Create indexes for custom_requests table
CREATE INDEX IF NOT EXISTS idx_custom_requests_emp_id ON custom_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_custom_requests_status ON custom_requests(status);
CREATE INDEX IF NOT EXISTS idx_custom_requests_date_needed ON custom_requests(date_needed);

-- System Settings table: Store configurable settings (SMTP, company info, etc.)
CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Master Tables for HR Management
CREATE TABLE IF NOT EXISTS master_departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dept_code TEXT UNIQUE,
    dept_name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS master_designations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    designation_code TEXT UNIQUE,
    designation_name TEXT UNIQUE NOT NULL,
    category TEXT CHECK (category IN ('S001', 'W001', 'M001', 'T001')),
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS master_branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_code TEXT UNIQUE,
    branch_name TEXT UNIQUE NOT NULL,
    address TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS master_divisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    division_code TEXT UNIQUE,
    division_name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default system settings
INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description) VALUES 
    ('smtp_server', 'smtp.gmail.com', 'SMTP Server Address'),
    ('smtp_port', '587', 'SMTP Port'),
    ('smtp_email', '', 'SMTP Email/Username'),
    ('smtp_password', '', 'SMTP Password (App Password)'),
    ('company_name', 'VES Engineering Services', 'Company Name'),
    ('frontend_url', 'http://localhost:3000', 'Frontend URL for email links');

-- Views for computed data
-- Employee stats view
CREATE VIEW IF NOT EXISTS v_employee_stats AS
SELECT 
    u.employee_id,
    u.full_name,
    u.role,
    COUNT(DISTINCT a.date) as days_present,
    SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) as days_absent,
    AVG(a.hours_worked) as avg_hours_per_day,
    SUM(a.hours_worked) as total_hours_month
FROM users u
LEFT JOIN attendance a ON u.employee_id = a.employee_id 
    AND a.date >= date('now', '-30 days')
WHERE u.is_active = 1
GROUP BY u.employee_id, u.full_name, u.role;

-- Pending approvals view
CREATE VIEW IF NOT EXISTS v_pending_approvals AS
SELECT 
    'leave' as request_type,
    l.id,
    l.employee_id,
    u.full_name,
    l.leave_type as detail_type,
    l.start_date,
    l.end_date,
    l.reason,
    l.applied_on as created_at
FROM leave_applications l
JOIN users u ON l.employee_id = u.employee_id
WHERE l.status = 'Pending'
UNION ALL
SELECT 
    'custom' as request_type,
    cr.id,
    cr.employee_id,
    u.full_name,
    cr.request_type as detail_type,
    cr.date_needed as start_date,
    cr.date_needed as end_date,
    cr.description as reason,
    cr.created_at
FROM custom_requests cr
JOIN users u ON cr.employee_id = u.employee_id
WHERE cr.status = 'Pending'
ORDER BY created_at ASC;

-- Insert sample holidays for 2025
INSERT OR IGNORE INTO holidays (date, description) VALUES
('2025-01-01', 'New Year Day'),
('2025-01-26', 'Republic Day'),
('2025-03-13', 'Holi'),
('2025-04-14', 'Tamil New Year'),
('2025-04-18', 'Good Friday'),
('2025-08-15', 'Independence Day'),
('2025-10-02', 'Gandhi Jayanti'),
('2025-10-24', 'Dussehra'),
('2025-11-12', 'Diwali'),
('2025-12-25', 'Christmas Day');

-- Triggers for automatic hour calculation
-- Note: SQLite triggers have different syntax than MySQL

-- Trigger for INSERT
CREATE TRIGGER IF NOT EXISTS calculate_hours_insert
AFTER INSERT ON attendance
FOR EACH ROW
WHEN NEW.clock_in IS NOT NULL AND NEW.clock_out IS NOT NULL
BEGIN
    UPDATE attendance 
    SET 
        hours_worked = (strftime('%s', NEW.clock_out) - strftime('%s', NEW.clock_in)) / 3600.0,
        status = CASE 
            WHEN (strftime('%s', NEW.clock_out) - strftime('%s', NEW.clock_in)) / 3600.0 >= 8 THEN 'Present'
            WHEN (strftime('%s', NEW.clock_out) - strftime('%s', NEW.clock_in)) / 3600.0 >= 4 THEN 'Half-Day'
            WHEN (strftime('%s', NEW.clock_out) - strftime('%s', NEW.clock_in)) / 3600.0 > 0 THEN 'Present'
            ELSE 'Absent'
        END
    WHERE id = NEW.id;
    
    -- Mark overtime if > 8 hours
    UPDATE attendance 
    SET status = 'OT'
    WHERE id = NEW.id AND hours_worked > 8;
END;

-- Trigger for UPDATE
CREATE TRIGGER IF NOT EXISTS calculate_hours_update
AFTER UPDATE ON attendance
FOR EACH ROW
WHEN NEW.clock_in IS NOT NULL AND NEW.clock_out IS NOT NULL
BEGIN
    UPDATE attendance 
    SET 
        hours_worked = (strftime('%s', NEW.clock_out) - strftime('%s', NEW.clock_in)) / 3600.0,
        status = CASE 
            WHEN (strftime('%s', NEW.clock_out) - strftime('%s', NEW.clock_in)) / 3600.0 >= 8 THEN 'Present'
            WHEN (strftime('%s', NEW.clock_out) - strftime('%s', NEW.clock_in)) / 3600.0 >= 4 THEN 'Half-Day'
            WHEN (strftime('%s', NEW.clock_out) - strftime('%s', NEW.clock_in)) / 3600.0 > 0 THEN 'Present'
            ELSE 'Absent'
        END
    WHERE id = NEW.id;
    
    -- Mark overtime if > 8 hours
    UPDATE attendance 
    SET status = 'OT'
    WHERE id = NEW.id AND hours_worked > 8;
END;