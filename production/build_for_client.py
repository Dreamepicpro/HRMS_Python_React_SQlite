"""
============================================================
VES HRMS - BUILD FOR CLIENT DEPLOYMENT
============================================================
This script creates a deployment package with COMPILED code.
Client cannot see your source code!

Run this on YOUR LAPTOP before going to client site.
============================================================
"""

import os
import subprocess
import shutil
import sys

# Configuration
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD_DIR = os.path.join(PROJECT_ROOT, 'client_deployment')
FRONTEND_DIR = os.path.join(PROJECT_ROOT, 'frontend')

def print_header(text):
    print("\n" + "=" * 60)
    print("  " + text)
    print("=" * 60)

def clean_build_dir():
    """Remove old build directory"""
    if os.path.exists(BUILD_DIR):
        print("[*] Removing old build directory...")
        shutil.rmtree(BUILD_DIR)
    os.makedirs(BUILD_DIR)
    print("[OK] Created fresh build directory")

def install_pyinstaller():
    """Install PyInstaller if not present"""
    try:
        import PyInstaller
        print("[OK] PyInstaller is installed")
    except ImportError:
        print("[*] Installing PyInstaller...")
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'pyinstaller'], check=True)
        print("[OK] PyInstaller installed")

def compile_backend():
    """Compile app.py to .exe using PyInstaller"""
    print_header("COMPILING BACKEND (app.py to app.exe)")
    
    app_path = os.path.join(PROJECT_ROOT, 'app.py')
    
    # PyInstaller command
    cmd = [
        sys.executable, '-m', 'PyInstaller',
        '--onefile',                    # Single .exe file
        '--name', 'ves_hrms_server',    # Output name
        '--distpath', BUILD_DIR,        # Output directory
        '--workpath', os.path.join(BUILD_DIR, 'temp'),
        '--specpath', os.path.join(BUILD_DIR, 'temp'),
        '--hidden-import', 'flask',
        '--hidden-import', 'flask_cors',
        '--hidden-import', 'flask_jwt_extended',
        '--hidden-import', 'flask_limiter',
        '--hidden-import', 'pyodbc',
        '--hidden-import', 'bcrypt',
        '--hidden-import', 'pandas',
        '--hidden-import', 'openpyxl',
        '--hidden-import', 'waitress',
        app_path
    ]
    
    print("[*] Building... (this takes 2-5 minutes)")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode == 0:
        print("[OK] Backend compiled successfully!")
        print("     Output: " + os.path.join(BUILD_DIR, 'ves_hrms_server.exe'))
    else:
        print("[ERROR] Build failed!")
        print(result.stderr)
        return False
    
    # Cleanup temp files
    temp_dir = os.path.join(BUILD_DIR, 'temp')
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    
    return True

def build_frontend():
    """Build React frontend"""
    print_header("BUILDING FRONTEND (React to Static Files)")
    
    if not os.path.exists(FRONTEND_DIR):
        print("[WARN] Frontend directory not found, skipping...")
        return True
    
    # Install dependencies
    print("[*] Installing npm packages...")
    subprocess.run(['npm', 'install'], cwd=FRONTEND_DIR, shell=True)
    
    # Build
    print("[*] Building React app...")
    result = subprocess.run(['npm', 'run', 'build'], cwd=FRONTEND_DIR, shell=True)
    
    if result.returncode == 0:
        # Copy build to deployment directory
        frontend_build = os.path.join(FRONTEND_DIR, 'build')
        deploy_frontend = os.path.join(BUILD_DIR, 'frontend')
        if os.path.exists(frontend_build):
            shutil.copytree(frontend_build, deploy_frontend)
            print("[OK] Frontend built and copied!")
        return True
    else:
        print("[ERROR] Frontend build failed!")
        return False

def create_config_file():
    """Create editable config file for client"""
    print_header("CREATING CONFIG FILE")
    
    config_content = """# ============================================================
# VES HRMS - PRODUCTION CONFIGURATION
# ============================================================
# Edit these settings for your environment
# ============================================================

[database]
# SQL Server Connection
server = localhost
database = VES_HRMS
username = ves_hrms_app
password = CHANGE_THIS_PASSWORD
driver = ODBC Driver 17 for SQL Server

# Set to 'true' for Windows Authentication (no username/password needed)
use_windows_auth = false

[server]
# Application Server Settings
host = 0.0.0.0
port = 5000

# Set to 'true' for production
production_mode = true

[security]
# JWT Secret Key (CHANGE THIS!)
jwt_secret_key = CHANGE-THIS-TO-A-RANDOM-STRING-12345

# Session timeout in hours
session_timeout = 8

[email]
# SMTP Settings (configure in app or here)
smtp_server = smtp.gmail.com
smtp_port = 587
smtp_username = 
smtp_password = 

[logging]
# Log file settings
log_directory = logs
max_log_size_mb = 10
backup_count = 10
"""
    
    config_path = os.path.join(BUILD_DIR, 'config.ini')
    with open(config_path, 'w', encoding='utf-8') as f:
        f.write(config_content)
    
    print("[OK] Config file created: " + config_path)

