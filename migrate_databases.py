#!/usr/bin/env python3
"""
VES HRMS - Database Migration Script
Converts Excel sheets to temporary databases, then migrates to unified VES_HRMS database

Architecture:
1. Read Excel files from 'sheets to db' folder
2. Create temporary SQL Server databases (one per Excel file)
3. Migrate all data to unified VES_HRMS database
4. Support both SQLite (development) and SQL Server (production)

Usage:
    python migrate_databases.py --mode dev    # SQLite for local testing
    python migrate_databases.py --mode prod   # SQL Server for production
"""

import pandas as pd
import sqlite3
import argparse
import os
import sys
from datetime import datetime
import bcrypt

# Database Configuration
SQLITE_DB = 'ves_hrms.db'
SHEETS_FOLDER = 'sheets to db'

# SQL Server configuration (commented for production use)
"""
SQLSERVER_CONFIG = {
    'server': 'YOUR_SERVER_NAME',
    'database': 'VES_HRMS',
    'username': 'YOUR_USERNAME',
    'password': 'YOUR_PASSWORD',
    'driver': '{ODBC Driver 17 for SQL Server}'
}

CHECKINOUT_CONFIG = {
    'server': 'YOUR_SERVER_NAME',
    'database': 'CheckInOut_DB',
    'username': 'YOUR_USERNAME',
    'password': 'YOUR_PASSWORD',
    'driver': '{ODBC Driver 17 for SQL Server}'
}
"""

def get_db_connection(mode='dev'):
    """Get database connection based on mode"""
    if mode == 'dev':
        # SQLite for development
        conn = sqlite3.connect(SQLITE_DB)
        conn.row_factory = sqlite3.Row
        return conn
    else:
        # SQL Server for production
        """
        import pyodbc
        conn_str = (
            f"DRIVER={SQLSERVER_CONFIG['driver']};"
            f"SERVER={SQLSERVER_CONFIG['server']};"
            f"DATABASE={SQLSERVER_CONFIG['database']};"
            f"UID={SQLSERVER_CONFIG['username']};"
            f"PWD={SQLSERVER_CONFIG['password']};"
        )
        return pyodbc.connect(conn_str)
        """
        raise NotImplementedError("SQL Server mode not configured yet")

def initialize_schema(conn, mode='dev'):
    """Initialize VES_HRMS database schema"""
    schema_file = 'init_sqlite.sql' if mode == 'dev' else 'init_sqlserver.sql'
    
    print(f"📋 Initializing schema from {schema_file}...")
    
    with open(schema_file, 'r', encoding='utf-8') as f:
        schema = f.read()
    
    if mode == 'dev':
        conn.executescript(schema)
    else:
        # SQL Server: Execute statements individually
        cursor = conn.cursor()
        for statement in schema.split('GO'):
            statement = statement.strip()
            if statement:
                cursor.execute(statement)
        conn.commit()
    
    print("✅ Schema initialized successfully")

def read_excel_sheets():
    """Read all Excel files from sheets to db folder"""
    print(f"\n📊 Reading Excel files from '{SHEETS_FOLDER}' folder...")
    
    excel_data = {}
    
    if not os.path.exists(SHEETS_FOLDER):
        print(f"❌ Folder not found: {SHEETS_FOLDER}")
        return excel_data
    
    # Exclude UI configuration files - these are NOT data tables
    EXCLUDED_FILES = [
        'Columns_Fields for Adding_Editing New Employees_form.xlsx',
        'Employeemasterdetails Columns to Show in List View DisplayFilter.xlsx'
    ]
    
    files = [f for f in os.listdir(SHEETS_FOLDER) 
             if f.endswith('.xlsx') and not f.startswith('~$') and f not in EXCLUDED_FILES]
    
    for filename in files:
        filepath = os.path.join(SHEETS_FOLDER, filename)
        db_name = filename.replace('.xlsx', '')
        
        try:
            print(f"  📄 Reading {filename}...")
            excel_file = pd.ExcelFile(filepath)
            
            sheets_data = {}
            for sheet_name in excel_file.sheet_names:
                # Try reading with header=1 for files with headers in second row
                df = pd.read_excel(filepath, sheet_name=sheet_name, header=1)
                # If all columns are Unnamed, try header=0
                if all('Unnamed' in str(col) for col in df.columns):
                    df = pd.read_excel(filepath, sheet_name=sheet_name, header=0)
                sheets_data[sheet_name] = df
                print(f"     - Sheet: {sheet_name} ({len(df)} rows, {len(df.columns)} cols)")
            
            excel_data[db_name] = sheets_data
            
        except Exception as e:
            print(f"  ⚠️ Error reading {filename}: {e}")
    
    print(f"\n✅ Read {len(excel_data)} Excel files")
    return excel_data

