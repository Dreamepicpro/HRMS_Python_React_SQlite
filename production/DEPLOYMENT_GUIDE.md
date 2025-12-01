# VES HRMS - Production Deployment Guide

## 📋 Overview
This guide explains how to deploy VES HRMS from your local development environment (SQLite) to a production server using SQL Server (SSMS).

---

## 🏗️ Architecture

### Development (Your Local Machine)
```
Local Machine (Windows)
├── SQLite Database (ves_hrms.db)
├── Flask Backend (Python)
├── React Frontend
└── All data stored locally
```

### Production (Client Server)
```
Client Server (Windows Server)
├── SQL Server Database (SSMS)
├── Flask Backend (Python) - Running as Windows Service or IIS
├── React Frontend - Built & served via IIS/Nginx
└── Centralized database for multiple users
```

---

## 📁 Files to Copy to Client Server

### Step 1: Backend Files
Copy these files/folders to client server (e.g., `C:\VES_HRMS\`):
```
VesHRMS/
├── app.py                    # Main backend (modify DB connection)
├── requirements.txt          # Python dependencies
├── production/
│   ├── app_sqlserver.py      # SQL Server version (USE THIS)
│   ├── init_sqlserver.sql    # SQL Server schema
│   └── config.py             # Production config
├── uploads/                  # Document uploads folder
└── logs/                     # Application logs
```

### Step 2: Frontend Build
```bash
# On your local machine, build the React app:
cd frontend
npm run build

# Copy the 'build' folder to client server
# Serve via IIS or place in Flask static folder
```

---

## 🔧 SQL Server Setup (Client Side)

### 1. Create Database in SSMS
```sql
CREATE DATABASE VES_HRMS;
GO
USE VES_HRMS;
GO
```

### 2. Run Schema Script
Run `production/init_sqlserver.sql` in SSMS to create all tables.

### 3. Create SQL Server Login
```sql
-- Create login for the application
CREATE LOGIN ves_hrms_app WITH PASSWORD = 'YourSecurePassword123!';
GO

-- Create user in database
USE VES_HRMS;
CREATE USER ves_hrms_app FOR LOGIN ves_hrms_app;
GO

-- Grant permissions
ALTER ROLE db_datareader ADD MEMBER ves_hrms_app;
ALTER ROLE db_datawriter ADD MEMBER ves_hrms_app;
GO
```

---

## 🐍 Python Setup on Client Server

### 1. Install Python
Download and install Python 3.10+ from python.org

### 2. Install Dependencies
```bash
cd C:\VES_HRMS
pip install -r requirements_production.txt
```

### 3. Set Environment Variables
Create `C:\VES_HRMS\.env` file:
```env
# Database - SQL Server
DB_TYPE=sqlserver
DB_SERVER=localhost
DB_NAME=VES_HRMS
DB_USER=ves_hrms_app
DB_PASSWORD=YourSecurePassword123!

# Security
SECRET_KEY=your-super-secret-key-change-this
JWT_SECRET_KEY=your-jwt-secret-change-this

# Email (configure in Admin UI or here)
SMTP_SERVER=smtp.company.com
SMTP_PORT=587
SMTP_EMAIL=hrms@company.com
SMTP_PASSWORD=email-password
```

---

## 🚀 Running in Production

### Option 1: Run as Windows Service (Recommended)
```bash
# Install NSSM (Non-Sucking Service Manager)
# Download from nssm.cc

nssm install VES_HRMS "C:\Python310\python.exe" "C:\VES_HRMS\app_sqlserver.py"
nssm set VES_HRMS AppDirectory "C:\VES_HRMS"
nssm start VES_HRMS
```

### Option 2: Run with Waitress (Production WSGI Server)
```bash
pip install waitress
waitress-serve --host=0.0.0.0 --port=5000 app_sqlserver:app
```

### Option 3: IIS with wfastcgi
See Microsoft documentation for Flask on IIS.

---

## 🔄 Switching Between SQLite and SQL Server

### In app.py, look for these sections:

```python
# ============== DATABASE CONFIGURATION ==============
# 
# DEVELOPMENT (SQLite) - Currently Active
# Uncomment this section for local development
#
DATABASE_TYPE = 'sqlite'
DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'ves_hrms.db')

# PRODUCTION (SQL Server) - Uncomment for client deployment
# Comment out SQLite section above and uncomment below
#
# DATABASE_TYPE = 'sqlserver'
# DB_SERVER = os.environ.get('DB_SERVER', 'localhost')
# DB_NAME = os.environ.get('DB_NAME', 'VES_HRMS')
# DB_USER = os.environ.get('DB_USER', 'ves_hrms_app')
# DB_PASSWORD = os.environ.get('DB_PASSWORD', '')
```

---

## 📊 Data Migration (SQLite to SQL Server)

If you have existing data in SQLite that needs to go to SQL Server:

```python
# Run migration script (production/migrate_data.py)
python production/migrate_data.py
```

---

## ✅ Pre-Deployment Checklist

- [ ] SQL Server database created
- [ ] All tables created via init_sqlserver.sql
- [ ] Python installed on server
- [ ] Dependencies installed (requirements_production.txt)
- [ ] Environment variables configured (.env file)
- [ ] Firewall allows port 5000 (or your chosen port)
- [ ] Frontend build copied to server
- [ ] Test login with admin account
- [ ] SMTP email settings configured
- [ ] Logs directory writable
- [ ] Uploads directory writable

---

## 🔒 Security Recommendations for Production

1. **Change all default passwords**
2. **Use HTTPS** - Get SSL certificate
3. **Configure firewall** - Only allow necessary ports
4. **Regular backups** - SQL Server backup jobs
5. **Update SECRET_KEY** - Use strong random key
6. **Limit CORS** - Only allow your frontend domain

---

## 📞 Support

For issues during deployment, check:
1. `logs/error.log` - Application errors
2. `logs/security.log` - Authentication issues
3. SQL Server logs in SSMS
4. Windows Event Viewer

---

*Document Version: 1.0 | Last Updated: December 2025*
