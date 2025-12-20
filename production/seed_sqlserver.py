#!/usr/bin/env python3
"""
============================================================
VES HRMS Data Seeder - PRODUCTION VERSION (SQL Server)
============================================================
Parses Employee Details.xlsx and seeds SQL Server database

USAGE:
    python seed_sqlserver.py --file="Employee Details.xlsx"

PREREQUISITES:
    1. SQL Server database created (VES_HRMS)
    2. init_sqlserver.sql executed in SSMS
    3. pyodbc installed: pip install pyodbc
    4. ODBC Driver 17 for SQL Server installed
============================================================
"""

import argparse
import pandas as pd
import pyodbc
import bcrypt
from datetime import datetime, timedelta
import random
import os
import sys

# ============================================================
# DATABASE CONFIGURATION - UPDATE THESE FOR YOUR SERVER
# ============================================================
SQLSERVER_CONFIG = {
    'server': os.environ.get('DB_SERVER', 'localhost'),      # e.g., 'SERVER\\SQLEXPRESS' or 'localhost'
    'database': os.environ.get('DB_NAME', 'VES_HRMS'),
    'username': os.environ.get('DB_USER', 'ves_hrms_app'),   # SQL Server login
    'password': os.environ.get('DB_PASSWORD', ''),            # SQL Server password
    'driver': 'ODBC Driver 17 for SQL Server'
}

# Alternative: Use Windows Authentication (no username/password needed)
USE_WINDOWS_AUTH = False  # Set to True to use Windows Authentication

# ============================================================
# DATABASE CONNECTION
# ============================================================
def get_db_connection():
    """Get SQL Server database connection"""
    try:
        if USE_WINDOWS_AUTH:
            # Windows Authentication (Trusted Connection)
            conn_str = (
                f"DRIVER={{{SQLSERVER_CONFIG['driver']}}};"
                f"SERVER={SQLSERVER_CONFIG['server']};"
                f"DATABASE={SQLSERVER_CONFIG['database']};"
                "Trusted_Connection=yes;"
                "TrustServerCertificate=yes;"
            )
        else:
            # SQL Server Authentication
            conn_str = (
                f"DRIVER={{{SQLSERVER_CONFIG['driver']}}};"
                f"SERVER={SQLSERVER_CONFIG['server']};"
                f"DATABASE={SQLSERVER_CONFIG['database']};"
                f"UID={SQLSERVER_CONFIG['username']};"
                f"PWD={SQLSERVER_CONFIG['password']};"
                "TrustServerCertificate=yes;"
            )
        
        connection = pyodbc.connect(conn_str)
        print("✅ Connected to SQL Server successfully")
        return connection
    except pyodbc.Error as err:
        print(f"❌ Database connection error: {err}")
        print("\n💡 Troubleshooting:")
        print("   1. Is SQL Server running?")
        print("   2. Is the database 'VES_HRMS' created?")
        print("   3. Did you run init_sqlserver.sql in SSMS?")
        print("   4. Are the username/password correct?")
        print("   5. Is 'ODBC Driver 17 for SQL Server' installed?")
        return None

def test_connection():
    """Test database connection and show server info"""
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        cursor.execute("SELECT @@VERSION")
        version = cursor.fetchone()[0]
        print(f"📊 SQL Server Version: {version[:50]}...")
        conn.close()
        return True
    return False