def create_startup_scripts():
    """Create easy startup scripts for client"""
    print_header("CREATING STARTUP SCRIPTS")
    
    # Windows batch file to start server
    start_bat = """@echo off
echo ============================================================
echo           VES HRMS Server Starting...
echo ============================================================
echo.

REM Create required directories
if not exist "logs" mkdir logs
if not exist "uploads" mkdir uploads

REM Start the server
ves_hrms_server.exe

pause
"""
    
    with open(os.path.join(BUILD_DIR, 'START_SERVER.bat'), 'w') as f:
        f.write(start_bat)
    
    # Windows service installer (optional)
    service_bat = """@echo off
echo ============================================================
echo   Installing VES HRMS as Windows Service
echo ============================================================
echo.
echo This will install VES HRMS to run automatically on startup.
echo.

REM Requires NSSM (Non-Sucking Service Manager)
REM Download from: https://nssm.cc/download

nssm install VES_HRMS "%~dp0ves_hrms_server.exe"
nssm set VES_HRMS AppDirectory "%~dp0"
nssm set VES_HRMS DisplayName "VES HRMS Server"
nssm set VES_HRMS Description "VES Human Resource Management System"
nssm set VES_HRMS Start SERVICE_AUTO_START

echo.
echo Service installed! Start with: net start VES_HRMS
pause
"""
    
    with open(os.path.join(BUILD_DIR, 'INSTALL_AS_SERVICE.bat'), 'w') as f:
        f.write(service_bat)
    
    print("[OK] Startup scripts created")

def create_folders():
    """Create required folders"""
    print_header("CREATING REQUIRED FOLDERS")
    
    folders = ['logs', 'uploads']
    for folder in folders:
        folder_path = os.path.join(BUILD_DIR, folder)
        os.makedirs(folder_path, exist_ok=True)
        # Create a placeholder file
        with open(os.path.join(folder_path, '.gitkeep'), 'w') as f:
            f.write('')
    
    print("[OK] Created: logs/, uploads/")

def copy_sql_scripts():
    """Copy SQL scripts for database setup"""
    print_header("COPYING DATABASE SCRIPTS")
    
    sql_dir = os.path.join(BUILD_DIR, 'database_setup')
    os.makedirs(sql_dir, exist_ok=True)
    
    # Copy init script
    init_sql = os.path.join(PROJECT_ROOT, 'production', 'init_sqlserver.sql')
    if os.path.exists(init_sql):
        shutil.copy(init_sql, sql_dir)
        print("[OK] Copied: init_sqlserver.sql")
    
    print("[OK] Database setup scripts copied")

def create_readme():
    """Create deployment README for your reference"""
    print_header("CREATING DEPLOYMENT README")
    
    readme = """# VES HRMS - Deployment Package
================================

## FOR VES TEAM ONLY - DO NOT SHARE WITH CLIENT

### What's in this package:
- ves_hrms_server.exe  - Compiled backend (client cannot see code)
- frontend/            - Compiled React app (client cannot see code)
- config.ini           - Editable settings (client can modify)
- logs/                - Log files will be created here
- uploads/             - Uploaded files stored here
- database_setup/      - SQL scripts for DB setup (YOU run this)

### Deployment Steps:

1. BEFORE GOING TO CLIENT:
   - Build this package using build_for_client.py
   - Test the .exe works on your machine
   - Prepare Employee Details.xlsx

2. AT CLIENT SITE:

   A. Setup SQL Server (in SSMS):
      - Create database: VES_HRMS
      - Run: database_setup/init_sqlserver.sql
      - Create user with read/write permissions
   
   B. Configure Application:
      - Edit config.ini with correct database settings
      - Set a strong JWT secret key
   
   C. Seed Database:
      - YOU run the seed script (don't leave it with client)
      - Use YOUR laptop to connect to their SQL Server
      - python seed_sqlserver.py --server="THEIR_SERVER" --file="Employee Details.xlsx"
   
   D. Start Application:
      - Double-click START_SERVER.bat
      - Or install as service using INSTALL_AS_SERVICE.bat
   
   E. Test Everything:
      - Login as admin
      - Login as HR
      - Login as employee
      - Test attendance, leave, payroll
   
   F. Before Leaving:
      - Remove any scripts/tools from client server
      - Only leave: exe, frontend, config.ini, logs, uploads folders

3. WHAT CLIENT HAS (No Source Code):
   - Compiled .exe (cannot decompile easily)
   - Compiled frontend (minified, no source maps)
   - Config file (only settings, no code)
   - Their data in SQL Server

4. FUTURE SUPPORT:
   - Client calls you with issue
   - You connect remotely (TeamViewer/AnyDesk)
   - You check logs/ folder for errors
   - You fix on YOUR machine, rebuild, deploy new .exe
"""
    
    with open(os.path.join(BUILD_DIR, 'DEPLOYMENT_NOTES.md'), 'w', encoding='utf-8') as f:
        f.write(readme)
    
    print("[OK] Deployment README created")

