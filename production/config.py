# ============================================================
# VES HRMS - Production Configuration
# ============================================================
# 
# This file contains all configuration for production deployment.
# Copy this to the server and update values as needed.
# ============================================================

import os
from datetime import timedelta

# ============================================================
# DATABASE CONFIGURATION
# ============================================================
# Set DB_TYPE to 'sqlserver' for production, 'sqlite' for development

DB_TYPE = os.environ.get('DB_TYPE', 'sqlserver')  # 'sqlite' or 'sqlserver'

# SQLite Configuration (Development)
SQLITE_PATH = os.path.join(os.path.dirname(__file__), 'ves_hrms.db')

# SQL Server Configuration (Production)
SQLSERVER_CONFIG = {
    'server': os.environ.get('DB_SERVER', 'localhost'),
    'database': os.environ.get('DB_NAME', 'VES_HRMS'),
    'username': os.environ.get('DB_USER', 'ves_hrms_app'),
    'password': os.environ.get('DB_PASSWORD', ''),
    'driver': os.environ.get('DB_DRIVER', 'ODBC Driver 17 for SQL Server'),
    # Connection pool settings
    'pool_size': 5,
    'pool_timeout': 30,
}

# ============================================================
# SECURITY CONFIGURATION
# ============================================================
SECRET_KEY = os.environ.get('SECRET_KEY', 'CHANGE-THIS-IN-PRODUCTION-use-random-string')
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'CHANGE-THIS-IN-PRODUCTION-use-random-string')
JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=3)
JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)

# ============================================================
# APPLICATION CONFIGURATION
# ============================================================
APP_NAME = 'VES HRMS'
DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'
HOST = os.environ.get('HOST', '0.0.0.0')
PORT = int(os.environ.get('PORT', 5000))

# File uploads
UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', 'uploads')
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB

# Logs
LOGS_FOLDER = os.environ.get('LOGS_FOLDER', 'logs')

# ============================================================
# CORS CONFIGURATION
# ============================================================
# Update this to your frontend domain in production
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',')

# ============================================================
# RATE LIMITING
# ============================================================
RATE_LIMIT_DEFAULT = "200 per day"
RATE_LIMIT_LOGIN = "10 per minute"

# ============================================================
# EMAIL CONFIGURATION (Override via database settings)
# ============================================================
SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_EMAIL = os.environ.get('SMTP_EMAIL', '')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')

# ============================================================
# OFFICE HOURS
# ============================================================
OFFICE_START_TIME = '09:00'
OFFICE_END_TIME = '18:00'
LATE_THRESHOLD_MINUTES = 15
EARLY_LEAVE_THRESHOLD_MINUTES = 30