# ============================================================
# HELPER FUNCTIONS
# ============================================================
def map_designation_to_category(designation):
    """Map designation/position to employee category code"""
    if pd.isna(designation):
        return 'W001', 1  # Default to Worker, Shift 1
    
    designation = str(designation).lower().strip()
    
    # S001 - Staff (Management, HR, Admin roles)
    staff_keywords = ['manager', 'executive', 'admin', 'hr', 'supervisor', 'head', 'chief', 'director', 'coordinator']
    if any(keyword in designation for keyword in staff_keywords):
        return 'S001', None  # Staff don't have shifts
    
    # T001 - Trainee
    trainee_keywords = ['trainee', 'intern', 'apprentice']
    if any(keyword in designation for keyword in trainee_keywords):
        return 'T001', None  # Trainees don't have shifts
    
    # M001 - Migrant Worker (Contract, Temporary)
    migrant_keywords = ['contract', 'temporary', 'migrant', 'casual']
    if any(keyword in designation for keyword in migrant_keywords):
        shift = random.choice([1, 2, 3])  # Random shift for migrants
        return 'M001', shift
    
    # W001 - Workers/Operators (Default for production/operations)
    shift = random.choice([1, 2, 3])
    return 'W001', shift

def parse_time_cell(cell_value):
    """Parse time from Excel cell value"""
    if not cell_value or cell_value.lower() in ['absent', 'a', '', 'nan']:
        return None, None, 'Absent'
    
    in_time = None
    out_time = None
    status = 'Present'
    
    try:
        # Try format: "09:00 - 18:00"
        if ' - ' in cell_value:
            parts = cell_value.split(' - ')
            in_time = datetime.strptime(parts[0].strip(), '%H:%M').time()
            out_time = datetime.strptime(parts[1].strip(), '%H:%M').time()
        # Try format: "09:00-18:00"
        elif '-' in cell_value and ':' in cell_value:
            parts = cell_value.split('-')
            if len(parts) == 2:
                in_time = datetime.strptime(parts[0].strip(), '%H:%M').time()
                out_time = datetime.strptime(parts[1].strip(), '%H:%M').time()
    except:
        pass
    
    return in_time, out_time, status