def create_temporary_databases(excel_data, mode='dev'):
    """Create temporary databases from Excel data"""
    print("\n🔨 Creating temporary databases...")
    
    temp_databases = {}
    
    for db_name, sheets in excel_data.items():
        print(f"\n  Creating temp DB: {db_name}")
        
        if mode == 'dev':
            # SQLite temporary database
            temp_db_path = f"temp_{db_name}.db"
            conn = sqlite3.connect(temp_db_path)
            
            for sheet_name, df in sheets.items():
                # Write dataframe to SQL table
                table_name = sheet_name.replace(' ', '_').replace('-', '_')
                df.to_sql(table_name, conn, if_exists='replace', index=False)
                print(f"    ✓ Table {table_name}: {len(df)} rows")
            
            conn.close()
            temp_databases[db_name] = temp_db_path
        
        else:
            # SQL Server temporary database
            """
            import pyodbc
            # Create database
            master_conn = pyodbc.connect(f"DRIVER={SQLSERVER_CONFIG['driver']};"
                                        f"SERVER={SQLSERVER_CONFIG['server']};"
                                        f"DATABASE=master;"
                                        f"UID={SQLSERVER_CONFIG['username']};"
                                        f"PWD={SQLSERVER_CONFIG['password']};")
            cursor = master_conn.cursor()
            cursor.execute(f"IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'TEMP_{db_name}') "
                          f"CREATE DATABASE TEMP_{db_name}")
            master_conn.commit()
            master_conn.close()
            
            # Connect and create tables
            # ... (SQL Server table creation logic)
            """
            pass
    
    print(f"\n✅ Created {len(temp_databases)} temporary databases")
    return temp_databases

def migrate_to_hrms(temp_databases, conn, mode='dev'):
    """Migrate data from temporary databases to VES_HRMS"""
    print("\n🔄 Migrating data to VES_HRMS database...")
    
    cursor = conn.cursor()
    
    # Migration logic for each temporary database
    for db_name, db_path in temp_databases.items():
        print(f"\n  Migrating from {db_name}...")
        
        if mode == 'dev':
            temp_conn = sqlite3.connect(db_path)
            temp_cursor = temp_conn.cursor()
            
            # Get all tables from temp database
            temp_cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = temp_cursor.fetchall()
            
            for (table_name,) in tables:
                print(f"    Processing table: {table_name}")
                
                # Map temp tables to HRMS tables (match against table_name which is the sheet name)
                if db_name == 'Employee' or 'Employee' in table_name:
                    migrate_employees(temp_conn, conn, table_name)
                
                elif db_name == 'Department' or 'Department' in table_name:
                    migrate_departments(temp_conn, conn, table_name)
                
                elif db_name == 'Division' or 'Division' in table_name:
                    migrate_divisions(temp_conn, conn, table_name)
                
                elif db_name == 'EAddress' or 'EAddress' in table_name:
                    migrate_addresses(temp_conn, conn, table_name)
                
                elif db_name == 'ESalary' or 'ESalary' in table_name:
                    migrate_salaries(temp_conn, conn, table_name)
                
                elif db_name == 'EmployeeCompany' or 'EmployeeCompany' in table_name:
                    migrate_employee_company(temp_conn, conn, table_name)
                
                elif db_name == 'BloodGroup' or 'BloodGroup' in table_name:
                    migrate_blood_groups(temp_conn, conn, table_name)
                
                elif db_name == 'Punch Tym' or 'Punch_Tym' in table_name:
                    migrate_punch_data(temp_conn, conn, table_name)
            
            temp_conn.close()
    
    conn.commit()
    print("\n✅ Migration completed successfully")

