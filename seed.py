#!/usr/bin/env python3
"""
VES HRMS Data Seeder
Parses Employee Details.xlsx and seeds database with sample data
Usage: python seed.py --file="Employee Details.xlsx"
"""

import argparse
import pandas as pd
import sqlite3
import bcrypt
from datetime import datetime, timedelta
import random
import os
import sys

# Database configuration - SQLite
DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'ves_hrms.db')

def get_db_connection():
    """Get SQLite database connection"""
    try:
        connection = sqlite3.connect(DATABASE_PATH)
        connection.row_factory = sqlite3.Row
        return connection
    except sqlite3.Error as err:
        print(f"Database connection error: {err}")
        return None

def initialize_database():
    """Initialize SQLite database with schema"""
    try:
        conn = get_db_connection()
        if not conn:
            return False
        
        # Read and execute schema
        with open('init_sqlite.sql', 'r') as f:
            schema = f.read()
        
        # Enable foreign keys first
        conn.execute("PRAGMA foreign_keys = ON")
        
        # Execute schema - SQLite can handle multiple statements with executescript
        conn.executescript(schema)
        conn.commit()
        conn.close()
        print("✅ Database schema initialized")
        return True
        
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        return False

def map_designation_to_category(designation):
    """Map designation/position to employee category code"""
    if pd.isna(designation):
        return 'W001', None  # Default to Worker
    
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
        shift = random.choice(['1', '2', '3'])  # Random shift for migrants
        return 'M001', shift
    
    # W001 - Workers/Operators (Default for production/operations)
    # Assign random shift to workers
    shift = random.choice(['1', '2', '3'])
    return 'W001', shift

def parse_excel_file(file_path):
    """Parse Employee Details.xlsx and extract employee data"""
    try:
        print(f"📊 Parsing Excel file: {file_path}")
        
        # Read the Excel file with proper headers
        df = pd.read_excel(file_path, header=0)
        print(f"✅ Found {len(df)} rows in Excel file")
        
        # Display column names for debugging
        print(f"📋 Columns found: {list(df.columns)}")
        
        # Expected columns: S.No, EmpNo, EmpName, then daily IN/OUT columns
        employees = []
        attendance_data = []
        
        # Try to find Designation/Category column
        designation_col = None
        for col in df.columns:
            if 'designation' in col.lower() or 'category' in col.lower():
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
                    designation = random.choice(['Worker', 'Operator', 'Worker', 'Operator'])  # Default to workers
                
                # Map designation to employee category and shift
                employee_category, shift = map_designation_to_category(designation)
                
                # Calculate leave balance based on category
                leave_balance = 12 if employee_category in ['S001', 'W001'] else 0
                
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
                    'leave_balance': leave_balance,
                    'email': email,
                    'phone': phone,
                    'join_date': join_date
                })
                
                # Parse attendance data from remaining columns (day 1-30)
                parse_attendance_for_employee(row, emp_id, attendance_data, df.columns)
        
        print(f"👥 Extracted {len(employees)} employees")
        print(f"⏰ Generated {len(attendance_data)} attendance records")
        
        return employees, attendance_data
        
    except Exception as e:
        print(f"❌ Error parsing Excel file: {e}")
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
            
            # Parse IN/OUT times from cell (format: "09:00 - 18:00" or "IN: 09:00 OUT: 18:00")
            in_time, out_time, status = parse_time_cell(cell_value)
            
            # Calculate worked hours
            worked_hours = None
            if in_time and out_time:
                time_diff = datetime.combine(datetime.today(), out_time) - datetime.combine(datetime.today(), in_time)
                worked_hours = time_diff.total_seconds() / 3600
            
            # Determine status
            if not cell_value or cell_value.lower() in ['', 'absent', 'a']:
                status = 'Absent'
            elif worked_hours:
                if worked_hours >= 8:
                    status = 'Present'
                elif worked_hours >= 4:
                    status = 'Half-Day'
                else:
                    status = 'Present'
                    
                if worked_hours > 8:
                    status = 'OT'
            
            attendance_data.append({
                'emp_id': emp_id,
                'date': attendance_date.date(),
                'in_time': in_time,
                'out_time': out_time,
                'status': status,
                'worked_hours': worked_hours,
                'notes': 'Imported from Excel'
            })
            
    except Exception as e:
        print(f"⚠️ Error parsing attendance for {emp_id}: {e}")

