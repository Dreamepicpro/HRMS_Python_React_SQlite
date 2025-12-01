# ============================================================
# VES HRMS - STEP BY STEP PRODUCTION SETUP
# For Junior Developers - Easy Guide
# ============================================================

"""
This guide explains EXACTLY what to do at the client site.
Follow these steps in order.

WHAT YOU NEED:
1. This VesHRMS folder (copy from your laptop)
2. Client's SQL Server details
3. Employee Details.xlsx file
4. Python installed on client server
"""

# ============================================================
# STEP 1: PREPARE CLIENT SERVER
# ============================================================
"""
1.1 Install Python on client server:
    - Download from: https://www.python.org/downloads/
    - During install, CHECK "Add Python to PATH"
    - Verify: Open cmd, type: python --version

1.2 Install ODBC Driver:
    - Download "ODBC Driver 17 for SQL Server" from Microsoft
    - URL: https://docs.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server
    - Install it (just click Next, Next, Finish)
"""

# ============================================================
# STEP 2: COPY FILES TO CLIENT SERVER
# ============================================================
"""
2.1 Create folder on client server:
    - Create: C:\VES_HRMS\

2.2 Copy these from your laptop:
    VesHRMS/
    ├── app.py
    ├── requirements.txt
    ├── production/           <-- IMPORTANT: This entire folder
    │   ├── init_sqlserver.sql
    │   ├── seed_sqlserver.py
    │   ├── config.py
    │   └── requirements_production.txt
    ├── uploads/             <-- Create empty folder
    ├── logs/                <-- Create empty folder
    └── Employee Details.xlsx  <-- Get from client

2.3 Also copy frontend build:
    - On your laptop: cd frontend && npm run build
    - Copy the 'build' folder to client server
"""

# ============================================================
# STEP 3: CREATE DATABASE IN SSMS
# ============================================================
"""
3.1 Open SQL Server Management Studio (SSMS)

3.2 Connect to SQL Server:
    - Server name: localhost (or server name)
    - Authentication: Windows Authentication (or SQL Server Auth)

3.3 Create Database:
    - Right-click "Databases" > "New Database"
    - Name: VES_HRMS
    - Click OK

3.4 Run Schema Script:
    - Click "New Query"
    - Open file: C:\VES_HRMS\production\init_sqlserver.sql
    - Or copy-paste the entire SQL script
    - Press F5 (or click Execute)
    - You should see "Commands completed successfully"

3.5 Create Login (if using SQL Server Authentication):
    - Security > Logins > Right-click > New Login
    - Login name: ves_hrms_app
    - SQL Server authentication
    - Password: YourSecurePassword123!
    - Default database: VES_HRMS
    
    Then in VES_HRMS database:
    - Security > Users > Right-click > New User
    - User name: ves_hrms_app
    - Login name: ves_hrms_app
    - Click OK
    
    Grant permissions:
    - Right-click the user > Properties > Membership
    - Check: db_datareader, db_datawriter
"""

# ============================================================
# STEP 4: INSTALL PYTHON PACKAGES
# ============================================================
"""
4.1 Open Command Prompt as Administrator

4.2 Navigate to project folder:
    cd C:\VES_HRMS

4.3 Install packages:
    pip install -r production/requirements_production.txt

4.4 If you get errors, try:
    pip install flask flask-cors flask-jwt-extended flask-limiter
    pip install pyodbc bcrypt pandas openpyxl waitress
"""

# ============================================================
# STEP 5: SEED THE DATABASE
# ============================================================
"""
5.1 Put Employee Details.xlsx in C:\VES_HRMS\

5.2 Open Command Prompt:
    cd C:\VES_HRMS\production

5.3 First, TEST the connection:
    python seed_sqlserver.py --test

    If successful, you'll see:
    "✅ Connected to SQL Server successfully"
    "✅ Connection test successful!"

    If failed, check:
    - Is SQL Server running?
    - Is database name correct?
    - Is username/password correct?

5.4 Run the seed script:
    
    WITH SQL Server Authentication:
    python seed_sqlserver.py --file="../Employee Details.xlsx" --server="localhost" --database="VES_HRMS" --user="ves_hrms_app" --password="YourPassword"

    WITH Windows Authentication:
    (Edit seed_sqlserver.py, set USE_WINDOWS_AUTH = True)
    python seed_sqlserver.py --file="../Employee Details.xlsx"

5.5 You should see:
    "✅ Inserted: XX employees"
    "✅ Database seeding completed successfully!"
"""