def create_deployment_checklist():
    """Create a checklist for deployment"""
    checklist = """
============================================================
VES HRMS - DEPLOYMENT CHECKLIST
============================================================

[ ] BEFORE LEAVING OFFICE:
    [ ] Run build_for_client.py
    [ ] Test ves_hrms_server.exe on your machine
    [ ] Copy Employee Details.xlsx
    [ ] Pack your laptop charger!

[ ] AT CLIENT SITE - DATABASE:
    [ ] Open SSMS, connect to SQL Server
    [ ] Create database: VES_HRMS
    [ ] Run init_sqlserver.sql
    [ ] Create application user
    [ ] Note down: Server name, Database name, Username, Password

[ ] AT CLIENT SITE - APPLICATION:
    [ ] Copy client_deployment folder to C:\\VES_HRMS
    [ ] Edit config.ini with database settings
    [ ] Run seed_sqlserver.py from YOUR laptop
    [ ] Double-click START_SERVER.bat
    [ ] Check server starts without errors

[ ] AT CLIENT SITE - TESTING:
    [ ] Open browser: http://localhost:5000
    [ ] Login as admin (admin/admin123)
    [ ] Login as HR (hr_manager/VEShr123!)
    [ ] Login as employee
    [ ] Test attendance check-in/out
    [ ] Test leave request
    [ ] Test payroll (if applicable)
    [ ] Check logs are being created

[ ] BEFORE LEAVING CLIENT:
    [ ] Delete seed script from client machine (if copied)
    [ ] Delete Employee Details.xlsx from client machine
    [ ] Change admin password
    [ ] Change HR passwords
    [ ] Note the server IP for remote access
    [ ] Hand over config.ini backup to client IT

[ ] BACK AT OFFICE:
    [ ] Document the deployment
    [ ] Store client config (secure location)
    [ ] Update support ticket system

============================================================
"""
    
    with open(os.path.join(BUILD_DIR, 'CHECKLIST.txt'), 'w', encoding='utf-8') as f:
        f.write(checklist)
    
    print("[OK] Deployment checklist created")

def main():
    print("""
============================================================
     VES HRMS - BUILD FOR CLIENT DEPLOYMENT
============================================================
This will create a deployment package with COMPILED code.
The client will NOT be able to see your source code.
============================================================
    """)
    
    # Step 1: Clean
    clean_build_dir()
    
    # Step 2: Install PyInstaller
    install_pyinstaller()
    
    # Step 3: Compile backend
    # Uncomment when ready to build:
    compile_backend()
    print("\n[WARN] Backend compilation skipped (uncomment in script to enable)")
    print("       For now, we'll create the package structure...")
    
    # Step 4: Build frontend
    build_frontend()
    print("[WARN] Frontend build skipped (uncomment in script to enable)")
    
    # Step 5: Create config
    create_config_file()
    
    # Step 6: Create startup scripts
    create_startup_scripts()
    
    # Step 7: Create folders
    create_folders()
    
    # Step 8: Copy SQL scripts
    copy_sql_scripts()
    
    # Step 9: Create documentation
    create_readme()
    create_deployment_checklist()
    
    print_header("BUILD COMPLETE!")
    print("""
Deployment package created at:
   """ + BUILD_DIR + """

Contents:
   +-- ves_hrms_server.exe    (after uncommenting compile_backend)
   +-- frontend/              (after uncommenting build_frontend)
   +-- config.ini             [OK]
   +-- START_SERVER.bat       [OK]
   +-- INSTALL_AS_SERVICE.bat [OK]
   +-- database_setup/        [OK]
   +-- logs/                  [OK]
   +-- uploads/               [OK]
   +-- DEPLOYMENT_NOTES.md    [OK]
   +-- CHECKLIST.txt          [OK]

Next Steps:
   1. Uncomment compile_backend() and build_frontend() in this script
   2. Run this script again to create .exe
   3. Test the .exe on your machine
   4. Copy client_deployment folder to USB/cloud
   5. Go to client site and deploy!
    """)

if __name__ == '__main__':
    main()