def parse_time_cell(cell_value):
    """Parse time information from Excel cell"""
    if not cell_value or cell_value.lower() in ['absent', 'a', '', 'nan']:
        return None, None, 'Absent'
    
    try:
        # Handle different time formats
        if '-' in cell_value:
            # Format: "09:00 - 18:00"
            times = cell_value.split('-')
            in_str = times[0].strip()
            out_str = times[1].strip()
        elif 'IN:' in cell_value.upper() and 'OUT:' in cell_value.upper():
            # Format: "IN: 09:00 OUT: 18:00"
            parts = cell_value.upper().split('OUT:')
            in_str = parts[0].replace('IN:', '').strip()
            out_str = parts[1].strip()
        else:
            # Default times if format is unclear
            in_str = "09:00"
            out_str = "18:00"
        
        # Parse time strings
        in_time = datetime.strptime(in_str, '%H:%M').time()
        out_time = datetime.strptime(out_str, '%H:%M').time()
        
        return in_time, out_time, 'Present'
        
    except:
        # Generate random work hours if parsing fails
        in_hour = random.randint(8, 10)
        out_hour = in_hour + random.randint(8, 10)
        in_time = datetime.strptime(f"{in_hour:02d}:00", '%H:%M').time()
        out_time = datetime.strptime(f"{out_hour:02d}:00", '%H:%M').time()
        return in_time, out_time, 'Present'

def seed_users(conn, employees):
    """Insert employee data into users table"""
    try:
        cursor = conn.cursor()
        
        # Clear existing data (except predefined admin users)
        cursor.execute("DELETE FROM users WHERE employee_id NOT IN ('VES001', 'VES002', 'VES003', 'VES004')")
        
        # Insert sample admin users first
        admin_hash = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        hr_hash = bcrypt.hashpw('hr123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        cursor.execute("""
            INSERT OR IGNORE INTO users (employee_id, username, email, password_hash, full_name, role, 
                                        department, position, hire_date, phone,
                                        employee_category, shift, leave_balance)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ('admin', 'admin', 'admin@ves.com', admin_hash, 'System Administrator', 'Admin', 
              'IT', 'Admin', datetime.now().date(), '9999999999', 'S001', None, 12))
        
        cursor.execute("""
            INSERT OR IGNORE INTO users (employee_id, username, email, password_hash, full_name, role, 
                                        department, position, hire_date, phone,
                                        employee_category, shift, leave_balance)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ('hr001', 'hr_manager', 'hr@ves.com', hr_hash, 'HR Manager', 'HR', 
              'Human Resources', 'Manager', datetime.now().date(), '9999999998', 'S001', None, 12))
        
        # Insert employees from Excel
        for emp in employees:
            username = emp['emp_name'].lower().replace(' ', '_')
            cursor.execute("""
                INSERT OR IGNORE INTO users (employee_id, username, email, password_hash, full_name, role, 
                                            department, position, hire_date, phone, 
                                            employee_category, shift, leave_balance)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (emp['emp_id'], username, emp['email'], emp['password_hash'], emp['emp_name'], 
                  'Employee', emp['designation'], emp['designation'], emp['join_date'], emp['phone'],
                  emp['employee_category'], emp['shift'], emp['leave_balance']))
        
        print(f"✅ Seeded {len(employees) + 2} users (including admin accounts)")
        
    except Exception as e:
        print(f"❌ Error seeding users: {e}")

def seed_attendance(conn, attendance_data):
    """Insert attendance data"""
    try:
        cursor = conn.cursor()
        
        # Clear existing attendance data for the month
        cursor.execute("DELETE FROM attendance WHERE date >= '2025-10-01' AND date <= '2025-10-31'")
        
        # Insert attendance records
        for record in attendance_data:
            cursor.execute("""
                INSERT OR IGNORE INTO attendance (employee_id, date, clock_in, clock_out, status, hours_worked, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (record['emp_id'], record['date'], record['in_time'], record['out_time'],
                  record['status'], record['worked_hours'], record['notes']))
        
        print(f"✅ Seeded {len(attendance_data)} attendance records")
        
    except Exception as e:
        print(f"❌ Error seeding attendance: {e}")

def seed_sample_leaves(conn):
    """Insert sample leave requests"""
    try:
        cursor = conn.cursor()
        
        # Get employee IDs
        cursor.execute("SELECT emp_id FROM users WHERE designation = 'Employee' LIMIT 5")
        employees = [row[0] for row in cursor.fetchall()]
        
        leave_types = ['Sick', 'Casual', 'Annual']
        statuses = ['Pending', 'Approved', 'Rejected']
        
        for i, emp_id in enumerate(employees):
            start_date = datetime.now() + timedelta(days=random.randint(1, 30))
            end_date = start_date + timedelta(days=random.randint(1, 3))
            
            cursor.execute("""
                INSERT INTO leaves (emp_id, start_date, end_date, type, reason, status)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (emp_id, start_date.date(), end_date.date(), 
                  random.choice(leave_types), f"Sample leave request {i+1}", 
                  random.choice(statuses)))
        
        print("✅ Seeded sample leave requests")
        
    except Exception as e:
        print(f"❌ Error seeding leaves: {e}")