# ============================================================
# STEP 6: CONFIGURE THE APP
# ============================================================
"""
6.1 Edit app.py for SQL Server:
    Open C:\VES_HRMS\app.py in Notepad or any editor

6.2 Find this section (near the top):
    # ============================================================
    # DATABASE DRIVER IMPORT
    # ============================================================
    # DEVELOPMENT (SQLite) - Currently Active
    import sqlite3

    # PRODUCTION (SQL Server) - Uncomment for client deployment
    # import pyodbc

6.3 Change to:
    # DEVELOPMENT (SQLite) - Comment out for production
    # import sqlite3

    # PRODUCTION (SQL Server) - Now Active
    import pyodbc

6.4 Find this section:
    # DEVELOPMENT (SQLite) - Currently Active
    DATABASE_TYPE = 'sqlite'
    DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'ves_hrms.db')

    # PRODUCTION (SQL Server) - Uncomment below
    # DATABASE_TYPE = 'sqlserver'
    # SQLSERVER_CONFIG = {...}

6.5 Change to:
    # DEVELOPMENT (SQLite) - Comment out for production
    # DATABASE_TYPE = 'sqlite'
    # DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'ves_hrms.db')

    # PRODUCTION (SQL Server) - Now Active
    DATABASE_TYPE = 'sqlserver'
    SQLSERVER_CONFIG = {
        'server': 'localhost',  # Change to your server
        'database': 'VES_HRMS',
        'username': 'ves_hrms_app',
        'password': 'YourPassword',  # Change to your password
        'driver': 'ODBC Driver 17 for SQL Server'
    }

6.6 Find get_db_connection() function:
    - Comment out the SQLite version
    - Uncomment the SQL Server version
    (Follow the comments in the code)
"""

# ============================================================
# STEP 7: START THE APPLICATION
# ============================================================
"""
7.1 Open Command Prompt:
    cd C:\VES_HRMS

7.2 Start the backend server:
    
    FOR TESTING:
    python app.py
    
    FOR PRODUCTION (use waitress):
    waitress-serve --host=0.0.0.0 --port=5000 app:app

7.3 You should see:
    "=== VES HRMS Server Starting ==="
    "Running on http://0.0.0.0:5000"

7.4 Test in browser:
    http://localhost:5000/api/health
    Should return: {"status": "ok"}
"""

# ============================================================
# STEP 8: SERVE THE FRONTEND
# ============================================================
"""
Option A: Use Flask to serve frontend (Simple)
    - Copy 'build' folder contents to C:\VES_HRMS\static\
    - The app will serve frontend automatically

Option B: Use IIS (Professional)
    - Open IIS Manager
    - Create new site pointing to 'build' folder
    - Configure URL rewrite for React routing

Option C: Use Nginx (If installed)
    - Configure nginx.conf to serve build folder
"""

# ============================================================
# STEP 9: TEST THE APPLICATION
# ============================================================
"""
9.1 Open browser: http://localhost:3000 (or the server IP)

9.2 Login with default credentials:
    Admin:    admin / admin123
    HR:       hr_manager / VEShr123!
    Employee: <emp_id> / <emp_id>

9.3 Check:
    - Can you login?
    - Does dashboard load?
    - Can you see employees?
    - Can you mark attendance?
"""

# ============================================================
# TROUBLESHOOTING
# ============================================================
"""
ERROR: "Database connection error"
→ Check SQL Server is running
→ Check database name is correct
→ Check username/password
→ Check ODBC Driver is installed

ERROR: "Module not found"
→ pip install <module_name>

ERROR: "Access denied"
→ Run Command Prompt as Administrator
→ Check SQL Server user has proper permissions

ERROR: "Port already in use"
→ Use different port: waitress-serve --port=5001 app:app

LOGS:
→ Check C:\VES_HRMS\logs\error.log
→ Check C:\VES_HRMS\logs\app.log
"""

# ============================================================
# CHECKLIST BEFORE LEAVING CLIENT SITE
# ============================================================
"""
□ SQL Server database created
□ All tables exist (check in SSMS)
□ Employees imported from Excel
□ HR/Admin users can login
□ Employees can login
□ Attendance works
□ Leave requests work
□ Logs folder has files being created
□ Client knows how to start the server
□ Client has this documentation
"""

print("""
============================================================
QUICK COMMANDS REFERENCE
============================================================

# Test database connection:
python production/seed_sqlserver.py --test

# Seed database with Excel data:
python production/seed_sqlserver.py --file="Employee Details.xlsx"

# Start server (development):
python app.py

# Start server (production):
waitress-serve --host=0.0.0.0 --port=5000 app:app

# Check logs:
type logs\\error.log
type logs\\app.log
============================================================
""")