def migrate_employees(source_conn, dest_conn, table_name):
    """Migrate employee data to users table - read from Eview.xlsx (production view combining all 7 tables)"""
    import pandas as pd
    
    # Read Employee.xlsx
    emp_excel_path = os.path.join(SHEETS_FOLDER, 'Employee.xlsx')
    emp_df = pd.read_excel(emp_excel_path, header=1)  # header in row 2
    
    # Read EmployeeCompany.xlsx for department/division/designation mapping
    emp_company_path = os.path.join(SHEETS_FOLDER, 'EmployeeCompany.xlsx')
    emp_company_df = pd.read_excel(emp_company_path, header=2)  # header in row 3 (index 2)
    
    # Read Department.xlsx for department names
    dept_path = os.path.join(SHEETS_FOLDER, 'Department.xlsx')
    dept_df = pd.read_excel(dept_path, header=1)
    dept_lookup = dict(zip(dept_df['nDept_id'], dept_df['vDepartment']))
    
    # Read Division.xlsx for division names
    div_path = os.path.join(SHEETS_FOLDER, 'Division.xlsx')
    div_df = pd.read_excel(div_path, header=1)
    div_lookup = dict(zip(div_df['nDivision_id'], div_df['vDivision']))
    
    # Read BloodGroup.xlsx for blood group names
    blood_path = os.path.join(SHEETS_FOLDER, 'BloodGroup.xlsx')
    blood_df = pd.read_excel(blood_path, header=1)
    blood_lookup = dict(zip(blood_df['nBlood_id'] if 'nBlood_id' in blood_df.columns else blood_df.iloc[:, 0], 
                            blood_df['vBloodGroup'] if 'vBloodGroup' in blood_df.columns else blood_df.iloc[:, 1]))
    
    # Read EAddress.xlsx for address data
    addr_path = os.path.join(SHEETS_FOLDER, 'EAddress.xlsx')
    addr_df = pd.read_excel(addr_path, header=1)
    # Create address lookup: nEmp_id -> address info (prefer Type=1 for Current)
    addr_lookup = {}
    for _, row in addr_df.iterrows():
        emp_id = row.get('nEmp_id')
        if pd.notna(emp_id):
            addr_type = row.get('fAddrs_Type', 1)
            # Prefer Type=1 (Current address), but take any if none exists
            if int(emp_id) not in addr_lookup or addr_type == 1:
                addr_lookup[int(emp_id)] = {
                    'address1': row.get('vAddress1'),
                    'address2': row.get('vAddress2'),
                    'city': row.get('nCity_id'),  # Could be ID or name
                    'pincode': row.get('nPincode'),
                    'type': 'Current' if addr_type == 1 else 'Permanent'
                }
    
    # Read ESalary.xlsx for salary data (get latest/avg)
    salary_path = os.path.join(SHEETS_FOLDER, 'ESalary.xlsx')
    salary_df = pd.read_excel(salary_path, header=1)
    salary_lookup = {}
    for _, row in salary_df.iterrows():
        emp_id = row.get('nEmp_id')
        if pd.notna(emp_id):
            salary_lookup[int(emp_id)] = {
                'salary': row.get('nSalary'),
                'net_pay': row.get('nNetPay'),
                'pf': row.get('nPF'),
                'esi': row.get('nESI')
            }
    
    # Create lookup from EmployeeCompany: nEmp_id -> (department, division, designation)
    emp_company_lookup = {}
    for _, row in emp_company_df.iterrows():
        emp_id = row.get('nEmp_id')
        if pd.notna(emp_id):
            dept_id = row.get('nDept_id')
            div_id = row.get('nDivision_id')
            desig_id = row.get('nDesig_id')
            
            emp_company_lookup[int(emp_id)] = {
                'department': dept_lookup.get(dept_id, None) if pd.notna(dept_id) else None,
                'division': div_lookup.get(div_id, None) if pd.notna(div_id) else None,
                'dept_id': dept_id,
                'div_id': div_id,
                'desig_id': int(desig_id) if pd.notna(desig_id) else None
            }
    
    print(f"      - Found {len(emp_df)} employees from Excel")
    print(f"      - Loaded {len(emp_company_lookup)} employee-company mappings")
    print(f"      - Loaded {len(dept_lookup)} departments, {len(div_lookup)} divisions")
    print(f"      - Loaded {len(blood_lookup)} blood groups, {len(addr_lookup)} addresses, {len(salary_lookup)} salaries")
    
    dest_cursor = dest_conn.cursor()
    
    inserted_count = 0
    skipped_count = 0
    updated_count = 0
    
    for _, row in emp_df.iterrows():
        data = row.to_dict()
        
        # Get employee ID (nEmp_id is the internal ID used for lookups)
        internal_emp_id = data.get('nEmp_id')  # Internal ID for lookups
        employee_id = (data.get('vEmpNo') or data.get('EmployeeID') or 
                      data.get('EmpID') or data.get('nEmpNo') or data.get('ID'))
        full_name = (data.get('vName') or data.get('vNewName') or data.get('Name') or 
                    data.get('EmployeeName') or data.get('FullName'))
        email = data.get('Email') or data.get('vEmail') or f"{employee_id}@ves.com"
        
        # Skip if no employee_id or name
        if not employee_id or not full_name:
            skipped_count += 1
            if skipped_count <= 3:
                print(f"        ⚠️ Skipped row: emp_id={employee_id}, name={full_name}")
            continue
        
        # Look up department, division, designation from EmployeeCompany
        dept_info = emp_company_lookup.get(int(internal_emp_id)) if pd.notna(internal_emp_id) else None
        department = dept_info.get('department') if dept_info else None
        division = dept_info.get('division') if dept_info else None
        designation_id = dept_info.get('desig_id') if dept_info else None
        
        # Get gender (fGender: 1=Male, 2=Female)
        gender_val = data.get('fGender')
        gender = 'Male' if gender_val == 1 else 'Female' if gender_val == 2 else None
        
        # Get date of birth
        dob = data.get('DOB')
        if pd.notna(dob):
            try:
                if isinstance(dob, datetime):
                    dob = dob.strftime('%Y-%m-%d')
                else:
                    dob = pd.to_datetime(dob).strftime('%Y-%m-%d')
            except:
                dob = None
        else:
            dob = None
        
        # Get blood group
        blood_grp_id = data.get('nBloodGrp_id')
        
        # Get marital status (fSingle: 1=Single, 0=Married)
        marital_val = data.get('fSingle')
        marital_status = 'Single' if marital_val == 1 else 'Married' if marital_val == 0 else None
        
        # Get address info
        addr_info = addr_lookup.get(int(internal_emp_id)) if pd.notna(internal_emp_id) else None
        address1 = addr_info.get('address1') if addr_info else data.get('Address')
        address2 = addr_info.get('address2') if addr_info else None
        city = addr_info.get('city') if addr_info else None
        pincode = addr_info.get('pincode') if addr_info else None
        address_type = addr_info.get('type', 'Current') if addr_info else 'Current'
        
        # Get salary info
        salary_info = salary_lookup.get(int(internal_emp_id)) if pd.notna(internal_emp_id) else None
        salary = salary_info.get('salary') if salary_info else data.get('nSalary')
        net_pay = salary_info.get('net_pay') if salary_info else None
        pf_contrib = salary_info.get('pf') if salary_info else None
        esi_contrib = salary_info.get('esi') if salary_info else None
        
        # Get other fields
        bus_id = data.get('nBus_id')
        room_num = data.get('nRoom')
        
        # Get hire date
        hire_date = data.get('DOJ') or data.get('HireDate') or data.get('JoinDate') or datetime.now().strftime('%Y-%m-%d')
        if pd.notna(hire_date):
            try:
                if isinstance(hire_date, datetime):
                    hire_date = hire_date.strftime('%Y-%m-%d')
                elif isinstance(hire_date, str):
                    hire_date = hire_date
                else:
                    hire_date = pd.to_datetime(hire_date).strftime('%Y-%m-%d')
            except:
                hire_date = datetime.now().strftime('%Y-%m-%d')
        
        # Generate username and password
        # Username format: firstname.lastname
        name_parts = full_name.lower().strip().split() if full_name else []
        if len(name_parts) >= 2:
            username = f"{name_parts[0]}.{name_parts[-1]}"
        else:
            username = f"emp{employee_id}"
        
        # Password format: Ves@employee_id
        default_password = f"Ves@{employee_id}"
        password_hash = bcrypt.hashpw(default_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        try:
            # Check if employee already exists
            dest_cursor.execute("SELECT id FROM users WHERE employee_id = ?", (str(employee_id),))
            existing = dest_cursor.fetchone()
            
            if existing:
                # Update existing employee with all new fields
                dest_cursor.execute("""
                    UPDATE users 
                    SET department = ?, position = ?, designation_id = ?,
                        gender = ?, date_of_birth = ?, blood_group_id = ?, marital_status = ?,
                        address = ?, address_line2 = ?, city = ?, pincode = ?, address_type = ?,
                        salary = ?, pf_contribution = ?, esi_contribution = ?, net_pay = ?,
                        bus_id = ?, room_number = ?
                    WHERE employee_id = ?
                """, (
                    department, division, designation_id,
                    gender, dob, blood_grp_id, marital_status,
                    address1, address2, city, pincode, address_type,
                    salary, pf_contrib, esi_contrib, net_pay,
                    bus_id, room_num,
                    str(employee_id)
                ))
                updated_count += 1
            else:
                # Insert new employee with all fields
                dest_cursor.execute("""
                    INSERT INTO users (
                        employee_id, username, email, password_hash, full_name, role,
                        department, position, designation_id, hire_date, phone,
                        gender, date_of_birth, blood_group_id, marital_status,
                        address, address_line2, city, pincode, address_type,
                        salary, pf_contribution, esi_contribution, net_pay,
                        employee_category, shift, bus_id, room_number,
                        is_active, account_status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'Active')
                """, (
                    str(employee_id), username, email, password_hash, full_name, 'Employee',
                    department, division, designation_id, hire_date, data.get('Phone') or data.get('Mobile'),
                    gender, dob, blood_grp_id, marital_status,
                    address1, address2, city, pincode, address_type,
                    salary, pf_contrib, esi_contrib, net_pay,
                    data.get('Category') or 'W001', data.get('Shift'), bus_id, room_num
                ))
                inserted_count += 1
        except Exception as e:
            # Skip duplicates silently
            if 'UNIQUE constraint' not in str(e):
                print(f"        ⚠️ Error processing {employee_id}: {e}")
    
    dest_conn.commit()
    print(f"        ✅ Inserted: {inserted_count}, Updated: {updated_count}, Skipped: {skipped_count}")
    
    # After migrating employees, extract designations from the users table
    extract_designations_from_users(dest_conn)

def migrate_departments(source_conn, dest_conn, table_name):
    """Migrate department data to lookup table"""
    import pandas as pd
    
    # Read directly from Excel
    dept_path = os.path.join(SHEETS_FOLDER, 'Department.xlsx')
    dept_df = pd.read_excel(dept_path, header=1)
    
    print(f"      - Found {len(dept_df)} departments")
    
    dest_cursor = dest_conn.cursor()
    inserted = 0
    
    for _, row in dept_df.iterrows():
        dept_id = row.get('nDept_id')
        dept_name = row.get('vDepartment') or row.get('Department')
        dept_short = row.get('vShort')
        
        if pd.notna(dept_id) and pd.notna(dept_name):
            try:
                dest_cursor.execute("""
                    INSERT OR IGNORE INTO departments (dept_id, dept_name, dept_short)
                    VALUES (?, ?, ?)
                """, (int(dept_id), str(dept_name), dept_short))
                if dest_cursor.rowcount > 0:
                    inserted += 1
            except Exception as e:
                pass  # Skip errors
    
    dest_conn.commit()
    print(f"      - Migrated {inserted} departments to lookup table")

def migrate_divisions(source_conn, dest_conn, table_name):
    """Migrate division data to lookup table"""
    import pandas as pd
    
    # Read directly from Excel
    div_path = os.path.join(SHEETS_FOLDER, 'Division.xlsx')
    div_df = pd.read_excel(div_path, header=1)
    
    print(f"      - Found {len(div_df)} divisions")
    
    dest_cursor = dest_conn.cursor()
    inserted = 0
    
    for _, row in div_df.iterrows():
        div_id = row.get('nDivision_id')
        div_name = row.get('vDivision') or row.get('Division')
        dept_id = row.get('nDept_id')
        
        if pd.notna(div_id) and pd.notna(div_name):
            try:
                dest_cursor.execute("""
                    INSERT OR IGNORE INTO divisions (division_id, division_name, dept_id)
                    VALUES (?, ?, ?)
                """, (int(div_id), str(div_name), int(dept_id) if pd.notna(dept_id) else None))
                if dest_cursor.rowcount > 0:
                    inserted += 1
            except Exception as e:
                pass  # Skip errors
    
    dest_conn.commit()
    print(f"      - Migrated {inserted} divisions to lookup table")

def extract_designations_from_users(dest_conn):
    """Extract unique designations from users table and populate designations table"""
    print(f"      - Extracting designations from employee data...")
    
    dest_cursor = dest_conn.cursor()
    
    # Get unique designation_id and position from users
    dest_cursor.execute("""
        SELECT DISTINCT designation_id, position 
        FROM users 
        WHERE designation_id IS NOT NULL AND position IS NOT NULL
    """)
    
    designations = dest_cursor.fetchall()
    inserted = 0
    
    for desig_id, desig_name in designations:
        if desig_id and desig_name:
            try:
                dest_cursor.execute("""
                    INSERT OR IGNORE INTO designations (designation_id, designation_name)
                    VALUES (?, ?)
                """, (int(desig_id), str(desig_name)))
                if dest_cursor.rowcount > 0:
                    inserted += 1
            except Exception as e:
                pass
    
    dest_conn.commit()
    print(f"      - Extracted {inserted} designations from employee records")

def migrate_addresses(source_conn, dest_conn, table_name):
    """Migrate employee address data"""
    # Implementation based on actual Excel structure
    print(f"      - Address data migration (to be implemented)")

def migrate_salaries(source_conn, dest_conn, table_name):
    """Migrate salary data"""
    # Implementation based on actual Excel structure
    print(f"      - Salary data migration (to be implemented)")

def migrate_employee_company(source_conn, dest_conn, table_name):
    """Migrate employee company details"""
    # Implementation based on actual Excel structure
    print(f"      - Employee company data migration (to be implemented)")

def migrate_blood_groups(source_conn, dest_conn, table_name):
    """Migrate blood group data to lookup table"""
    import pandas as pd
    
    # Read directly from Excel
    blood_path = os.path.join(SHEETS_FOLDER, 'BloodGroup.xlsx')
    blood_df = pd.read_excel(blood_path, header=1)
    
    dest_cursor = dest_conn.cursor()
    inserted = 0
    
    for _, row in blood_df.iterrows():
        blood_id = row.get('nBloodGrp_id') or row.get('nBlood_id') or row.iloc[1]  # Try both column names
        blood_name = row.get('vBloodGroup') or row.iloc[2]
        
        if pd.notna(blood_id) and pd.notna(blood_name):
            try:
                dest_cursor.execute("""
                    INSERT OR IGNORE INTO blood_groups (blood_group_id, blood_group_name)
                    VALUES (?, ?)
                """, (int(blood_id), str(blood_name)))
                if dest_cursor.rowcount > 0:
                    inserted += 1
            except Exception as e:
                pass  # Skip errors
    
    dest_conn.commit()
    print(f"      - Migrated {inserted} blood groups to lookup table")

def migrate_punch_data(source_conn, dest_conn, table_name):
    """Migrate punch/attendance data to CheckInOut integration"""
    cursor = source_conn.cursor()
    cursor.execute(f"SELECT * FROM [{table_name}]")
    rows = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]
    
    print(f"      - Found {len(rows)} punch records")
    
    dest_cursor = dest_conn.cursor()
    
    for row in rows:
        data = dict(zip(columns, row))
        
        # Map to attendance table
        try:
            dest_cursor.execute("""
                INSERT OR IGNORE INTO attendance (
                    employee_id, date, clock_in, clock_out, status, hours_worked
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (
                data.get('EmployeeID'),
                data.get('Date'),
                data.get('ClockIn') or data.get('PunchIn'),
                data.get('ClockOut') or data.get('PunchOut'),
                data.get('Status') or 'Present',
                data.get('HoursWorked') or data.get('Hours')
            ))
        except Exception as e:
            print(f"        ⚠️ Error inserting punch record: {e}")

def cleanup_temp_databases(temp_databases):
    """Delete temporary databases after migration (except Punch Tym - keep as CheckInOut_DB)"""
    print("\n📁 Organizing databases (simulating client environment)...")
    
    # Create folder for separate databases (simulating client's SQL Server tables)
    client_dbs_folder = 'client_simulation_dbs'
    if not os.path.exists(client_dbs_folder):
        os.makedirs(client_dbs_folder)
        print(f"  ✓ Created folder: {client_dbs_folder}")
    
    for db_name, db_path in temp_databases.items():
        # Keep Punch Tym database and rename it to CheckInOut_DB (separate DB for punch data)
        if db_name == 'Punch Tym':
            new_path = 'CheckInOut_DB.db'
            try:
                if os.path.exists(db_path):
                    if os.path.exists(new_path):
                        os.remove(new_path)
                    os.rename(db_path, new_path)
                    print(f"  ✓ Kept as {new_path} (separate database for check-in/out)")
            except Exception as e:
                print(f"  ⚠️ Could not rename {db_path}: {e}")
            continue
        
        # Move other databases to client_simulation_dbs folder (simulating client's separate tables)
        try:
            if os.path.exists(db_path):
                # Rename to proper names (remove temp_ prefix)
                final_name = db_name.replace(' ', '_') + '.db'
                final_path = os.path.join(client_dbs_folder, final_name)
                
                if os.path.exists(final_path):
                    os.remove(final_path)
                os.rename(db_path, final_path)
                print(f"  ✓ Moved to {final_path}")
        except Exception as e:
            print(f"  ⚠️ Could not move {db_path}: {e}")

def populate_master_tables(conn):
    """Populate master_* tables from lookup tables"""
    print("\n📋 Populating master lookup tables...")
    
    cursor = conn.cursor()
    
    try:
        # Populate master_departments
        cursor.execute("SELECT dept_id, dept_name FROM departments")
        depts = cursor.fetchall()
        for dept_id, dept_name in depts:
            if dept_id and dept_name:
                cursor.execute("""
                    INSERT OR REPLACE INTO master_departments (id, dept_code, dept_name, is_active)
                    VALUES (?, ?, ?, 1)
                """, (dept_id, dept_name, dept_name))
        print(f"  ✓ Populated {len(depts)} departments")
        
        # Populate master_designations (category must be S001/W001/M001/T001)
        cursor.execute("SELECT designation_id, designation_name FROM designations")
        desigs = cursor.fetchall()
        for desig_id, desig_name in desigs:
            if desig_id and desig_name:
                cursor.execute("""
                    INSERT OR REPLACE INTO master_designations (id, designation_code, designation_name, category, is_active)
                    VALUES (?, ?, ?, ?, 1)
                """, (desig_id, desig_name, desig_name, 'S001'))
        print(f"  ✓ Populated {len(desigs)} designations")
        
        # Populate master_divisions
        cursor.execute("SELECT division_id, division_name FROM divisions")
        divs = cursor.fetchall()
        for div_id, div_name in divs:
            if div_id and div_name:
                cursor.execute("""
                    INSERT OR REPLACE INTO master_divisions (id, division_code, division_name, is_active)
                    VALUES (?, ?, ?, 1)
                """, (div_id, div_name, div_name))
        print(f"  ✓ Populated {len(divs)} divisions")
        
        conn.commit()
        print("  ✅ All master tables populated successfully")
        
    except Exception as e:
        print(f"  ⚠️ Error populating master tables: {e}")
        import traceback
        traceback.print_exc()

def seed_fixed_accounts(conn):
    """Seed fixed HR and Admin accounts"""
    print("\n👥 Creating fixed HR and Admin accounts...")
    
    cursor = conn.cursor()
    
    # Check if accounts already exist
    cursor.execute("SELECT COUNT(*) FROM users WHERE role IN ('Admin', 'HR')")
    count = cursor.fetchone()[0]
    
    if count > 0:
        print(f"  ℹ️  {count} HR/Admin accounts already exist, skipping...")
        return
    
    fixed_accounts = [
        # Admin accounts
        ('ADMIN001', 'admin1', 'admin1@ves.com', 'Admin@123', 'Mr. Suresh Babu', 'Admin', 'IT Administration', 'System Administrator'),
        ('ADMIN002', 'admin2', 'admin2@ves.com', 'Admin@123', 'Mr. Rajesh Kumar', 'Admin', 'IT Administration', 'Senior Admin'),
        ('ADMIN003', 'admin3', 'admin3@ves.com', 'Admin@123', 'Ms. Kavitha Menon', 'Admin', 'IT Administration', 'Admin Executive'),
        ('ADMIN004', 'admin4', 'admin4@ves.com', 'Admin@123', 'Mr. Vikram Singh', 'Admin', 'IT Administration', 'IT Administrator'),
        # HR accounts
        ('HR001', 'hr1', 'hr1@ves.com', 'HR@123', 'Ms. Priya Sharma', 'HR', 'Human Resources', 'HR Manager'),
        ('HR002', 'hr2', 'hr2@ves.com', 'HR@123', 'Ms. Anjali Nair', 'HR', 'Human Resources', 'Senior HR Executive'),
        ('HR003', 'hr3', 'hr3@ves.com', 'HR@123', 'Mr. Arjun Reddy', 'HR', 'Human Resources', 'HR Executive'),
        ('HR004', 'hr4', 'hr4@ves.com', 'HR@123', 'Ms. Meera Krishnan', 'HR', 'Human Resources', 'HR Coordinator'),
    ]
    
    for emp_id, username, email, password, full_name, role, dept, position in fixed_accounts:
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        try:
            cursor.execute("""
                INSERT INTO users (
                    employee_id, username, email, password_hash, full_name, role,
                    department, position, hire_date, employee_category, is_active, account_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'S001', 1, 'Active')
            """, (emp_id, username, email, password_hash, full_name, role, dept, position, datetime.now().date()))
            print(f"  ✓ Created {role}: {username}")
        except Exception as e:
            print(f"  ⚠️ Error creating {username}: {e}")
    
    conn.commit()
    print("✅ Fixed accounts created")

def main():
    parser = argparse.ArgumentParser(description='VES HRMS Database Migration')
    parser.add_argument('--mode', choices=['dev', 'prod'], default='dev',
                       help='Database mode: dev (SQLite) or prod (SQL Server)')
    parser.add_argument('--skip-cleanup', action='store_true',
                       help='Keep temporary databases (for debugging)')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🏢 VES HRMS - Database Migration Script")
    print("=" * 60)
    print(f"Mode: {args.mode.upper()}")
    print(f"{'SQLite (Development)' if args.mode == 'dev' else 'SQL Server (Production)'}")
    print("=" * 60)
    
    try:
        # Step 1: Read Excel files
        excel_data = read_excel_sheets()
        
        if not excel_data:
            print("❌ No Excel data found. Exiting...")
            sys.exit(1)
        
        # Step 2: Get database connection
        conn = get_db_connection(args.mode)
        print(f"\n✅ Connected to database")
        
        # Step 3: Initialize schema
        initialize_schema(conn, args.mode)
        
        # Step 4: Seed fixed HR/Admin accounts
        seed_fixed_accounts(conn)
        
        # Step 5: Create temporary databases
        temp_databases = create_temporary_databases(excel_data, args.mode)
        
        # Step 6: Migrate data to VES_HRMS
        migrate_to_hrms(temp_databases, conn, args.mode)
        
        # Step 7: Populate master lookup tables
        populate_master_tables(conn)
        
        # Step 8: Cleanup
        if not args.skip_cleanup:
            cleanup_temp_databases(temp_databases)
        
        conn.close()
        
        print("\n" + "=" * 60)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        print("\n🔐 Login Credentials:")
        print("\n  Admin Accounts:")
        print("    admin1 / Admin@123")
        print("    admin2 / Admin@123")
        print("    admin3 / Admin@123")
        print("    admin4 / Admin@123")
        print("\n  HR Accounts:")
        print("    hr1 / HR@123")
        print("    hr2 / HR@123")
        print("    hr3 / HR@123")
        print("    hr4 / HR@123")
        print("\n  Employees:")
        print("    Default password = Employee ID")
        print("\n" + "=" * 60)
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