def main():
    """Main seeding function"""
    parser = argparse.ArgumentParser(description='Seed VES HRMS database with Excel data')
    parser.add_argument('--file', default='Employee Details.xlsx', help='Path to Excel file')
    parser.add_argument('--skip-attendance', action='store_true', help='Skip attendance data seeding')
    
    args = parser.parse_args()
    
    print("🚀 VES HRMS Database Seeder")
def seed_sample_leaves(conn):
    """Insert sample leave applications"""
    try:
        cursor = conn.cursor()
        
        # Get some employee IDs for sample data
        cursor.execute("SELECT employee_id FROM users WHERE role = 'Employee' LIMIT 3")
        employees = cursor.fetchall()
        
        if not employees:
            print("⚠️ No employees found for leave sample data")
            return
        
        # Sample leave data
        leave_types = ['Annual Leave', 'Sick Leave', 'Casual Leave', 'Maternity Leave', 'Emergency Leave']
        statuses = ['Approved', 'Pending', 'Rejected']
        
        for i, emp in enumerate(employees):
            emp_id = emp[0]
            
            # Create 2-3 leave applications per employee
            for j in range(random.randint(2, 3)):
                start_date = datetime.now() + timedelta(days=random.randint(1, 60))
                days = random.randint(1, 5)
                end_date = start_date + timedelta(days=days-1)
                
                cursor.execute("""
                    INSERT INTO leave_applications (
                        employee_id, leave_type, start_date, end_date, 
                        days_requested, reason, status, applied_on
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    emp_id, 
                    random.choice(leave_types),
                    start_date.date(),
                    end_date.date(),
                    days,
                    f"Sample leave request {j+1} for testing",
                    random.choice(statuses),
                    datetime.now()
                ))
        
        conn.commit()
        print("✅ Seeded sample leave applications")
        
    except Exception as e:
        print(f"❌ Error seeding leave data: {e}")

def main():
    """Main function to seed the database"""
    parser = argparse.ArgumentParser(description='Seed VES HRMS database with sample data')
    parser.add_argument('--file', '-f', default='Employee Details.xlsx', 
                        help='Excel file with employee data (default: Employee Details.xlsx)')
    parser.add_argument('--skip-attendance', action='store_true', 
                        help='Skip seeding attendance data')
    parser.add_argument('--init-only', action='store_true',
                        help='Only initialize database schema')
    
    args = parser.parse_args()
    
    print("🏢 VES HRMS Database Seeder")
    print("=" * 40)
    
    # Initialize database schema first
    if not initialize_database():
        print("❌ Failed to initialize database schema")
        sys.exit(1)
    
    if args.init_only:
        print("✅ Database schema initialized successfully")
        return
    
    # Connect to database
    conn = get_db_connection()
    if not conn:
        print("❌ Could not connect to database")
        sys.exit(1)
    
    print("✅ Connected to SQLite database")
    
    try:
        # Check if Excel file exists for employee data
        if os.path.exists(args.file):
            print(f"📊 Found Excel file: {args.file}")
            # Parse Excel file
            employees, attendance_data = parse_excel_file(args.file)
            
            if employees:
                # Seed database with Excel data
                seed_users(conn, employees)
                
                if not args.skip_attendance:
                    seed_attendance(conn, attendance_data)
            else:
                print("⚠️ No employee data found in Excel file, seeding sample data instead")
                seed_sample_data(conn)
        else:
            print(f"⚠️ Excel file not found: {args.file}")
            print("💡 Seeding with sample data instead")
            seed_sample_data(conn)
        
        seed_sample_leaves(conn)
        
        print("\n🎉 Database seeding completed successfully!")
        print("\n🔐 Default login credentials:")
        print("   Admin: admin / admin123")
        print("   HR:    hr_manager / VEShr123!")
        print("   MD:    md_director / VESmd123!")
        print("   Employee: emp_engineer1 / VESemp123!")
        
    except Exception as e:
        print(f"❌ Seeding failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

def seed_sample_data(conn):
    """Seed database with predefined sample data when Excel file is not available"""
    try:
        cursor = conn.cursor()
        
        # Check if users already exist
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        
        if user_count > 0:
            print(f"👤 Users already exist ({user_count} users). Skipping user seeding.")
            return
        
        # Sample users with different roles
        users_data = [
            # MD (Managing Director)
            {
                'employee_id': 'VES001',
                'username': 'md_director',
                'email': 'md@ves.com',
                'password': 'VESmd123!',
                'full_name': 'Dr. Rajesh Kumar',
                'role': 'MD',
                'department': 'Executive',
                'position': 'Managing Director',
                'hire_date': '2015-01-15',
                'salary': 500000.00,
                'phone': '+91-98765-43210',
                'address': '123 Executive Tower, Chennai',
                'emergency_contact': 'Mrs. Priya Kumar - 98765-54321',
                'employee_category': 'S001',  # Staff
                'shift': None,
                'leave_balance': 12
            },
            # HR Team
            {
                'employee_id': 'VES002',
                'username': 'hr_manager',
                'email': 'hr.manager@ves.com',
                'password': 'VEShr123!',
                'full_name': 'Ms. Priya Sharma',
                'role': 'HR',
                'department': 'Human Resources',
                'position': 'HR Manager',
                'hire_date': '2018-03-20',
                'salary': 75000.00,
                'phone': '+91-98765-11111',
                'address': '456 HR Block, Chennai',
                'emergency_contact': 'Mr. Ravi Sharma - 98765-22222',
                'employee_category': 'S001',  # Staff
                'shift': None,
                'leave_balance': 12
            },
            # Admin
            {
                'employee_id': 'VES003',
                'username': 'admin_sys',
                'email': 'admin@ves.com',
                'password': 'VESadmin123!',
                'full_name': 'Mr. Suresh Babu',
                'role': 'Admin',
                'department': 'IT Administration',
                'position': 'System Administrator',
                'hire_date': '2017-05-12',
                'salary': 55000.00,
                'phone': '+91-98765-55555',
                'address': '321 IT Block, Chennai',
                'emergency_contact': 'Mrs. Lakshmi Babu - 98765-66666',
                'employee_category': 'S001',  # Staff
                'shift': None,
                'leave_balance': 12
            },
            # Regular Employees
            {
                'employee_id': 'VES004',
                'username': 'emp_engineer1',
                'email': 'engineer1@ves.com',
                'password': 'VESemp123!',
                'full_name': 'Mr. Vikram Singh',
                'role': 'Employee',
                'department': 'Engineering',
                'position': 'Senior Engineer',
                'hire_date': '2019-02-28',
                'salary': 65000.00,
                'phone': '+91-98765-77777',
                'address': '654 Eng Block, Chennai',
                'emergency_contact': 'Mrs. Asha Singh - 98765-88888',
                'employee_category': 'W001',  # Worker - eligible for meal tokens
                'shift': '1',  # Shift 1 - Lunch
                'leave_balance': 12
            }
        ]
        
        # Insert users
        for user in users_data:
            # Hash password
            password_hash = bcrypt.hashpw(user['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            cursor.execute("""
                INSERT INTO users (
                    employee_id, username, email, password_hash, full_name, role, 
                    department, position, hire_date, salary, phone, address, emergency_contact,
                    employee_category, shift, leave_balance
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                user['employee_id'], user['username'], user['email'], password_hash,
                user['full_name'], user['role'], user['department'], user['position'],
                user['hire_date'], user['salary'], user['phone'], user['address'],
                user['emergency_contact'], user['employee_category'], user['shift'], 
                user['leave_balance']
            ))
        
        conn.commit()
        print(f"✅ Successfully seeded {len(users_data)} sample users")
        
    except Exception as e:
        print(f"❌ Error seeding sample users: {e}")

if __name__ == "__main__":
    main()
# TODO: Add email notification after successful seeding