# ============================================================
# EXCEL PARSING
# ============================================================
def parse_excel_file(file_path):
    """Parse Employee Details.xlsx and extract employee data"""
    try:
        print(f"\n📊 Parsing Excel file: {file_path}")
        
        # Read the Excel file with proper headers
        df = pd.read_excel(file_path, header=0)
        print(f"✅ Found {len(df)} rows in Excel file")
        
        # Display column names for debugging
        print(f"📋 Columns found: {list(df.columns)}")
        
        employees = []
        attendance_data = []
        
        # Try to find Designation/Category column
        designation_col = None
        for col in df.columns:
            if 'designation' in str(col).lower() or 'category' in str(col).lower():
                designation_col = col
                break
        
        # Extract employee basic info
        for index, row in df.iterrows():
            if pd.notna(row.iloc[1]) and pd.notna(row.iloc[2]):  # EmpNo and EmpName
                emp_id = str(row.iloc[1]).strip()
                emp_name = str(row.iloc[2]).strip()
                
                # Get designation from Excel if available
                if designation_col and designation_col in row:
                    designation = row[designation_col] if pd.notna(row[designation_col]) else 'Worker'
                else:
                    designation = random.choice(['Worker', 'Operator', 'Worker', 'Operator'])
                
                # Map designation to employee category and shift
                employee_category, shift = map_designation_to_category(designation)
                
                email = f"{emp_name.lower().replace(' ', '.')}@ves.com"
                phone = f"9{random.randint(100000000, 999999999)}"
                join_date = datetime.now() - timedelta(days=random.randint(30, 1000))
                
                # Default password is emp_id (will be hashed)
                password_hash = bcrypt.hashpw(emp_id.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                
                employees.append({
                    'emp_id': emp_id,
                    'emp_name': emp_name,
                    'password_hash': password_hash,
                    'designation': designation,
                    'employee_category': employee_category,
                    'shift': shift,
                    'email': email,
                    'phone': phone,
                    'join_date': join_date.strftime('%Y-%m-%d')
                })
                
                # Parse attendance data from remaining columns
                parse_attendance_for_employee(row, emp_id, attendance_data, df.columns)
        
        print(f"👥 Extracted {len(employees)} employees")
        print(f"⏰ Generated {len(attendance_data)} attendance records")
        
        return employees, attendance_data
        
    except Exception as e:
        print(f"❌ Error parsing Excel file: {e}")
        import traceback
        traceback.print_exc()
        return [], []

def parse_attendance_for_employee(row, emp_id, attendance_data, columns):
    """Extract attendance data for a single employee from Excel row"""
    try:
        # Skip first 3 columns (S.No, EmpNo, EmpName)
        day_columns = columns[3:]
        
        current_date = datetime(2025, 10, 1)  # Start from Oct 1, 2025
        
        for i, col in enumerate(day_columns):
            if i >= 30:  # Limit to 30 days max
                break
                
            attendance_date = current_date + timedelta(days=i)
            cell_value = str(row[col]).strip() if pd.notna(row[col]) else ''
            
            # Parse IN/OUT times from cell
            in_time, out_time, status = parse_time_cell(cell_value)
            
            # Calculate worked hours
            worked_hours = None
            if in_time and out_time:
                time_diff = datetime.combine(datetime.today(), out_time) - datetime.combine(datetime.today(), in_time)
                worked_hours = round(time_diff.total_seconds() / 3600, 2)
            
            # Determine status
            if not cell_value or cell_value.lower() in ['', 'absent', 'a', 'nan']:
                status = 'Absent'
            elif worked_hours:
                if worked_hours >= 8:
                    status = 'Present'
                elif worked_hours >= 4:
                    status = 'Half Day'
                else:
                    status = 'Present'
            
            attendance_data.append({
                'emp_id': emp_id,
                'date': attendance_date.strftime('%Y-%m-%d'),
                'in_time': in_time.strftime('%H:%M:%S') if in_time else None,
                'out_time': out_time.strftime('%H:%M:%S') if out_time else None,
                'status': status,
                'worked_hours': worked_hours
            })
    except Exception as e:
        pass  # Skip problematic attendance records

# ============================================================
# DATABASE SEEDING
# ============================================================
def seed_employees(conn, employees):
    """Insert employees into SQL Server database"""
    cursor = conn.cursor()
    inserted = 0
    skipped = 0
    
    print(f"\n👥 Seeding {len(employees)} employees...")
    
    for emp in employees:
        try:
            # Check if employee already exists
            cursor.execute("SELECT employee_id FROM users WHERE employee_id = ?", emp['emp_id'])
            if cursor.fetchone():
                skipped += 1
                continue
            
            # Generate username from emp_id or name
            username = emp['emp_id'].lower().replace(' ', '_')
            
            cursor.execute("""
                INSERT INTO users (
                    employee_id, username, password_hash, email, full_name,
                    role, department, designation, phone, date_of_joining,
                    is_active, employee_category, shift, salary
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                emp['emp_id'],
                username,
                emp['password_hash'],
                emp['email'],
                emp['emp_name'],
                'employee',  # Default role
                'Operations',  # Default department
                emp['designation'],
                emp['phone'],
                emp['join_date'],
                1,  # is_active
                emp['employee_category'],
                emp['shift'],
                random.randint(15000, 50000)  # Random salary
            ))
            inserted += 1
            
            if inserted % 50 == 0:
                print(f"   Inserted {inserted} employees...")
                conn.commit()
                
        except pyodbc.Error as e:
            print(f"   ⚠️ Error inserting {emp['emp_id']}: {e}")
            skipped += 1
    
    conn.commit()
    print(f"✅ Inserted: {inserted}, Skipped: {skipped}")
    return inserted

def seed_attendance(conn, attendance_data):
    """Insert attendance records into SQL Server database"""
    cursor = conn.cursor()
    inserted = 0
    skipped = 0
    
    print(f"\n⏰ Seeding {len(attendance_data)} attendance records...")
    
    for att in attendance_data:
        try:
            # Check if record already exists
            cursor.execute(
                "SELECT id FROM attendance WHERE employee_id = ? AND date = ?",
                (att['emp_id'], att['date'])
            )
            if cursor.fetchone():
                skipped += 1
                continue
            
            cursor.execute("""
                INSERT INTO attendance (
                    employee_id, date, clock_in, clock_out, status, hours_worked
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (
                att['emp_id'],
                att['date'],
                att['in_time'],
                att['out_time'],
                att['status'],
                att['worked_hours']
            ))
            inserted += 1
            
            if inserted % 500 == 0:
                print(f"   Inserted {inserted} attendance records...")
                conn.commit()
                
        except pyodbc.Error as e:
            skipped += 1
    
    conn.commit()
    print(f"✅ Inserted: {inserted}, Skipped: {skipped}")
    return inserted

def seed_leave_balance(conn, employees):
    """Initialize leave balance for all employees"""
    cursor = conn.cursor()
    current_year = datetime.now().year
    inserted = 0
    
    print(f"\n🌴 Initializing leave balance for {current_year}...")
    
    for emp in employees:
        try:
            # Check if leave balance already exists
            cursor.execute(
                "SELECT id FROM leave_balance WHERE employee_id = ? AND year = ?",
                (emp['emp_id'], current_year)
            )
            if cursor.fetchone():
                continue
            
            # Set leave based on category
            if emp['employee_category'] in ['S001', 'W001']:
                casual_leave = 12
                sick_leave = 12
                earned_leave = 15
            elif emp['employee_category'] == 'M001':
                casual_leave = 6
                sick_leave = 6
                earned_leave = 0
            else:  # T001 Trainee
                casual_leave = 0
                sick_leave = 6
                earned_leave = 0
            
            cursor.execute("""
                INSERT INTO leave_balance (
                    employee_id, year, casual_leave, sick_leave, earned_leave
                ) VALUES (?, ?, ?, ?, ?)
            """, (emp['emp_id'], current_year, casual_leave, sick_leave, earned_leave))
            inserted += 1
            
        except pyodbc.Error as e:
            pass
    
    conn.commit()
    print(f"✅ Initialized leave balance for {inserted} employees")
    return inserted

def seed_hr_admin_users(conn):
    """Create default HR and Admin users"""
    cursor = conn.cursor()
    
    print("\n👔 Creating HR and Admin users...")
    
    default_users = [
        {
            'employee_id': 'ADMIN001',
            'username': 'admin',
            'password': 'admin123',
            'full_name': 'System Administrator',
            'role': 'admin',
            'email': 'admin@ves.com',
            'department': 'IT'
        },
        {
            'employee_id': 'HR001',
            'username': 'hr_manager',
            'password': 'VEShr123!',
            'full_name': 'HR Manager',
            'role': 'hr',
            'email': 'hr.manager@ves.com',
            'department': 'Human Resources'
        },
        {
            'employee_id': 'HR002',
            'username': 'hr_staff1',
            'password': 'VEShr123!',
            'full_name': 'HR Staff',
            'role': 'hr',
            'email': 'hr.staff1@ves.com',
            'department': 'Human Resources'
        }
    ]
    
    for user in default_users:
        try:
            cursor.execute("SELECT employee_id FROM users WHERE username = ?", user['username'])
            if cursor.fetchone():
                print(f"   ⏭️ {user['username']} already exists")
                continue
            
            password_hash = bcrypt.hashpw(user['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            cursor.execute("""
                INSERT INTO users (
                    employee_id, username, password_hash, email, full_name,
                    role, department, is_active, employee_category
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                user['employee_id'],
                user['username'],
                password_hash,
                user['email'],
                user['full_name'],
                user['role'],
                user['department'],
                1,
                'S001'
            ))
            print(f"   ✅ Created: {user['username']} / {user['password']}")
            
        except pyodbc.Error as e:
            print(f"   ⚠️ Error creating {user['username']}: {e}")
    
    conn.commit()

def seed_system_settings(conn):
    """Initialize system settings"""
    cursor = conn.cursor()
    
    print("\n⚙️ Initializing system settings...")
    
    settings = [
        ('company_name', 'VES HRMS', 'string', 'Company name'),
        ('smtp_server', 'smtp.gmail.com', 'string', 'SMTP server'),
        ('smtp_port', '587', 'number', 'SMTP port'),
        ('smtp_email', '', 'string', 'SMTP email'),
        ('smtp_password', '', 'password', 'SMTP password'),
        ('frontend_url', 'http://localhost:3000', 'string', 'Frontend URL'),
        ('office_start_time', '09:00', 'time', 'Office start time'),
        ('office_end_time', '18:00', 'time', 'Office end time'),
        ('late_threshold_minutes', '15', 'number', 'Late threshold'),
        ('working_days_per_month', '26', 'number', 'Working days per month'),
    ]
    
    for key, value, type_, desc in settings:
        try:
            cursor.execute("SELECT id FROM system_settings WHERE setting_key = ?", key)
            if cursor.fetchone():
                continue
            
            cursor.execute("""
                INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
                VALUES (?, ?, ?, ?)
            """, (key, value, type_, desc))
            
        except pyodbc.Error:
            pass
    
    conn.commit()
    print("✅ System settings initialized")

# ============================================================
# MAIN FUNCTION
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='VES HRMS Data Seeder for SQL Server')
    parser.add_argument('--file', type=str, default='Employee Details.xlsx',
                        help='Path to Employee Details Excel file')
    parser.add_argument('--test', action='store_true',
                        help='Test database connection only')
    parser.add_argument('--server', type=str, help='SQL Server address')
    parser.add_argument('--database', type=str, help='Database name')
    parser.add_argument('--user', type=str, help='SQL Server username')
    parser.add_argument('--password', type=str, help='SQL Server password')
    
    args = parser.parse_args()
    
    # Override config from command line
    if args.server:
        SQLSERVER_CONFIG['server'] = args.server
    if args.database:
        SQLSERVER_CONFIG['database'] = args.database
    if args.user:
        SQLSERVER_CONFIG['username'] = args.user
    if args.password:
        SQLSERVER_CONFIG['password'] = args.password
    
    print("=" * 60)
    print("VES HRMS Data Seeder - SQL Server Edition")
    print("=" * 60)
    print(f"Server: {SQLSERVER_CONFIG['server']}")
    print(f"Database: {SQLSERVER_CONFIG['database']}")
    print("=" * 60)
    
    # Test connection mode
    if args.test:
        print("\n🔌 Testing database connection...")
        if test_connection():
            print("✅ Connection test successful!")
        else:
            print("❌ Connection test failed!")
        return
    
    # Connect to database
    conn = get_db_connection()
    if not conn:
        print("\n❌ Cannot proceed without database connection")
        sys.exit(1)
    
    try:
        # Seed system settings first
        seed_system_settings(conn)
        
        # Create HR/Admin users
        seed_hr_admin_users(conn)
        
        # Parse Excel and seed data
        if os.path.exists(args.file):
            employees, attendance_data = parse_excel_file(args.file)
            
            if employees:
                seed_employees(conn, employees)
                seed_attendance(conn, attendance_data)
                seed_leave_balance(conn, employees)
            else:
                print("⚠️ No employees found in Excel file")
        else:
            print(f"⚠️ Excel file not found: {args.file}")
            print("   Only HR/Admin users and system settings were created.")
        
        print("\n" + "=" * 60)
        print("✅ Database seeding completed successfully!")
        print("=" * 60)
        print("\n📋 Default Login Credentials:")
        print("   Admin:      admin / admin123")
        print("   HR Manager: hr_manager / VEShr123!")
        print("   HR Staff:   hr_staff1 / VEShr123!")
        print("   Employees:  <emp_id> / <emp_id>")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    main()
