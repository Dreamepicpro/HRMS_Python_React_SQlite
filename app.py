# VES HRMS - Flask Backend
# Elite HR fortress with role-morphing dashboards and bulletproof security
# ============================================================
# DATABASE CONFIGURATION NOTES:
# 
# CURRENT: SQLite (for local development)
# PRODUCTION: SQL Server (for client deployment)
#
# To switch to SQL Server:
# 1. Comment out: import sqlite3
# 2. Uncomment: import pyodbc
# 3. Comment out: DATABASE_PATH line
# 4. Uncomment: SQLSERVER_CONFIG section
# 5. Replace get_db_connection() function with SQL Server version
#
# See production/DEPLOYMENT_GUIDE.md for detailed instructions
# ============================================================

import os
import logging
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from functools import wraps
import bcrypt

# ============================================================
# DATABASE DRIVER IMPORT
# ============================================================
# DEVELOPMENT (SQLite) - Currently Active
import sqlite3

# PRODUCTION (SQL Server) - Uncomment for client deployment
# import pyodbc
# ============================================================

from flask import Flask, request, jsonify, send_from_directory
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, create_refresh_token, get_jwt_identity, get_jwt
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import pandas as pd
from werkzeug.utils import secure_filename

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'ves-hrms-secure-key-change-in-prod')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-change-in-prod')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=3)  # 3 hour access token validity
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=7)  # 7 day refresh token validity
app.config['JWT_BLOCKLIST_ENABLED'] = True  # Enable token blocklist checking
app.config['JWT_BLOCKLIST_TOKEN_CHECKS'] = ['access', 'refresh']  # Check both access and refresh tokens
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload

# Email Configuration - Now loaded from database via get_email_config()
# No need to set environment variables - configure via Admin Settings in UI

# Initialize extensions
jwt = JWTManager(app)
CORS(app, origins=['http://localhost:3000'], supports_credentials=True, 
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])  # React dev server
limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"]
)

# ============================================================
# DATABASE CONFIGURATION
# ============================================================
# DEVELOPMENT (SQLite) - Currently Active
DATABASE_TYPE = 'sqlite'
DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'ves_hrms.db')
CHECKINOUT_DB_PATH = os.path.join(os.path.dirname(__file__), 'CheckInOut_DB.db')

# PRODUCTION (SQL Server) - Uncomment below and comment SQLite above
# DATABASE_TYPE = 'sqlserver'
# SQLSERVER_CONFIG = {
#     'server': os.environ.get('DB_SERVER', 'localhost'),
#     'database': os.environ.get('DB_NAME', 'VES_HRMS'),
#     'username': os.environ.get('DB_USER', 'ves_hrms_app'),
#     'password': os.environ.get('DB_PASSWORD', ''),
#     'driver': 'ODBC Driver 17 for SQL Server'
# }
# 
# CHECKINOUT_CONFIG = {
#     'server': os.environ.get('DB_SERVER', 'localhost'),
#     'database': 'CheckInOut_DB',  # Separate database for punch data
#     'username': os.environ.get('DB_USER', 'ves_hrms_app'),
#     'password': os.environ.get('DB_PASSWORD', ''),
#     'driver': 'ODBC Driver 17 for SQL Server'
# }
# ============================================================

# Create uploads directory
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# ============== COMPREHENSIVE FILE LOGGING SYSTEM ==============
# All logs saved to files for debugging and compliance

# Create logs directory
LOGS_DIR = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(LOGS_DIR, exist_ok=True)

# Simple file logging - writes to single log file
LOG_FILE = os.path.join(LOGS_DIR, 'app.log')

# Simple formatter
log_formatter = logging.Formatter(
    '%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Single file handler - simple append mode
file_handler = logging.FileHandler(LOG_FILE, mode='a', encoding='utf-8')
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(log_formatter)

# Console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(log_formatter)

# Main logger
logger = logging.getLogger('ves_hrms')
logger.setLevel(logging.INFO)
logger.addHandler(file_handler)
logger.addHandler(console_handler)

# Reuse same logger for all purposes (simple approach)
security_logger = logger
db_logger = logger
access_logger = logger

# Helper function to get client IP
def get_client_ip():
    """Get real client IP even behind proxy"""
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    elif request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP')
    return request.remote_addr or 'unknown'

# Helper function to get user agent
def get_user_agent():
    """Get browser/client user agent"""
    return request.headers.get('User-Agent', 'unknown')[:200]

# Simple request logging (no complex middleware)
@app.after_request
def log_request_end(response):
    """Log request completion"""
    if response.status_code >= 400:
        logger.warning(f"HTTP {response.status_code}: {request.method} {request.path}")
    return response

# Simple log helper functions
def log_info(message):
    """Log info message"""
    logger.info(message)

def log_error(message):
    """Log error message"""
    logger.error(message)

def log_security(action, user=None, details=None):
    """Log security events"""
    security_logger.info(action, extra={
        'user': user or '-',
        'ip': get_client_ip() if request else '-',
        'endpoint': str(details) if details else '-'
    })

def log_db(operation, table=None, details=None):
    """Log database operations"""
    db_logger.debug(f"{operation} on {table}: {details}")

logger.info("=== VES HRMS Server Starting ===", extra={'user': 'SYSTEM', 'ip': 'localhost', 'endpoint': 'startup'})
logger.info(f"Logs directory: {LOGS_DIR}", extra={'user': 'SYSTEM', 'ip': 'localhost', 'endpoint': 'startup'})

# JWT blacklist (in production, use Redis)
blacklisted_tokens = set()

# Clear all active sessions on server startup to prevent "already logged in" errors
def clear_all_sessions_on_startup():
    """Clear all active_session_id on server restart"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET active_session_id = NULL WHERE role IN ('HR', 'Admin', 'MD')")
        cleared_count = cursor.rowcount
        conn.commit()
        conn.close()
        logger.info(f"✅ Cleared {cleared_count} active sessions on startup")
    except Exception as e:
        logger.error(f"Failed to clear sessions on startup: {e}")

# Call on startup
clear_all_sessions_on_startup()

@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload):
    """Check if token is in blocklist - called automatically by Flask-JWT-Extended"""
    # Check both JTI (for normal logout) and session_id (for force logout)
    jti_blacklisted = jwt_payload['jti'] in blacklisted_tokens
    session_id = jwt_payload.get('session_id')
    session_id_blacklisted = session_id in blacklisted_tokens if session_id else False
    
    # Debug logging - THIS SHOULD APPEAR ON EVERY API CALL
    is_revoked = jti_blacklisted or session_id_blacklisted
    logger.warning(f"🔍 BLOCKLIST CHECK - Session: {session_id}, In blacklist: {session_id_blacklisted}, Result: {'REVOKED' if is_revoked else 'ALLOWED'}")
    
    return is_revoked

# JWT Error Handlers - Return 401 instead of 422 for authentication issues
@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({'error': 'Token has expired', 'expired': True}), 401

@jwt.invalid_token_loader
def invalid_token_callback(error):
    return jsonify({'error': 'Invalid token', 'invalid': True}), 401

@jwt.unauthorized_loader
def missing_token_callback(error):
    return jsonify({'error': 'Authorization token is missing', 'missing': True}), 401

@jwt.revoked_token_loader
def revoked_token_callback(jwt_header, jwt_payload):
    return jsonify({'error': 'Token has been revoked. Please login again.', 'revoked': True}), 401

# ============================================================
# DATABASE CONNECTION FUNCTION
# ============================================================
# This function handles both SQLite (dev) and SQL Server (production)
# 
# FOR PRODUCTION: Replace this entire function with the SQL Server version below
# ============================================================

def get_db_connection():
    """
    Get database connection to main VES_HRMS database
    
    DEVELOPMENT (SQLite) - Currently Active
    Returns SQLite connection with row_factory for dict-like access
    """
    try:
        connection = sqlite3.connect(DATABASE_PATH)
        connection.row_factory = sqlite3.Row  # Enable dict-like access
        log_db('CONNECT', 'database', 'SQLite connection established')
        return connection
    except sqlite3.Error as err:
        logger.error(f"Database connection error: {err}", extra={'user': '-', 'ip': '-', 'endpoint': 'db_connect'})
        return None

def get_checkinout_db_connection():
    """
    Get database connection to separate CheckInOut_DB database
    Used for punch/attendance data from Punch Tym Excel
    
    DEVELOPMENT (SQLite) - Currently Active
    Returns SQLite connection with row_factory for dict-like access
    """
    try:
        connection = sqlite3.connect(CHECKINOUT_DB_PATH)
        connection.row_factory = sqlite3.Row  # Enable dict-like access
        log_db('CONNECT', 'checkinout_db', 'CheckInOut_DB connection established')
        return connection
    except sqlite3.Error as err:
        logger.error(f"CheckInOut_DB connection error: {err}", extra={'user': '-', 'ip': '-', 'endpoint': 'checkinout_db_connect'})
        return None

# ============================================================
# PRODUCTION SQL SERVER VERSION - Uncomment below and comment SQLite above
# ============================================================
# def get_db_connection():
#     """
#     Get SQL Server database connection
#     
#     PRODUCTION (SQL Server) - For client deployment with SSMS
#     Returns pyodbc connection
#     """
#     try:
#         conn_str = (
#             f"DRIVER={{{SQLSERVER_CONFIG['driver']}}};"
#             f"SERVER={SQLSERVER_CONFIG['server']};"
#             f"DATABASE={SQLSERVER_CONFIG['database']};"
#             f"UID={SQLSERVER_CONFIG['username']};"
#             f"PWD={SQLSERVER_CONFIG['password']};"
#             "TrustServerCertificate=yes;"
#         )
#         connection = pyodbc.connect(conn_str)
#         log_db('CONNECT', 'database', 'SQL Server connection established')
#         return connection
#     except pyodbc.Error as err:
#         logger.error(f"Database connection error: {err}", extra={'user': '-', 'ip': '-', 'endpoint': 'db_connect'})
#         return None
#
# # Helper class to make SQL Server results dict-like (similar to sqlite3.Row)
# class DictRow:
#     """Makes pyodbc row accessible like a dictionary"""
#     def __init__(self, cursor, row):
#         self._data = {}
#         for idx, column in enumerate(cursor.description):
#             self._data[column[0]] = row[idx]
#     
#     def __getitem__(self, key):
#         return self._data[key]
#     
#     def keys(self):
#         return self._data.keys()
#     
#     def values(self):
#         return self._data.values()
#     
#     def items(self):
#         return self._data.items()
# ============================================================

def get_system_setting(key, default=None):
    """Get a system setting from the database"""
    try:
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute("SELECT setting_value FROM system_settings WHERE setting_key = ?", (key,))
            result = cursor.fetchone()
            conn.close()
            return result['setting_value'] if result else default
    except Exception as e:
        logger.error(f"Error getting setting {key}: {e}")
    return default

def get_email_config():
    """Get email configuration from database"""
    return {
        'SMTP_SERVER': get_system_setting('smtp_server', 'smtp.gmail.com'),
        'SMTP_PORT': int(get_system_setting('smtp_port', '587')),
        'SMTP_EMAIL': get_system_setting('smtp_email', ''),
        'SMTP_PASSWORD': get_system_setting('smtp_password', ''),
        'COMPANY_NAME': get_system_setting('company_name', 'VES HRMS'),
        'FRONTEND_URL': get_system_setting('frontend_url', 'http://localhost:3000')
    }

def audit_log(action, user_id=None, details=None):
    """Log user actions for security audit - saves to DB and security log file"""
    try:
        # Get IP and user agent
        ip_address = get_client_ip() if request else 'system'
        user_agent = get_user_agent() if request else 'system'
        
        # Save to database with IP and user agent
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO audit_logs (user_id, action, details, ip_address, user_agent, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, action, str(details), ip_address, user_agent, datetime.now().isoformat())
            )
            conn.commit()
            conn.close()
            log_db('INSERT', 'audit_logs', f"action={action}, user={user_id}")
        
        # Also write to security log file
        log_security(action, user_id, details)
        
    except Exception as e:
        logger.error(f"Audit log error: {e}", extra={'user': user_id or '-', 'ip': '-', 'endpoint': action})

# ============== EMAIL FUNCTIONS ==============

def send_email(to_email, subject, html_content):
    """Send email using SMTP - config loaded from database"""
    try:
        config = get_email_config()
        
        if not config['SMTP_EMAIL'] or not config['SMTP_PASSWORD']:
            logger.warning(f"Email not configured. Would send to {to_email}: {subject}")
            # For development, just log the email
            print(f"\n📧 EMAIL (not sent - SMTP not configured):")
            print(f"   To: {to_email}")
            print(f"   Subject: {subject}")
            print(f"   Body: {html_content[:200]}...")
            return True  # Return True for dev testing
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{config['COMPANY_NAME']} <{config['SMTP_EMAIL']}>"
        msg['To'] = to_email
        
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)
        
        with smtplib.SMTP(config['SMTP_SERVER'], config['SMTP_PORT']) as server:
            server.starttls()
            server.login(config['SMTP_EMAIL'], config['SMTP_PASSWORD'])
            server.sendmail(config['SMTP_EMAIL'], to_email, msg.as_string())
        
        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return False

def send_welcome_email(employee_email, employee_name, username, temp_password):
    """Send welcome email with login credentials to new employee"""
    config = get_email_config()
    frontend_url = config['FRONTEND_URL']
    company_name = config['COMPANY_NAME']
    
    subject = f"Welcome to {company_name} HRMS - Your Login Credentials"
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px; padding: 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #A020F0;">{company_name}</h1>
                <p style="color: #666;">HR Management System</p>
            </div>
            
            <h2 style="color: #333;">Welcome, {employee_name}! 🎉</h2>
            
            <p>Your HRMS account has been created. Here are your login credentials:</p>
            
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>🔗 Login URL:</strong> <a href="{frontend_url}">{frontend_url}</a></p>
                <p><strong>👤 Username:</strong> <code style="background: #e0e0e0; padding: 3px 8px; border-radius: 4px;">{username}</code></p>
                <p><strong>🔑 Temporary Password:</strong> <code style="background: #e0e0e0; padding: 3px 8px; border-radius: 4px;">{temp_password}</code></p>
            </div>
            
            <p style="color: #d32f2f; font-weight: bold;">⚠️ Important: You will be asked to change your password on first login.</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #888; font-size: 12px;">
                This is an automated message from {company_name} HRMS. Please do not reply to this email.
                If you did not expect this email, please contact HR immediately.
            </p>
        </div>
    </body>
    </html>
    """
    return send_email(employee_email, subject, html_content)

def send_password_reset_email(employee_email, employee_name, username, new_password):
    """Send password reset email with new credentials"""
    config = get_email_config()
    company_name = config['COMPANY_NAME']
    
    subject = f"{company_name} HRMS - Password Reset Successful"
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px; padding: 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #A020F0;">{company_name}</h1>
                <p style="color: #666;">Password Reset</p>
            </div>
            
            <h2 style="color: #333;">Hello, {employee_name}</h2>
            
            <p>Your password has been reset successfully. Here are your new login credentials:</p>
            
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>👤 Username:</strong> <code style="background: #e0e0e0; padding: 3px 8px; border-radius: 4px;">{username}</code></p>
                <p><strong>🔑 New Password:</strong> <code style="background: #e0e0e0; padding: 3px 8px; border-radius: 4px;">{new_password}</code></p>
            </div>
            
            <p style="color: #d32f2f; font-weight: bold;">⚠️ Please change your password after logging in.</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #888; font-size: 12px;">
                If you did not request this password reset, please contact HR immediately.
            </p>
        </div>
    </body>
    </html>
    """
    return send_email(employee_email, subject, html_content)

def send_password_reset_link_email(employee_email, employee_name, reset_token):
    """Send password reset link email"""
    config = get_email_config()
    frontend_url = config['FRONTEND_URL']
    company_name = config['COMPANY_NAME']
    
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    subject = f"{company_name} HRMS - Password Reset Request"
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px; padding: 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #A020F0;">{company_name}</h1>
                <p style="color: #666;">Password Reset Request</p>
            </div>
            
            <h2 style="color: #333;">Hello, {employee_name}</h2>
            
            <p>We received a request to reset your password for your {company_name} HRMS account.</p>
            
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_link}" style="background: linear-gradient(to right, #A020F0, #4169E1); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                    Reset Password
                </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Or copy and paste this link in your browser:</p>
            <p style="background: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px;">{reset_link}</p>
            
            <p style="color: #d32f2f; font-weight: bold;">⚠️ This link will expire in 1 hour.</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #888; font-size: 12px;">
                If you did not request this password reset, please ignore this email or contact HR if you have concerns.
            </p>
        </div>
    </body>
    </html>
    """
    return send_email(employee_email, subject, html_content)

def generate_temp_password(length=8):
    """Generate a temporary password"""
    return secrets.token_urlsafe(length)[:length]

def role_required(*allowed_roles):
    """Decorator to check user role permissions"""
    def decorator(f):
        @wraps(f)
        @jwt_required()
        def decorated_function(*args, **kwargs):
            current_user = get_jwt_identity()
            
            # Get user role from database
            conn = get_db_connection()
            if not conn:
                return jsonify({'error': 'Database connection failed'}), 500
            
            cursor = conn.cursor()
            cursor.execute("SELECT role FROM users WHERE username = ? AND is_active = 1", (current_user,))
            user = cursor.fetchone()
            conn.close()
            
            if not user or user['role'] not in allowed_roles:
                audit_log('UNAUTHORIZED_ACCESS_ATTEMPT', current_user, {'endpoint': request.endpoint, 'required_roles': allowed_roles})
                return jsonify({'error': 'Insufficient permissions'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Authentication Routes
@app.route('/api/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    """Authenticate user and return JWT token"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        force_login = data.get('force_login', False)  # Allow force logout from other device
        
        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        # Support login by username OR email
        cursor.execute(
            "SELECT employee_id, username, full_name, password_hash, role, email, is_active, account_status, active_session_id FROM users WHERE (username = ? OR email = ?)",
            (username, username)
        )
        user = cursor.fetchone()
        
        # Debug logging
        logger.info(f"Login attempt for username: {username}, User found: {user is not None}")
        
        if not user:
            conn.close()
            audit_log('LOGIN_FAILED', username, {'reason': 'User not found'})
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Check account status (Active/Inactive/Blocked)
        account_status = user['account_status'] if 'account_status' in user.keys() else 'Active'
        if not user['is_active'] or account_status == 'Inactive':
            conn.close()
            audit_log('LOGIN_FAILED', username, {'reason': 'Account inactive'})
            return jsonify({'error': 'Account is inactive. Please contact HR.'}), 401
        
        if account_status == 'Blocked':
            conn.close()
            audit_log('LOGIN_FAILED', username, {'reason': 'Account blocked'})
            return jsonify({'error': 'Account is blocked. Please contact administrator.'}), 401
        
        if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            conn.close()
            audit_log('LOGIN_FAILED', username, {'reason': 'Invalid password'})
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Check for active session on another device (for HR, Admin, MD roles)
        active_session = user['active_session_id'] if 'active_session_id' in user.keys() else None
        
        # Debug logging
        logger.info(f"Login check - Role: {user['role']}, Active Session: {active_session}, Force Login: {force_login}")
        
        # Only check for multiple logins if there's an active session AND it's not a force login
        # The active_session stores a session_id (UUID), if it exists and not blacklisted, another device is using it
        if user['role'] in ('HR', 'Admin', 'MD') and active_session and not force_login:
            # Check if the active session is still valid (not blacklisted)
            logger.info(f"Checking if session {active_session} is in blacklist: {active_session in blacklisted_tokens}")
            if active_session not in blacklisted_tokens:
                conn.close()
                audit_log('LOGIN_BLOCKED', username, {'reason': 'Already logged in on another device'})
                logger.warning(f"LOGIN BLOCKED for {username} - Already logged in with session {active_session}")
                return jsonify({
                    'error': 'This account is already logged in on another device.',
                    'already_logged_in': True,
                    'message': 'Do you want to logout from the other device and login here?'
                }), 409  # Conflict status code
        
        # Generate unique session ID
        import uuid
        session_id = str(uuid.uuid4())
        
        # If force login for HR/Admin/MD, blacklist the old session
        if user['role'] in ('HR', 'Admin', 'MD') and active_session and force_login:
            blacklisted_tokens.add(active_session)
            audit_log('FORCE_LOGOUT', username, {'reason': 'Logged in from new device'})
            logger.warning(f"🔴 BLACKLISTED SESSION: {active_session} for user {username}")
            logger.warning(f"🔴 Total blacklisted tokens: {len(blacklisted_tokens)}")
            logger.info(f"Force logout - Blacklisted session: {active_session}, New session: {session_id}")
        
        # Update active session in database ONLY for HR/Admin/MD
        # Employees don't have session tracking - they can login from multiple devices
        if user['role'] in ('HR', 'Admin', 'MD'):
            cursor.execute(
                "UPDATE users SET active_session_id = ? WHERE username = ?",
                (session_id, user['username'])
            )
            conn.commit()
            logger.info(f"Updated active_session_id to {session_id} for user {username}")
        else:
            logger.info(f"Employee login - No session tracking (multi-device allowed) for {username}")
        
        conn.close()
        
        # Create JWT access token (3 hours) with user info
        access_token = create_access_token(
            identity=user['username'],
            additional_claims={
                'role': user['role'],
                'name': user['full_name'],
                'email': user['email'],
                'employee_id': user['employee_id'],
                'session_id': session_id
            }
        )
        
        # Create refresh token (7 days) for token renewal
        refresh_token = create_refresh_token(
            identity=user['username'],
            additional_claims={
                'role': user['role'],
                'employee_id': user['employee_id'],
                'session_id': session_id
            }
        )
        
        audit_log('LOGIN_SUCCESS', user['username'])
        
        return jsonify({
            'token': access_token,
            'refresh_token': refresh_token,
            'expires_in': 10800,  # 3 hours in seconds
            'user': {
                'employee_id': user['employee_id'],
                'username': user['username'],
                'name': user['full_name'],
                'role': user['role'],
                'email': user['email']
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'error': 'Login failed'}), 500

@app.route('/api/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logout user and blacklist token"""
    try:
        jti = get_jwt()['jti']
        blacklisted_tokens.add(jti)
        
        user_id = get_jwt_identity()
        jwt_data = get_jwt()
        
        # Clear active session from database for HR/Admin/MD
        if jwt_data.get('role') in ('HR', 'Admin', 'MD'):
            conn = get_db_connection()
            if conn:
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE users SET active_session_id = NULL WHERE username = ?",
                    (user_id,)
                )
                conn.commit()
                conn.close()
        
        audit_log('LOGOUT', user_id)
        
        return jsonify({'message': 'Successfully logged out'}), 200
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return jsonify({'error': 'Logout failed'}), 500

@app.route('/api/token/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh_token():
    """Refresh access token using refresh token"""
    try:
        current_user = get_jwt_identity()
        current_jwt = get_jwt()
        
        # Get fresh user data from database
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        cursor.execute(
            "SELECT employee_id, username, full_name, role, email, is_active, account_status FROM users WHERE username = ?",
            (current_user,)
        )
        user = cursor.fetchone()
        conn.close()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Verify account is still active
        account_status = user['account_status'] if 'account_status' in user.keys() else 'Active'
        if not user['is_active'] or account_status in ('Inactive', 'Blocked'):
            return jsonify({'error': 'Account is no longer active'}), 401
        
        # Generate new access token
        new_access_token = create_access_token(
            identity=current_user,
            additional_claims={
                'role': user['role'],
                'name': user['full_name'],
                'email': user['email'],
                'employee_id': user['employee_id']
            }
        )
        
        audit_log('TOKEN_REFRESH', current_user)
        
        return jsonify({
            'token': new_access_token,
            'expires_in': 10800  # 3 hours in seconds
        }), 200
        
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        return jsonify({'error': 'Token refresh failed'}), 500

@app.route('/api/auth/validate', methods=['GET'])
@jwt_required()
def validate_token():
    """Validate current token and return user info"""
    try:
        current_user = get_jwt_identity()
        jwt_claims = get_jwt()
        
        return jsonify({
            'valid': True,
            'user': {
                'username': current_user,
                'role': jwt_claims.get('role'),
                'name': jwt_claims.get('name'),
                'email': jwt_claims.get('email'),
                'employee_id': jwt_claims.get('employee_id')
            }
        }), 200
    except Exception as e:
        return jsonify({'valid': False, 'error': str(e)}), 401

# Password Reset Routes
@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    """Send password reset email to user"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Find user by email
        cursor.execute(
            "SELECT id, username, full_name, email, account_status FROM users WHERE LOWER(email) = ?",
            (email,)
        )
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            # Don't reveal if email exists - always return success message
            return jsonify({
                'message': 'If an account with that email exists, you will receive a password reset link shortly.'
            }), 200
        
        # Check if account is blocked
        if user['account_status'] == 'Blocked':
            conn.close()
            return jsonify({'error': 'This account has been blocked. Please contact HR.'}), 403
        
        # Generate reset token (32 characters)
        reset_token = secrets.token_urlsafe(32)
        
        # Set token expiry to 1 hour from now
        expiry_time = datetime.datetime.now() + datetime.timedelta(hours=1)
        
        # Store reset token in database
        cursor.execute(
            """UPDATE users 
               SET password_reset_token = ?, reset_token_expiry = ? 
               WHERE id = ?""",
            (reset_token, expiry_time.isoformat(), user['id'])
        )
        conn.commit()
        conn.close()
        
        # Send password reset email
        try:
            send_password_reset_link_email(
                employee_email=user['email'],
                employee_name=user['full_name'],
                reset_token=reset_token
            )
            audit_log('PASSWORD_RESET_REQUESTED', user['username'], {'email': email})
        except Exception as email_error:
            logger.error(f"Failed to send reset email: {email_error}")
            # Still return success to not reveal if email exists
        
        return jsonify({
            'message': 'If an account with that email exists, you will receive a password reset link shortly.'
        }), 200
        
    except Exception as e:
        logger.error(f"Forgot password error: {e}")
        return jsonify({'error': 'Failed to process request'}), 500


@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    """Reset password using reset token"""
    try:
        data = request.get_json()
        token = data.get('token', '').strip()
        new_password = data.get('new_password', '')
        
        if not token:
            return jsonify({'error': 'Reset token is required'}), 400
        
        if not new_password or len(new_password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Find user with this reset token
        cursor.execute(
            """SELECT id, username, full_name, password_reset_token, reset_token_expiry 
               FROM users WHERE password_reset_token = ?""",
            (token,)
        )
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'Invalid or expired reset token'}), 400
        
        # Check if token has expired
        if user['reset_token_expiry']:
            expiry_time = datetime.datetime.fromisoformat(user['reset_token_expiry'])
            if datetime.datetime.now() > expiry_time:
                # Clear expired token
                cursor.execute(
                    "UPDATE users SET password_reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
                    (user['id'],)
                )
                conn.commit()
                conn.close()
                return jsonify({'error': 'Reset token has expired. Please request a new one.'}), 400
        
        # Hash new password and update
        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        
        cursor.execute(
            """UPDATE users 
               SET password_hash = ?, 
                   password_reset_token = NULL, 
                   reset_token_expiry = NULL,
                   must_change_password = 0
               WHERE id = ?""",
            (hashed_password.decode('utf-8'), user['id'])
        )
        conn.commit()
        conn.close()
        
        audit_log('PASSWORD_RESET_COMPLETED', user['username'])
        
        return jsonify({
            'message': 'Password has been reset successfully. You can now login with your new password.'
        }), 200
        
    except Exception as e:
        logger.error(f"Reset password error: {e}")
        return jsonify({'error': 'Failed to reset password'}), 500


@app.route('/api/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """Change password for logged-in user (used for first-time login)"""
    try:
        username = get_jwt_identity()
        data = request.get_json()
        
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')
        
        if not current_password or not new_password:
            return jsonify({'error': 'Current and new password are required'}), 400
        
        if len(new_password) < 6:
            return jsonify({'error': 'New password must be at least 6 characters'}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get user
        cursor.execute(
            "SELECT id, password_hash FROM users WHERE username = ?",
            (username,)
        )
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        # Verify current password
        if not bcrypt.checkpw(current_password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            conn.close()
            return jsonify({'error': 'Current password is incorrect'}), 401
        
        # Hash and update new password
        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        
        cursor.execute(
            """UPDATE users 
               SET password_hash = ?, must_change_password = 0 
               WHERE id = ?""",
            (hashed_password.decode('utf-8'), user['id'])
        )
        conn.commit()
        conn.close()
        
        audit_log('PASSWORD_CHANGED', username)
        
        return jsonify({
            'message': 'Password changed successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Change password error: {e}")
        return jsonify({'error': 'Failed to change password'}), 500


@app.route('/api/resend-credentials', methods=['POST'])
@jwt_required()
def resend_credentials():
    """HR can resend credentials to an employee via email"""
    try:
        current_user = get_jwt_identity()
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        # Only HR, Admin, MD can resend credentials
        if user_role not in ('HR', 'Admin', 'MD'):
            return jsonify({'error': 'Unauthorized - HR access required'}), 403
        
        data = request.get_json()
        employee_id = data.get('employee_id')
        
        if not employee_id:
            return jsonify({'error': 'Employee ID is required'}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get employee details
        cursor.execute(
            "SELECT id, username, full_name, email, account_status FROM users WHERE employee_id = ?",
            (employee_id,)
        )
        employee = cursor.fetchone()
        
        if not employee:
            conn.close()
            return jsonify({'error': 'Employee not found'}), 404
        
        if not employee['email']:
            conn.close()
            return jsonify({'error': 'Employee does not have an email address'}), 400
        
        # Generate new temporary password
        temp_password = generate_temp_password()
        hashed_password = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt())
        
        # Update password and set must_change_password flag
        cursor.execute(
            """UPDATE users 
               SET password_hash = ?, must_change_password = 1 
               WHERE id = ?""",
            (hashed_password.decode('utf-8'), employee['id'])
        )
        conn.commit()
        conn.close()
        
        # Send welcome email with new credentials
        try:
            send_welcome_email(
                employee_name=employee['full_name'],
                email=employee['email'],
                username=employee['username'],
                temp_password=temp_password
            )
            audit_log('CREDENTIALS_RESENT', current_user, {
                'target_employee': employee_id,
                'target_username': employee['username']
            })
            
            return jsonify({
                'message': f"Credentials sent successfully to {employee['email']}"
            }), 200
            
        except Exception as email_error:
            logger.error(f"Failed to send credentials email: {email_error}")
            return jsonify({'error': 'Failed to send email. Please try again.'}), 500
        
    except Exception as e:
        logger.error(f"Resend credentials error: {e}")
        return jsonify({'error': 'Failed to resend credentials'}), 500


# Personal Employee Routes
@app.route('/api/attendance/personal', methods=['GET'])
@jwt_required()
def get_personal_attendance():
    """Get employee's personal attendance records"""
    try:
        username = get_jwt_identity()
        days = request.args.get('days', 30, type=int)
        
        # Get employee_id from username
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        cursor.execute("SELECT employee_id FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        employee_id = user['employee_id']
        
        cursor.execute("""
            SELECT date, clock_in, clock_out, status, hours_worked, notes
            FROM attendance 
            WHERE employee_id = ? AND date >= date('now', '-' || ? || ' days')
            ORDER BY date DESC
        """, (employee_id, days))
        
        records = cursor.fetchall()
        conn.close()
        
        # Convert sqlite3.Row objects to dictionaries
        records = [dict(record) for record in records]
        
        return jsonify({'attendance': records}), 200
        
    except Exception as e:
        logger.error(f"Personal attendance error: {e}")
        return jsonify({'error': 'Failed to fetch attendance'}), 500

# Office timing configuration
OFFICE_START_TIME = "09:00"  # 9:00 AM
OFFICE_END_TIME = "18:00"    # 6:00 PM
LATE_THRESHOLD_MINUTES = 15  # Late if check-in after 9:15 AM
EARLY_THRESHOLD_MINUTES = 30 # Early leave if checkout before 5:30 PM

@app.route('/api/attendance/check-in', methods=['POST'])
@jwt_required()
def check_in():
    """Record employee check-in with late detection"""
    try:
        username = get_jwt_identity()
        now = datetime.now()
        today = now.strftime('%Y-%m-%d')
        current_time = now.strftime('%H:%M:%S')
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get employee_id
        cursor.execute("SELECT employee_id, full_name FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        employee_id = user['employee_id']
        
        # Check if already checked in today
        cursor.execute(
            "SELECT id, clock_in FROM attendance WHERE employee_id = ? AND date = ?",
            (employee_id, today)
        )
        existing = cursor.fetchone()
        
        if existing and existing['clock_in']:
            conn.close()
            return jsonify({
                'error': 'Already checked in today',
                'check_in_time': existing['clock_in']
            }), 409
        
        # Determine if late
        office_start = datetime.strptime(f"{today} {OFFICE_START_TIME}", '%Y-%m-%d %H:%M')
        late_threshold = office_start + timedelta(minutes=LATE_THRESHOLD_MINUTES)
        is_late = now > late_threshold
        late_by_minutes = int((now - office_start).total_seconds() / 60) if is_late else 0
        
        status = 'Present'
        notes = f"Late by {late_by_minutes} minutes" if is_late else "On time"
        
        if existing:
            # Update existing record
            cursor.execute("""
                UPDATE attendance SET clock_in = ?, status = ?, notes = ?, updated_at = ?
                WHERE employee_id = ? AND date = ?
            """, (current_time, status, notes, now.isoformat(), employee_id, today))
        else:
            # Insert new record
            cursor.execute("""
                INSERT INTO attendance (employee_id, date, clock_in, status, notes)
                VALUES (?, ?, ?, ?, ?)
            """, (employee_id, today, current_time, status, notes))
        
        conn.commit()
        
        # Auto-generate meal token for eligible employees
        meal_token_generated = False
        meal_token_info = None
        
        try:
            # Check if employee is eligible for meal tokens
            cursor.execute("""
                SELECT employee_category, shift, full_name 
                FROM users WHERE username = ?
            """, (username,))
            user_info = cursor.fetchone()
            
            if user_info and user_info['employee_category'] in ('W001', 'M001'):
                shift = user_info['shift'] or 1
                meal_type_map = {1: 'Lunch', 2: 'Dinner', 3: 'Breakfast'}
                meal_type = meal_type_map.get(shift, 'Lunch')
                
                # Check if token already exists for today
                cursor.execute("""
                    SELECT id FROM meal_tokens 
                    WHERE employee_id = ? AND token_date = ?
                """, (employee_id, today))
                existing_token = cursor.fetchone()
                
                if not existing_token:
                    # Generate token automatically
                    token_id = f"MTK-{today.replace('-', '')}-{employee_id}"
                    cursor.execute("""
                        INSERT INTO meal_tokens (employee_id, token_date, shift, meal_type, status, generated_at)
                        VALUES (?, ?, ?, ?, 'Issued', datetime('now'))
                    """, (employee_id, today, shift, meal_type))
                    conn.commit()
                    meal_token_generated = True
                    meal_token_info = {
                        'token_id': token_id,
                        'meal_type': meal_type,
                        'shift': shift
                    }
                    logger.info(f"Auto-generated meal token for {employee_id}")
        except Exception as token_error:
            logger.warning(f"Failed to auto-generate meal token: {token_error}")
        
        conn.close()
        
        audit_log('CHECK_IN', username, {'time': current_time, 'is_late': is_late})
        
        response_data = {
            'message': 'Check-in successful',
            'check_in_time': current_time,
            'is_late': is_late,
            'late_by_minutes': late_by_minutes,
            'notes': notes
        }
        
        if meal_token_generated:
            response_data['meal_token'] = meal_token_info
            response_data['message'] += ' - Meal token generated!'
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Check-in error: {e}")
        return jsonify({'error': 'Check-in failed'}), 500

@app.route('/api/attendance/check-out', methods=['POST'])
@jwt_required()
def check_out():
    """Record employee check-out with early leave detection and hours calculation"""
    try:
        username = get_jwt_identity()
        now = datetime.now()
        today = now.strftime('%Y-%m-%d')
        current_time = now.strftime('%H:%M:%S')
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get employee_id
        cursor.execute("SELECT employee_id FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        employee_id = user['employee_id']
        
        # Check if checked in today
        cursor.execute(
            "SELECT id, clock_in, clock_out FROM attendance WHERE employee_id = ? AND date = ?",
            (employee_id, today)
        )
        existing = cursor.fetchone()
        
        if not existing or not existing['clock_in']:
            conn.close()
            return jsonify({'error': 'No check-in record found for today'}), 400
        
        if existing['clock_out']:
            conn.close()
            return jsonify({
                'error': 'Already checked out today',
                'check_out_time': existing['clock_out']
            }), 409
        
        # Calculate hours worked
        check_in_time = datetime.strptime(f"{today} {existing['clock_in']}", '%Y-%m-%d %H:%M:%S')
        hours_worked = round((now - check_in_time).total_seconds() / 3600, 2)
        
        # Determine if early leave
        office_end = datetime.strptime(f"{today} {OFFICE_END_TIME}", '%Y-%m-%d %H:%M')
        early_threshold = office_end - timedelta(minutes=EARLY_THRESHOLD_MINUTES)
        is_early = now < early_threshold
        early_by_minutes = int((office_end - now).total_seconds() / 60) if is_early else 0
        
        # Update notes
        cursor.execute("SELECT notes FROM attendance WHERE id = ?", (existing['id'],))
        current_record = cursor.fetchone()
        existing_notes = current_record['notes'] if current_record else ''
        
        if is_early:
            notes = f"{existing_notes} | Early leave by {early_by_minutes} minutes"
        else:
            notes = f"{existing_notes} | Regular checkout"
        
        # Determine final status based on hours
        status = 'Present' if hours_worked >= 4 else 'Half-Day'
        
        cursor.execute("""
            UPDATE attendance SET clock_out = ?, hours_worked = ?, status = ?, notes = ?, updated_at = ?
            WHERE id = ?
        """, (current_time, hours_worked, status, notes, now.isoformat(), existing['id']))
        
        conn.commit()
        conn.close()
        
        audit_log('CHECK_OUT', username, {'time': current_time, 'hours': hours_worked, 'is_early': is_early})
        
        return jsonify({
            'message': 'Check-out successful',
            'check_out_time': current_time,
            'hours_worked': hours_worked,
            'is_early': is_early,
            'early_by_minutes': early_by_minutes,
            'status': status
        }), 200
        
    except Exception as e:
        logger.error(f"Check-out error: {e}")
        return jsonify({'error': 'Check-out failed'}), 500

@app.route('/api/attendance/today', methods=['GET'])
@jwt_required()
def get_today_attendance():
    """Get today's attendance status for current user"""
    try:
        username = get_jwt_identity()
        today = datetime.now().strftime('%Y-%m-%d')
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get employee_id
        cursor.execute("SELECT employee_id FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        employee_id = user['employee_id']
        
        # Get today's record
        cursor.execute("""
            SELECT date, clock_in, clock_out, status, hours_worked, notes
            FROM attendance WHERE employee_id = ? AND date = ?
        """, (employee_id, today))
        
        record = cursor.fetchone()
        conn.close()
        
        if record:
            return jsonify({
                'has_record': True,
                'date': record['date'],
                'clock_in': record['clock_in'],
                'clock_out': record['clock_out'],
                'status': record['status'],
                'hours_worked': record['hours_worked'],
                'notes': record['notes']
            }), 200
        else:
            return jsonify({
                'has_record': False,
                'date': today,
                'clock_in': None,
                'clock_out': None,
                'status': None
            }), 200
        
    except Exception as e:
        logger.error(f"Today attendance error: {e}")
        return jsonify({'error': 'Failed to fetch today attendance'}), 500

@app.route('/api/attendance/summary', methods=['GET'])
@jwt_required()
def get_attendance_summary():
    """Get attendance summary with statistics for pie chart"""
    try:
        username = get_jwt_identity()
        month = request.args.get('month', datetime.now().month, type=int)
        year = request.args.get('year', datetime.now().year, type=int)
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get employee_id
        cursor.execute("SELECT employee_id FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        employee_id = user['employee_id']
        
        # Get attendance records for the month
        cursor.execute("""
            SELECT status, COUNT(*) as count
            FROM attendance 
            WHERE employee_id = ? 
              AND strftime('%m', date) = ? 
              AND strftime('%Y', date) = ?
            GROUP BY status
        """, (employee_id, str(month).zfill(2), str(year)))
        
        status_counts = cursor.fetchall()
        
        # Get total hours and late/early stats
        cursor.execute("""
            SELECT 
                SUM(hours_worked) as total_hours,
                COUNT(CASE WHEN notes LIKE '%Late%' THEN 1 END) as late_days,
                COUNT(CASE WHEN notes LIKE '%Early leave%' THEN 1 END) as early_leaves
            FROM attendance 
            WHERE employee_id = ? 
              AND strftime('%m', date) = ? 
              AND strftime('%Y', date) = ?
        """, (employee_id, str(month).zfill(2), str(year)))
        
        stats = cursor.fetchone()
        conn.close()
        
        # Calculate working days in month (excluding weekends)
        import calendar
        cal = calendar.Calendar()
        working_days = sum(1 for day in cal.itermonthdays2(year, month) 
                         if day[0] != 0 and day[1] < 5)  # Mon-Fri
        
        # Build summary
        summary = {
            'present': 0,
            'absent': 0,
            'half_day': 0,
            'leave': 0,
            'overtime': 0
        }
        
        for row in status_counts:
            status_key = row['status'].lower().replace('-', '_') if row['status'] else 'absent'
            if status_key == 'ot':
                status_key = 'overtime'
            if status_key in summary:
                summary[status_key] = row['count']
        
        return jsonify({
            'month': month,
            'year': year,
            'working_days': working_days,
            'summary': summary,
            'total_hours': round(stats['total_hours'] or 0, 2),
            'late_days': stats['late_days'] or 0,
            'early_leaves': stats['early_leaves'] or 0,
            'attendance_rate': round((summary['present'] / working_days * 100) if working_days > 0 else 0, 1)
        }), 200
        
    except Exception as e:
        logger.error(f"Attendance summary error: {e}")
        return jsonify({'error': 'Failed to fetch attendance summary'}), 500

# Leave Management Configuration
LEAVE_TYPES = {
    'CL': {'name': 'Casual Leave', 'max_per_year': 12, 'max_per_month': 12, 'advance_notice_days': 1},
    'SL': {'name': 'Sick Leave', 'max_per_year': 12, 'max_per_month': 12, 'advance_notice_days': 0},
    'EL': {'name': 'Earned Leave', 'max_per_year': 12, 'max_per_month': 12, 'advance_notice_days': 7},
    'Half-Day': {'name': 'Half Day Leave', 'max_per_year': 24, 'max_per_month': 12, 'advance_notice_days': 0},
    'LOP': {'name': 'Loss of Pay', 'max_per_year': 999, 'max_per_month': 30, 'advance_notice_days': 0},
}

@app.route('/api/leaves', methods=['POST'])
@jwt_required()
def submit_leave_request():
    """Submit new leave request with validation rules"""
    try:
        username = get_jwt_identity()
        data = request.get_json()
        
        required_fields = ['start_date', 'end_date', 'leave_type', 'reason']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields: start_date, end_date, leave_type, reason'}), 400
        
        leave_type = data['leave_type']
        if leave_type not in LEAVE_TYPES:
            return jsonify({'error': f'Invalid leave type. Valid types: {", ".join(LEAVE_TYPES.keys())}'}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get user details
        cursor.execute("SELECT employee_id, role, employee_category FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        employee_id = user['employee_id']
        user_role = user['role']
        employee_category = user['employee_category']
        
        # Check if category is eligible for leave
        if employee_category in ('M001', 'T001'):
            conn.close()
            return jsonify({
                'error': 'Employees in your category are not eligible for paid leave',
                'category': employee_category
            }), 403
        
        # Parse dates
        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d')
        end_date = datetime.strptime(data['end_date'], '%Y-%m-%d')
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Validate date range
        if end_date < start_date:
            conn.close()
            return jsonify({'error': 'End date cannot be before start date'}), 400
        
        # Rule: Cannot apply for past dates (except Admin)
        if start_date < today and user_role not in ('Admin', 'MD'):
            conn.close()
            return jsonify({
                'error': 'Cannot apply for past dates. Only Admin can submit backdated leave requests.',
                'start_date': data['start_date'],
                'today': today.strftime('%Y-%m-%d')
            }), 400
        
        # Calculate days requested
        is_half_day = data.get('is_half_day', False)
        half_day_session = data.get('half_day_session', None)
        
        if is_half_day:
            days_requested = 0.5
            if not half_day_session:
                half_day_session = 'First Half'
        else:
            days_requested = (end_date - start_date).days + 1
        
        # Rule: Max leaves per month check
        current_month = start_date.month
        current_year = start_date.year
        leave_config = LEAVE_TYPES[leave_type]
        
        cursor.execute("""
            SELECT COALESCE(SUM(days_requested), 0) as month_leaves
            FROM leave_applications 
            WHERE employee_id = ? 
              AND leave_type = ?
              AND strftime('%m', start_date) = ?
              AND strftime('%Y', start_date) = ?
              AND status != 'Rejected'
              AND status != 'Cancelled'
        """, (employee_id, leave_type, str(current_month).zfill(2), str(current_year)))
        
        month_result = cursor.fetchone()
        month_leaves = month_result['month_leaves'] if month_result else 0
        
        if (month_leaves + days_requested) > leave_config['max_per_month']:
            conn.close()
            return jsonify({
                'error': f'Monthly limit exceeded for {leave_config["name"]}',
                'max_per_month': leave_config['max_per_month'],
                'already_used': month_leaves,
                'requested': days_requested
            }), 400
        
        # Check leave balance
        cursor.execute("""
            SELECT * FROM leave_balances 
            WHERE employee_id = ? AND leave_year = ?
        """, (employee_id, current_year))
        
        balance = cursor.fetchone()
        
        # Initialize balance if not exists
        if not balance:
            cursor.execute("""
                INSERT INTO leave_balances (employee_id, leave_year)
                VALUES (?, ?)
            """, (employee_id, current_year))
            conn.commit()
            cursor.execute("""
                SELECT * FROM leave_balances 
                WHERE employee_id = ? AND leave_year = ?
            """, (employee_id, current_year))
            balance = cursor.fetchone()
        
        # Check available balance based on leave type
        balance_field = {
            'CL': ('casual_leave_total', 'casual_leave_used'),
            'SL': ('sick_leave_total', 'sick_leave_used'),
            'EL': ('earned_leave_total', 'earned_leave_used'),
        }
        
        if leave_type in balance_field:
            total_field, used_field = balance_field[leave_type]
            available = balance[total_field] - balance[used_field]
            
            if days_requested > available:
                conn.close()
                return jsonify({
                    'error': f'Insufficient {leave_config["name"]} balance',
                    'available': available,
                    'requested': days_requested
                }), 400
        
        # Insert leave application
        cursor.execute("""
            INSERT INTO leave_applications 
            (employee_id, leave_type, start_date, end_date, days_requested, is_half_day, half_day_session, reason, applied_on)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            employee_id, leave_type, data['start_date'], data['end_date'], 
            days_requested, 1 if is_half_day else 0, half_day_session,
            data['reason'], datetime.now().isoformat()
        ))
        
        leave_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        audit_log('LEAVE_REQUEST_SUBMITTED', username, {
            'leave_id': leave_id,
            'start_date': data['start_date'],
            'end_date': data['end_date'],
            'leave_type': leave_type,
            'days': days_requested
        })
        
        # TODO: Send email notification to HR
        
        return jsonify({
            'message': 'Leave request submitted successfully',
            'leave_id': leave_id,
            'days_requested': days_requested,
            'leave_type': leave_config['name'],
            'status': 'Pending'
        }), 201
        
    except ValueError as e:
        logger.error(f"Leave date parsing error: {e}")
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    except Exception as e:
        logger.error(f"Leave submission error: {e}")
        return jsonify({'error': 'Failed to submit leave request'}), 500

@app.route('/api/leaves', methods=['GET'])
@jwt_required()
def get_leave_requests():
    """Get leave requests for current user"""
    try:
        username = get_jwt_identity()
        status_filter = request.args.get('status', None)
        year = request.args.get('year', datetime.now().year, type=int)
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get employee_id
        cursor.execute("SELECT employee_id FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        employee_id = user['employee_id']
        
        # Build query
        query = """
            SELECT id, leave_type, start_date, end_date, days_requested, is_half_day, 
                   half_day_session, reason, status, approved_by, approved_on, 
                   rejection_reason, applied_on
            FROM leave_applications 
            WHERE employee_id = ? AND strftime('%Y', start_date) = ?
        """
        params = [employee_id, str(year)]
        
        if status_filter:
            query += " AND status = ?"
            params.append(status_filter)
        
        query += " ORDER BY applied_on DESC"
        
        cursor.execute(query, params)
        leaves = cursor.fetchall()
        conn.close()
        
        # Format response
        leave_list = []
        for leave in leaves:
            leave_list.append({
                'id': leave['id'],
                'leave_type': leave['leave_type'],
                'leave_type_name': LEAVE_TYPES.get(leave['leave_type'], {}).get('name', leave['leave_type']),
                'start_date': leave['start_date'],
                'end_date': leave['end_date'],
                'days_requested': leave['days_requested'],
                'is_half_day': bool(leave['is_half_day']),
                'half_day_session': leave['half_day_session'],
                'reason': leave['reason'],
                'status': leave['status'],
                'approved_by': leave['approved_by'],
                'approved_on': leave['approved_on'],
                'rejection_reason': leave['rejection_reason'],
                'applied_on': leave['applied_on']
            })
        
        return jsonify({'leaves': leave_list}), 200
        
    except Exception as e:
        logger.error(f"Get leaves error: {e}")
        return jsonify({'error': 'Failed to fetch leave requests'}), 500

@app.route('/api/leaves/balance', methods=['GET'])
@jwt_required()
def get_leave_balance():
    """Get leave balance for current user"""
    try:
        username = get_jwt_identity()
        year = request.args.get('year', datetime.now().year, type=int)
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get employee_id and category
        cursor.execute("SELECT employee_id, employee_category FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        employee_id = user['employee_id']
        category = user['employee_category']
        
        # Not eligible categories
        if category in ('M001', 'T001'):
            conn.close()
            return jsonify({
                'eligible': False,
                'category': category,
                'message': 'Not eligible for paid leave'
            }), 200
        
        # Get or create balance
        cursor.execute("""
            SELECT * FROM leave_balances 
            WHERE employee_id = ? AND leave_year = ?
        """, (employee_id, year))
        
        balance = cursor.fetchone()
        
        if not balance:
            cursor.execute("""
                INSERT INTO leave_balances (employee_id, leave_year)
                VALUES (?, ?)
            """, (employee_id, year))
            conn.commit()
            cursor.execute("""
                SELECT * FROM leave_balances 
                WHERE employee_id = ? AND leave_year = ?
            """, (employee_id, year))
            balance = cursor.fetchone()
        
        conn.close()
        
        return jsonify({
            'eligible': True,
            'year': year,
            'balance': {
                'casual_leave': {
                    'code': 'CL',
                    'name': 'Casual Leave',
                    'total': balance['casual_leave_total'],
                    'used': balance['casual_leave_used'],
                    'available': balance['casual_leave_total'] - balance['casual_leave_used']
                },
                'sick_leave': {
                    'code': 'SL',
                    'name': 'Sick Leave',
                    'total': balance['sick_leave_total'],
                    'used': balance['sick_leave_used'],
                    'available': balance['sick_leave_total'] - balance['sick_leave_used']
                },
                'earned_leave': {
                    'code': 'EL',
                    'name': 'Earned Leave',
                    'total': balance['earned_leave_total'],
                    'used': balance['earned_leave_used'],
                    'available': balance['earned_leave_total'] - balance['earned_leave_used']
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get leave balance error: {e}")
        return jsonify({'error': 'Failed to fetch leave balance'}), 500

@app.route('/api/leaves/<int:leave_id>/cancel', methods=['PUT'])
@jwt_required()
def cancel_leave_request(leave_id):
    """Cancel a pending leave request"""
    try:
        username = get_jwt_identity()
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get employee_id
        cursor.execute("SELECT employee_id FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        employee_id = user['employee_id']
        
        # Get leave request
        cursor.execute("""
            SELECT * FROM leave_applications WHERE id = ? AND employee_id = ?
        """, (leave_id, employee_id))
        
        leave = cursor.fetchone()
        
        if not leave:
            conn.close()
            return jsonify({'error': 'Leave request not found'}), 404
        
        if leave['status'] != 'Pending':
            conn.close()
            return jsonify({'error': f'Cannot cancel a {leave["status"].lower()} leave request'}), 400
        
        # Cancel the request
        cursor.execute("""
            UPDATE leave_applications SET status = 'Cancelled', updated_at = ?
            WHERE id = ?
        """, (datetime.now().isoformat(), leave_id))
        
        conn.commit()
        conn.close()
        
        audit_log('LEAVE_REQUEST_CANCELLED', username, {'leave_id': leave_id})
        
        return jsonify({'message': 'Leave request cancelled successfully'}), 200
        
    except Exception as e:
        logger.error(f"Cancel leave error: {e}")
        return jsonify({'error': 'Failed to cancel leave request'}), 500

@app.route('/api/hr/leaves', methods=['GET'])
@jwt_required()
@role_required('HR', 'Admin', 'MD')
def get_all_leave_requests():
    """Get all leave requests for HR approval"""
    try:
        status_filter = request.args.get('status', 'Pending')
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        query = """
            SELECT la.*, u.full_name, u.department, u.employee_category
            FROM leave_applications la
            JOIN users u ON la.employee_id = u.employee_id
        """
        
        if status_filter:
            query += " WHERE la.status = ?"
            cursor.execute(query + " ORDER BY la.applied_on DESC", (status_filter,))
        else:
            cursor.execute(query + " ORDER BY la.applied_on DESC")
        
        leaves = cursor.fetchall()
        conn.close()
        
        leave_list = []
        for leave in leaves:
            leave_list.append({
                'id': leave['id'],
                'employee_id': leave['employee_id'],
                'employee_name': leave['full_name'],
                'department': leave['department'],
                'category': leave['employee_category'],
                'leave_type': leave['leave_type'],
                'leave_type_name': LEAVE_TYPES.get(leave['leave_type'], {}).get('name', leave['leave_type']),
                'start_date': leave['start_date'],
                'end_date': leave['end_date'],
                'days_requested': leave['days_requested'],
                'is_half_day': bool(leave['is_half_day']),
                'reason': leave['reason'],
                'status': leave['status'],
                'applied_on': leave['applied_on']
            })
        
        return jsonify({'leaves': leave_list}), 200
        
    except Exception as e:
        logger.error(f"HR get leaves error: {e}")
        return jsonify({'error': 'Failed to fetch leave requests'}), 500

@app.route('/api/hr/leaves/<int:leave_id>/approve', methods=['PUT'])
@jwt_required()
@role_required('HR', 'Admin', 'MD')
def approve_leave_request(leave_id):
    """Approve a leave request"""
    try:
        username = get_jwt_identity()
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get approver's employee_id
        cursor.execute("SELECT employee_id FROM users WHERE username = ?", (username,))
        approver = cursor.fetchone()
        
        if not approver:
            conn.close()
            return jsonify({'error': 'Approver not found'}), 404
        
        # Get leave request
        cursor.execute("SELECT * FROM leave_applications WHERE id = ?", (leave_id,))
        leave = cursor.fetchone()
        
        if not leave:
            conn.close()
            return jsonify({'error': 'Leave request not found'}), 404
        
        if leave['status'] != 'Pending':
            conn.close()
            return jsonify({'error': f'Cannot approve a {leave["status"].lower()} leave request'}), 400
        
        # Update leave status
        cursor.execute("""
            UPDATE leave_applications 
            SET status = 'Approved', approved_by = ?, approved_on = ?, updated_at = ?
            WHERE id = ?
        """, (approver['employee_id'], datetime.now().isoformat(), datetime.now().isoformat(), leave_id))
        
        # Update leave balance
        leave_type = leave['leave_type']
        days = leave['days_requested']
        year = datetime.strptime(leave['start_date'], '%Y-%m-%d').year
        
        balance_field = {
            'CL': 'casual_leave_used',
            'SL': 'sick_leave_used',
            'EL': 'earned_leave_used',
        }
        
        if leave_type in balance_field:
            field = balance_field[leave_type]
            cursor.execute(f"""
                UPDATE leave_balances 
                SET {field} = {field} + ?, updated_at = ?
                WHERE employee_id = ? AND leave_year = ?
            """, (days, datetime.now().isoformat(), leave['employee_id'], year))
        
        conn.commit()
        conn.close()
        
        audit_log('LEAVE_APPROVED', username, {'leave_id': leave_id, 'employee_id': leave['employee_id']})
        
        # TODO: Send email notification to employee
        
        return jsonify({'message': 'Leave request approved successfully'}), 200
        
    except Exception as e:
        logger.error(f"Approve leave error: {e}")
        return jsonify({'error': 'Failed to approve leave request'}), 500

@app.route('/api/hr/leaves/<int:leave_id>/reject', methods=['PUT'])
@jwt_required()
@role_required('HR', 'Admin', 'MD')
def reject_leave_request(leave_id):
    """Reject a leave request"""
    try:
        username = get_jwt_identity()
        data = request.get_json()
        rejection_reason = data.get('reason', 'No reason provided')
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get approver's employee_id
        cursor.execute("SELECT employee_id FROM users WHERE username = ?", (username,))
        approver = cursor.fetchone()
        
        if not approver:
            conn.close()
            return jsonify({'error': 'Approver not found'}), 404
        
        # Get leave request
        cursor.execute("SELECT * FROM leave_applications WHERE id = ?", (leave_id,))
        leave = cursor.fetchone()
        
        if not leave:
            conn.close()
            return jsonify({'error': 'Leave request not found'}), 404
        
        if leave['status'] != 'Pending':
            conn.close()
            return jsonify({'error': f'Cannot reject a {leave["status"].lower()} leave request'}), 400
        
        # Update leave status
        cursor.execute("""
            UPDATE leave_applications 
            SET status = 'Rejected', approved_by = ?, approved_on = ?, rejection_reason = ?, updated_at = ?
            WHERE id = ?
        """, (approver['employee_id'], datetime.now().isoformat(), rejection_reason, datetime.now().isoformat(), leave_id))
        
        conn.commit()
        conn.close()
        
        audit_log('LEAVE_REJECTED', username, {'leave_id': leave_id, 'reason': rejection_reason})
        
        # TODO: Send email notification to employee
        
        return jsonify({'message': 'Leave request rejected'}), 200
        
    except Exception as e:
        logger.error(f"Reject leave error: {e}")
        return jsonify({'error': 'Failed to reject leave request'}), 500


@app.route('/api/hr/employees', methods=['POST'])
@jwt_required()
def create_employee():
    """HR creates a new employee and sends credentials via email"""
    try:
        current_user = get_jwt_identity()
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        # Only HR, Admin, MD can create employees
        if user_role not in ('HR', 'Admin', 'MD'):
            return jsonify({'error': 'Unauthorized - HR access required'}), 403
        
        data = request.get_json()
        
        # Required fields
        required_fields = ['employee_id', 'full_name', 'email', 'role']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        employee_id = data.get('employee_id')
        full_name = data.get('full_name')
        email = data.get('email', '').strip().lower()
        role = data.get('role', 'Employee')
        
        # Optional fields - Step 1: Personal
        gender = data.get('gender')
        date_of_birth = data.get('date_of_birth')
        blood_group_id = data.get('blood_group_id')
        marital_status = data.get('marital_status')
        
        # Step 2: Assignment
        department = data.get('department', '')
        position = data.get('position', '')  # Division
        designation_id = data.get('designation_id')
        phone = data.get('phone', '')
        employee_category = data.get('employee_category', 'W001')  # Default to Worker
        shift = data.get('shift', '1')  # Default to shift 1
        hire_date = data.get('hire_date', datetime.now().strftime('%Y-%m-%d'))
        
        # Step 3: Address
        address_type = data.get('address_type', 'Current')
        address = data.get('address', '')
        address_line2 = data.get('address_line2', '')
        city = data.get('city', '')
        pincode = data.get('pincode', '')
        
        # Step 4: Compensation
        salary = data.get('salary', 0)
        pf_contribution = data.get('pf_contribution')
        esi_contribution = data.get('esi_contribution')
        net_pay = data.get('net_pay')
        
        # Auto-calculate if not provided
        if salary and not pf_contribution:
            pf_contribution = round(float(salary) * 0.12, 2)  # 12% PF
        if salary and not esi_contribution:
            esi_contribution = round(float(salary) * 0.0075, 2) if float(salary) < 21000 else 0  # 0.75% ESI if salary < 21k
        if salary and not net_pay:
            gross = float(salary)
            deductions = float(pf_contribution or 0) + float(esi_contribution or 0)
            net_pay = round(gross - deductions, 2)
        
        # Step 5: Other
        bus_id = data.get('bus_id')
        room_number = data.get('room_number', '')
        leave_balance = data.get('leave_balance', 12)
        
        # Get username and password from HR (required fields)
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        
        if not username:
            return jsonify({'error': 'Username is required'}), 400
        if not password:
            return jsonify({'error': 'Password is required'}), 400
        
        # Hash the password provided by HR
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Check if employee_id or email already exists
        cursor.execute(
            "SELECT id FROM users WHERE employee_id = ? OR LOWER(email) = ?",
            (employee_id, email)
        )
        existing = cursor.fetchone()
        
        if existing:
            conn.close()
            return jsonify({'error': 'Employee ID or email already exists'}), 400
        
        # Check if username exists, if so append employee_id
        cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
        if cursor.fetchone():
            username = f"{username}_{employee_id}"
        
        # Insert new employee with all 23 fields
        cursor.execute("""
            INSERT INTO users (
                employee_id, username, full_name, email, password_hash, role,
                gender, date_of_birth, blood_group_id, marital_status,
                department, position, designation_id, phone, employee_category, shift, hire_date,
                address_type, address, address_line2, city, pincode,
                salary, pf_contribution, esi_contribution, net_pay,
                bus_id, room_number, leave_balance,
                is_active, account_status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'Active', ?, ?)
        """, (
            employee_id, username, full_name, email, hashed_password.decode('utf-8'), role,
            gender, date_of_birth, blood_group_id, marital_status,
            department, position, designation_id, phone, employee_category, shift, hire_date,
            address_type, address, address_line2, city, pincode,
            salary, pf_contribution, esi_contribution, net_pay,
            bus_id, room_number, leave_balance,
            datetime.now().isoformat(), datetime.now().isoformat()
        ))
        
        new_user_id = cursor.lastrowid
        
        # Create leave balance record for new employee
        current_year = datetime.now().year
        cursor.execute("""
            INSERT OR IGNORE INTO leave_balances (
                employee_id, leave_year, casual_leave_total, casual_leave_used,
                sick_leave_total, sick_leave_used, earned_leave_total, earned_leave_used
            ) VALUES (?, ?, ?, 0, ?, 0, ?, 0)
        """, (employee_id, current_year, 
              12 if employee_category == 'S001' else 6,  # Casual Leave total
              12 if employee_category == 'S001' else 6,  # Sick Leave total
              15 if employee_category == 'S001' else 10  # Earned Leave total
        ))
        
        conn.commit()
        conn.close()
        
        audit_log('EMPLOYEE_CREATED', current_user, {
            'new_employee_id': employee_id,
            'username': username
        })
        
        # Return credentials to HR (no email sending)
        return jsonify({
            'message': 'Employee created successfully',
            'employee': {
                'id': new_user_id,
                'employee_id': employee_id,
                'username': username,
                'password': password,  # Return plain password for HR to see
                'full_name': full_name,
                'email': email,
                'role': role
            }
        }), 201
        
    except Exception as e:
        logger.error(f"Create employee error: {e}")
        return jsonify({'error': 'Failed to create employee'}), 500


@app.route('/api/hr/employees/<employee_id>', methods=['GET'])
@jwt_required()
def get_employee_details(employee_id):
    """Get employee details for HR"""
    try:
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        # Only HR, Admin, MD can view employee details
        if user_role not in ('HR', 'Admin', 'MD'):
            return jsonify({'error': 'Unauthorized'}), 403
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        cursor.execute("""
            SELECT employee_id, username, full_name, email, role, department,
                   designation, employee_category, shift, hire_date, is_active,
                   account_status, leave_balance, created_at
            FROM users 
            WHERE employee_id = ?
        """, (employee_id,))
        
        employee = cursor.fetchone()
        conn.close()
        
        if not employee:
            return jsonify({'error': 'Employee not found'}), 404
        
        return jsonify({'employee': dict(employee)}), 200
        
    except Exception as e:
        logger.error(f"Get employee error: {e}")
        return jsonify({'error': 'Failed to fetch employee'}), 500


@app.route('/api/hr/employees', methods=['GET'])
@jwt_required()
def list_employees():
    """List all employees for HR"""
    try:
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        # Only HR, Admin, MD can list employees
        if user_role not in ('HR', 'Admin', 'MD'):
            return jsonify({'error': 'Unauthorized'}), 403
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get query parameters for filtering
        status = request.args.get('status', 'all')
        category = request.args.get('category', 'all')
        department = request.args.get('department', 'all')
        division = request.args.get('division', 'all')
        gender = request.args.get('gender', 'all')
        
        # Query all 12 list view columns as per requirements
        query = """
            SELECT employee_id, full_name, gender, date_of_birth, hire_date,
                   department, position, designation_id, blood_group_id,
                   city, pincode, net_pay, is_active, account_status,
                   email, phone, employee_category
            FROM users 
            WHERE role = 'Employee'
        """
        params = []
        
        # Apply filters
        if status != 'all':
            query += " AND account_status = ?"
            params.append(status)
        
        if category != 'all':
            query += " AND employee_category = ?"
            params.append(category)
        
        if department != 'all':
            query += " AND department = ?"
            params.append(department)
        
        if division != 'all':
            query += " AND position = ?"
            params.append(division)
        
        if gender != 'all':
            query += " AND gender = ?"
            params.append(gender)
        
        query += " ORDER BY full_name"
        
        cursor.execute(query, params)
        employees = cursor.fetchall()
        
        # Format employee data with readable fields
        employee_list = []
        for emp in employees:
            emp_dict = dict(emp)
            # Calculate age from DOB if available
            if emp_dict.get('date_of_birth'):
                try:
                    from datetime import datetime
                    dob = datetime.strptime(str(emp_dict['date_of_birth']), '%Y-%m-%d')
                    today = datetime.today()
                    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                    emp_dict['age'] = age
                except:
                    emp_dict['age'] = None
            else:
                emp_dict['age'] = None
            
            employee_list.append(emp_dict)
        
        conn.close()
        
        return jsonify({
            'employees': employee_list,
            'total': len(employee_list)
        }), 200
        
    except Exception as e:
        logger.error(f"List employees error: {e}")
        return jsonify({'error': 'Failed to list employees'}), 500


@app.route('/api/hr/employees/<employee_id>/status', methods=['PUT'])
@jwt_required()
def update_employee_status(employee_id):
    """Update employee status (activate/deactivate/block)"""
    try:
        username = get_jwt_identity()
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        if user_role not in ('HR', 'Admin', 'MD'):
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        new_status = data.get('status')  # Active, Inactive, Blocked
        
        if new_status not in ('Active', 'Inactive', 'Blocked'):
            return jsonify({'error': 'Invalid status. Use: Active, Inactive, or Blocked'}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Check if employee exists
        cursor.execute("SELECT id, full_name FROM users WHERE employee_id = ?", (employee_id,))
        employee = cursor.fetchone()
        
        if not employee:
            conn.close()
            return jsonify({'error': 'Employee not found'}), 404
        
        # Update status
        is_active = 1 if new_status == 'Active' else 0
        cursor.execute("""
            UPDATE users 
            SET account_status = ?, is_active = ?, updated_at = datetime('now')
            WHERE employee_id = ?
        """, (new_status, is_active, employee_id))
        
        conn.commit()
        conn.close()
        
        audit_log('EMPLOYEE_STATUS_UPDATED', username, {
            'employee_id': employee_id,
            'new_status': new_status
        })
        
        return jsonify({
            'message': f"Employee {employee['full_name']} status updated to {new_status}"
        }), 200
        
    except Exception as e:
        logger.error(f"Update employee status error: {e}")
        return jsonify({'error': 'Failed to update employee status'}), 500


@app.route('/api/hr/employees/<employee_id>/credentials', methods=['POST'])
@jwt_required()
@role_required('Admin', 'HR')
def generate_employee_credentials(employee_id):
    """Generate login credentials for an employee (username and password)"""
    try:
        username = get_jwt_identity()
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get employee details
        cursor.execute("SELECT * FROM users WHERE employee_id = ?", (employee_id,))
        employee = cursor.fetchone()
        
        if not employee:
            conn.close()
            return jsonify({'error': 'Employee not found'}), 404
        
        if employee['role'] != 'Employee':
            conn.close()
            return jsonify({'error': 'Credentials can only be generated for employees'}), 400
        
        # Check if credentials already exist
        if employee['username'] and employee['password_hash']:
            conn.close()
            return jsonify({'error': 'Employee already has credentials'}), 400
        
        # Generate username: firstname.lastname
        full_name = employee['full_name'] or ''
        name_parts = full_name.lower().strip().split()
        if len(name_parts) >= 2:
            generated_username = f"{name_parts[0]}.{name_parts[-1]}"
        else:
            # Fallback to employee_id if name parsing fails
            generated_username = f"emp{employee_id}"
        
        # Check if username already exists, append number if needed
        cursor.execute("SELECT COUNT(*) FROM users WHERE username = ?", (generated_username,))
        count = cursor.fetchone()[0]
        if count > 0:
            generated_username = f"{generated_username}{count + 1}"
        
        # Generate password: Ves@employee_id
        generated_password = f"Ves@{employee_id}"
        password_hash = bcrypt.hashpw(generated_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Generate email if not exists
        generated_email = employee['email'] or f"{generated_username}@ves.com"
        
        # Update employee record with credentials
        cursor.execute("""
            UPDATE users 
            SET username = ?, email = ?, password_hash = ?, updated_at = datetime('now')
            WHERE employee_id = ?
        """, (generated_username, generated_email, password_hash, employee_id))
        
        conn.commit()
        conn.close()
        
        audit_log('CREDENTIALS_GENERATED', username, {
            'employee_id': employee_id,
            'generated_username': generated_username
        })
        
        return jsonify({
            'message': 'Credentials generated successfully',
            'employee_id': employee_id,
            'username': generated_username,
            'password': generated_password,  # Return plain password for HR to give to employee
            'email': generated_email
        }), 200
        
    except Exception as e:
        logger.error(f"Generate credentials error: {e}")
        return jsonify({'error': 'Failed to generate credentials'}), 500


@app.route('/api/hr/employees/<employee_id>', methods=['DELETE'])
@jwt_required()
def delete_employee(employee_id):
    """Permanently delete an employee (Admin/MD only)"""
    try:
        username = get_jwt_identity()
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        # Only Admin and MD can permanently delete
        if user_role not in ('Admin', 'MD'):
            return jsonify({'error': 'Unauthorized - Only Admin/MD can delete employees'}), 403
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Check if employee exists
        cursor.execute("SELECT id, full_name, role FROM users WHERE employee_id = ?", (employee_id,))
        employee = cursor.fetchone()
        
        if not employee:
            conn.close()
            return jsonify({'error': 'Employee not found'}), 404
        
        # Prevent deleting Admin/MD accounts
        if employee['role'] in ('Admin', 'MD'):
            conn.close()
            return jsonify({'error': 'Cannot delete Admin/MD accounts'}), 403
        
        # Delete employee (cascade will handle related records)
        cursor.execute("DELETE FROM users WHERE employee_id = ?", (employee_id,))
        conn.commit()
        conn.close()
        
        audit_log('EMPLOYEE_DELETED', username, {
            'employee_id': employee_id,
            'employee_name': employee['full_name']
        })
        
        return jsonify({
            'message': f"Employee {employee['full_name']} has been permanently deleted"
        }), 200
        
    except Exception as e:
        logger.error(f"Delete employee error: {e}")
        return jsonify({'error': 'Failed to delete employee'}), 500


@app.route('/api/hr/employees/<employee_id>', methods=['PUT'])
@jwt_required()
def update_employee(employee_id):
    """Update employee details - supports all 23 fields across 5 steps"""
    try:
        username = get_jwt_identity()
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        if user_role not in ('HR', 'Admin', 'MD'):
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Check if employee exists
        cursor.execute("SELECT id FROM users WHERE employee_id = ?", (employee_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Employee not found'}), 404
        
        # Build dynamic update query with all 23 fields from 5 steps
        updates = []
        params = []
        
        # Step 1: Personal Information (4 fields)
        personal_fields = ['full_name', 'gender', 'date_of_birth', 'blood_group_id', 'marital_status']
        
        # Step 2: Assignment Details (7 fields)
        assignment_fields = ['department', 'position', 'designation_id', 'phone', 
                            'employee_category', 'shift', 'hire_date']
        
        # Step 3: Address Information (5 fields)
        address_fields = ['address_type', 'address', 'address_line2', 'city', 'pincode']
        
        # Step 4: Compensation Details (4 fields with auto-calculation)
        compensation_fields = ['salary', 'pf_contribution', 'esi_contribution', 'net_pay']
        
        # Step 5: Other Information (3 fields)
        other_fields = ['bus_id', 'room_number', 'leave_balance', 'email', 'role']
        
        # Combine all updatable fields
        updatable_fields = personal_fields + assignment_fields + address_fields + compensation_fields + other_fields
        
        for field in updatable_fields:
            if field in data:
                updates.append(f"{field} = ?")
                params.append(data[field])
        
        # Auto-calculate compensation if salary is updated
        if 'salary' in data:
            salary = float(data['salary'])
            
            # Auto-calculate PF if not provided (12% of salary)
            if 'pf_contribution' not in data:
                pf = round(salary * 0.12, 2)
                updates.append("pf_contribution = ?")
                params.append(pf)
            else:
                pf = float(data['pf_contribution'])
            
            # Auto-calculate ESI if not provided (0.75% if salary < 21000)
            if 'esi_contribution' not in data:
                esi = round(salary * 0.0075, 2) if salary < 21000 else 0
                updates.append("esi_contribution = ?")
                params.append(esi)
            else:
                esi = float(data['esi_contribution'])
            
            # Auto-calculate net_pay if not provided
            if 'net_pay' not in data:
                net_pay = round(salary - pf - esi, 2)
                updates.append("net_pay = ?")
                params.append(net_pay)
        
        if not updates:
            conn.close()
            return jsonify({'error': 'No fields to update'}), 400
        
        updates.append("updated_at = datetime('now')")
        params.append(employee_id)
        
        query = f"UPDATE users SET {', '.join(updates)} WHERE employee_id = ?"
        cursor.execute(query, params)
        conn.commit()
        conn.close()
        
        audit_log('EMPLOYEE_UPDATED', username, {'employee_id': employee_id, 'fields': list(data.keys())})
        
        return jsonify({'message': 'Employee updated successfully'}), 200
        
    except Exception as e:
        logger.error(f"Update employee error: {e}")
        return jsonify({'error': 'Failed to update employee'}), 500


# ============== HR ATTENDANCE MANAGEMENT ==============

@app.route('/api/hr/attendance', methods=['GET'])
@jwt_required()
def get_all_attendance():
    """Get attendance records with filters for HR"""
    try:
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        if user_role not in ('HR', 'Admin', 'MD'):
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Get filter parameters
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        department = request.args.get('department')
        shift = request.args.get('shift')
        status = request.args.get('status')  # Present, Absent, Late, etc.
        employee_id = request.args.get('employee_id')
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        query = """
            SELECT a.id, a.employee_id, u.full_name, u.department, u.shift,
                   a.date, a.clock_in, a.clock_out, a.status, a.hours_worked,
                   a.notes
            FROM attendance a
            JOIN users u ON a.employee_id = u.employee_id
            WHERE 1=1
        """
        params = []
        
        if date_from:
            query += " AND a.date >= ?"
            params.append(date_from)
        
        if date_to:
            query += " AND a.date <= ?"
            params.append(date_to)
        
        if department and department != 'all':
            query += " AND u.department = ?"
            params.append(department)
        
        if shift and shift != 'all':
            query += " AND u.shift = ?"
            params.append(shift)
        
        if status and status != 'all':
            query += " AND a.status = ?"
            params.append(status)
        
        if employee_id:
            query += " AND a.employee_id = ?"
            params.append(employee_id)
        
        query += " ORDER BY a.date DESC, u.full_name"
        
        cursor.execute(query, params)
        records = cursor.fetchall()
        
        # Get departments and shifts for filter options
        cursor.execute("SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department != ''")
        departments = [row['department'] for row in cursor.fetchall()]
        
        cursor.execute("SELECT DISTINCT shift FROM users WHERE shift IS NOT NULL AND shift != ''")
        shifts = [row['shift'] for row in cursor.fetchall()]
        
        conn.close()
        
        return jsonify({
            'attendance': [dict(r) for r in records],
            'total': len(records),
            'filters': {
                'departments': departments,
                'shifts': shifts,
                'statuses': ['Present', 'Absent', 'Late', 'Half-Day', 'On Leave']
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get all attendance error: {e}")
        return jsonify({'error': 'Failed to fetch attendance'}), 500


@app.route('/api/hr/attendance/<int:attendance_id>', methods=['PUT'])
@jwt_required()
def modify_attendance(attendance_id):
    """HR can modify attendance records"""
    try:
        username = get_jwt_identity()
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        if user_role not in ('HR', 'Admin', 'MD'):
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Check if record exists
        cursor.execute("SELECT id, employee_id FROM attendance WHERE id = ?", (attendance_id,))
        record = cursor.fetchone()
        
        if not record:
            conn.close()
            return jsonify({'error': 'Attendance record not found'}), 404
        
        # Update fields
        clock_in = data.get('clock_in')
        clock_out = data.get('clock_out')
        status = data.get('status')
        notes = data.get('notes', '')
        
        # Calculate hours worked if both times provided
        hours_worked = None
        if clock_in and clock_out:
            try:
                from datetime import datetime as dt
                t1 = dt.strptime(clock_in, '%H:%M')
                t2 = dt.strptime(clock_out, '%H:%M')
                diff = (t2 - t1).seconds / 3600
                hours_worked = round(diff, 2)
            except:
                pass
        
        # Determine late/early flags
        is_late = 0
        is_early_leave = 0
        if clock_in:
            try:
                check_in_time = datetime.strptime(clock_in, '%H:%M').time()
                late_threshold = datetime.strptime('09:15', '%H:%M').time()
                is_late = 1 if check_in_time > late_threshold else 0
            except:
                pass
        
        if clock_out:
            try:
                check_out_time = datetime.strptime(clock_out, '%H:%M').time()
                early_threshold = datetime.strptime('17:30', '%H:%M').time()
                is_early_leave = 1 if check_out_time < early_threshold else 0
            except:
                pass
        
        cursor.execute("""
            UPDATE attendance 
            SET clock_in = COALESCE(?, clock_in),
                clock_out = COALESCE(?, clock_out),
                status = COALESCE(?, status),
                hours_worked = COALESCE(?, hours_worked),
                notes = ?,
                updated_at = datetime('now')
            WHERE id = ?
        """, (clock_in, clock_out, status, hours_worked, 
              notes + f" [Modified by {username}]", attendance_id))
        
        conn.commit()
        conn.close()
        
        audit_log('ATTENDANCE_MODIFIED', username, {
            'attendance_id': attendance_id,
            'employee_id': record['employee_id'],
            'changes': data
        })
        
        return jsonify({'message': 'Attendance record updated successfully'}), 200
        
    except Exception as e:
        logger.error(f"Modify attendance error: {e}")
        return jsonify({'error': 'Failed to modify attendance'}), 500


@app.route('/api/hr/attendance', methods=['POST'])
@jwt_required()
def add_attendance_record():
    """HR can add attendance record manually"""
    try:
        username = get_jwt_identity()
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        if user_role not in ('HR', 'Admin', 'MD'):
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        employee_id = data.get('employee_id')
        date = data.get('date')
        clock_in = data.get('clock_in')
        clock_out = data.get('clock_out')
        status = data.get('status', 'Present')
        notes = data.get('notes', '')
        
        if not employee_id or not date:
            return jsonify({'error': 'Employee ID and date are required'}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Check if record already exists
        cursor.execute(
            "SELECT id FROM attendance WHERE employee_id = ? AND date = ?",
            (employee_id, date)
        )
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Attendance record already exists for this date'}), 400
        
        # Calculate hours worked
        hours_worked = None
        if clock_in and clock_out:
            try:
                from datetime import datetime as dt
                t1 = dt.strptime(clock_in, '%H:%M')
                t2 = dt.strptime(clock_out, '%H:%M')
                diff = (t2 - t1).seconds / 3600
                hours_worked = round(diff, 2)
            except:
                pass
        
        cursor.execute("""
            INSERT INTO attendance (employee_id, date, clock_in, clock_out, status, hours_worked, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (employee_id, date, clock_in, clock_out, status, hours_worked, 
              notes + f" [Added by {username}]"))
        
        conn.commit()
        conn.close()
        
        audit_log('ATTENDANCE_ADDED', username, {
            'employee_id': employee_id,
            'date': date,
            'status': status
        })
        
        return jsonify({'message': 'Attendance record added successfully'}), 201
        
    except Exception as e:
        logger.error(f"Add attendance error: {e}")
        return jsonify({'error': 'Failed to add attendance'}), 500


# ============== REPORTS APIs ==============

@app.route('/api/hr/reports/attendance', methods=['GET'])
@jwt_required()
def get_attendance_report():
    """Generate attendance report with optional CSV export"""
    try:
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        if user_role not in ('HR', 'Admin', 'MD'):
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Get filter parameters
        date_from = request.args.get('date_from', (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'))
        date_to = request.args.get('date_to', datetime.now().strftime('%Y-%m-%d'))
        department = request.args.get('department')
        export_format = request.args.get('format', 'json')  # json or csv
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        query = """
            SELECT u.employee_id, u.full_name, u.department, u.shift,
                   COUNT(CASE WHEN a.status = 'Present' THEN 1 END) as present_days,
                   COUNT(CASE WHEN a.status = 'Absent' THEN 1 END) as absent_days,
                   ROUND(AVG(a.hours_worked), 2) as avg_hours,
                   SUM(a.hours_worked) as total_hours
            FROM users u
            LEFT JOIN attendance a ON u.employee_id = a.employee_id 
                AND a.date BETWEEN ? AND ?
            WHERE u.is_active = 1
        """
        params = [date_from, date_to]
        
        if department and department != 'all':
            query += " AND u.department = ?"
            params.append(department)
        
        query += " GROUP BY u.employee_id, u.full_name, u.department, u.shift ORDER BY u.department, u.full_name"
        
        cursor.execute(query, params)
        report_data = cursor.fetchall()
        
        # Get summary stats
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT a.employee_id) as total_employees,
                COUNT(CASE WHEN a.status = 'Present' THEN 1 END) as total_present,
                COUNT(CASE WHEN a.status = 'Absent' THEN 1 END) as total_absent,
                ROUND(AVG(a.hours_worked), 2) as avg_hours_all
            FROM attendance a
            JOIN users u ON a.employee_id = u.employee_id
            WHERE a.date BETWEEN ? AND ? AND u.is_active = 1
        """, [date_from, date_to])
        summary = cursor.fetchone()
        
        conn.close()
        
        if export_format == 'csv':
            # Generate CSV
            import io
            import csv
            
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Header
            writer.writerow(['Employee ID', 'Name', 'Department', 'Shift', 
                           'Present Days', 'Absent Days', 'Avg Hours', 'Total Hours'])
            
            # Data
            for row in report_data:
                writer.writerow([
                    row['employee_id'], row['full_name'], row['department'],
                    row['shift'], row['present_days'] or 0, row['absent_days'] or 0,
                    row['avg_hours'] or 0, row['total_hours'] or 0
                ])
            
            csv_content = output.getvalue()
            
            from flask import Response
            return Response(
                csv_content,
                mimetype='text/csv',
                headers={'Content-Disposition': f'attachment; filename=attendance_report_{date_from}_to_{date_to}.csv'}
            )
        
        return jsonify({
            'report': [dict(r) for r in report_data],
            'summary': dict(summary) if summary else {},
            'period': {'from': date_from, 'to': date_to}
        }), 200
        
    except Exception as e:
        logger.error(f"Attendance report error: {e}")
        return jsonify({'error': 'Failed to generate report'}), 500


@app.route('/api/hr/reports/leaves', methods=['GET'])
@jwt_required()
def get_leave_report():
    """Generate leave report with optional CSV export"""
    try:
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        if user_role not in ('HR', 'Admin', 'MD'):
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Get filter parameters
        date_from = request.args.get('date_from', (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'))
        date_to = request.args.get('date_to', datetime.now().strftime('%Y-%m-%d'))
        department = request.args.get('department')
        leave_type = request.args.get('leave_type')
        status = request.args.get('status')
        export_format = request.args.get('format', 'json')
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        query = """
            SELECT l.id, l.employee_id, u.full_name, u.department,
                   l.leave_type, l.start_date, l.end_date, l.total_days,
                   l.reason, l.status, l.approved_by, l.approved_on,
                   l.rejection_reason, l.applied_on
            FROM leave_applications l
            JOIN users u ON l.employee_id = u.employee_id
            WHERE l.start_date >= ? AND l.end_date <= ?
        """
        params = [date_from, date_to]
        
        if department and department != 'all':
            query += " AND u.department = ?"
            params.append(department)
        
        if leave_type and leave_type != 'all':
            query += " AND l.leave_type = ?"
            params.append(leave_type)
        
        if status and status != 'all':
            query += " AND l.status = ?"
            params.append(status)
        
        query += " ORDER BY l.applied_on DESC"
        
        cursor.execute(query, params)
        leaves = cursor.fetchall()
        
        # Get summary by type
        cursor.execute("""
            SELECT leave_type, 
                   COUNT(*) as count,
                   SUM(total_days) as total_days,
                   COUNT(CASE WHEN status = 'Approved' THEN 1 END) as approved,
                   COUNT(CASE WHEN status = 'Rejected' THEN 1 END) as rejected,
                   COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending
            FROM leave_applications
            WHERE start_date >= ? AND end_date <= ?
            GROUP BY leave_type
        """, [date_from, date_to])
        summary_by_type = cursor.fetchall()
        
        conn.close()
        
        if export_format == 'csv':
            import io
            import csv
            
            output = io.StringIO()
            writer = csv.writer(output)
            
            writer.writerow(['Employee ID', 'Name', 'Department', 'Leave Type',
                           'Start Date', 'End Date', 'Days', 'Status', 
                           'Reason', 'Applied On'])
            
            for row in leaves:
                writer.writerow([
                    row['employee_id'], row['full_name'], row['department'],
                    row['leave_type'], row['start_date'], row['end_date'],
                    row['total_days'], row['status'], row['reason'],
                    row['applied_on']
                ])
            
            csv_content = output.getvalue()
            
            from flask import Response
            return Response(
                csv_content,
                mimetype='text/csv',
                headers={'Content-Disposition': f'attachment; filename=leave_report_{date_from}_to_{date_to}.csv'}
            )
        
        return jsonify({
            'leaves': [dict(l) for l in leaves],
            'summary_by_type': [dict(s) for s in summary_by_type],
            'total': len(leaves),
            'period': {'from': date_from, 'to': date_to}
        }), 200
        
    except Exception as e:
        logger.error(f"Leave report error: {e}")
        return jsonify({'error': 'Failed to generate report'}), 500


@app.route('/api/hr/departments', methods=['GET'])
@jwt_required()
def get_departments():
    """Get list of departments"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT department, COUNT(*) as employee_count
            FROM users 
            WHERE department IS NOT NULL AND department != '' AND is_active = 1
            GROUP BY department
            ORDER BY department
        """)
        departments = cursor.fetchall()
        conn.close()
        
        return jsonify({
            'departments': [{'name': d['department'], 'count': d['employee_count']} for d in departments]
        }), 200
        
    except Exception as e:
        logger.error(f"Get departments error: {e}")
        return jsonify({'error': 'Failed to fetch departments'}), 500


# ============== HR DASHBOARD - MASTER DATA APIs ==============

@app.route('/api/hr/master/departments', methods=['GET'])
@jwt_required()
def get_master_departments():
    """Get all departments from master table"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        cursor.execute("SELECT id, dept_name, dept_code FROM master_departments WHERE is_active = 1 ORDER BY dept_name")
        departments = cursor.fetchall()
        conn.close()
        
        return jsonify({
            'departments': [dict(d) for d in departments]
        }), 200
        
    except Exception as e:
        logger.error(f"Get master departments error: {e}")
        return jsonify({'error': 'Failed to fetch departments'}), 500


@app.route('/api/hr/master/designations', methods=['GET'])
@jwt_required()
def get_master_designations():
    """Get all designations from master table"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        cursor.execute("SELECT id, designation_name, designation_code, category FROM master_designations WHERE is_active = 1 ORDER BY designation_name")
        designations = cursor.fetchall()
        conn.close()
        
        return jsonify({
            'designations': [dict(d) for d in designations]
        }), 200
        
    except Exception as e:
        logger.error(f"Get master designations error: {e}")
        return jsonify({'error': 'Failed to fetch designations'}), 500


@app.route('/api/hr/master/branches', methods=['GET'])
@jwt_required()
def get_master_branches():
    """Get all branches from master table"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        cursor.execute("SELECT id, branch_name, branch_code, address FROM master_branches WHERE is_active = 1 ORDER BY branch_name")
        branches = cursor.fetchall()
        conn.close()
        
        return jsonify({
            'branches': [dict(b) for b in branches]
        }), 200
        
    except Exception as e:
        logger.error(f"Get master branches error: {e}")
        return jsonify({'error': 'Failed to fetch branches'}), 500


@app.route('/api/hr/master/divisions', methods=['GET'])
@jwt_required()
def get_master_divisions():
    """Get all divisions from master table"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        cursor.execute("SELECT id, division_name, division_code FROM master_divisions WHERE is_active = 1 ORDER BY division_name")
        divisions = cursor.fetchall()
        conn.close()
        
        return jsonify({
            'divisions': [dict(d) for d in divisions]
        }), 200
        
    except Exception as e:
        logger.error(f"Get master divisions error: {e}")
        return jsonify({'error': 'Failed to fetch divisions'}), 500


@app.route('/api/hr/dashboard/stats', methods=['GET'])
@jwt_required()
def get_hr_dashboard_stats():
    """Get HR dashboard statistics"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Total employees
        cursor.execute("SELECT COUNT(*) as count FROM users WHERE role = 'Employee'")
        total = cursor.fetchone()['count']
        
        # Active employees
        cursor.execute("SELECT COUNT(*) as count FROM users WHERE role = 'Employee' AND is_active = 1")
        active = cursor.fetchone()['count']
        
        # Inactive employees
        inactive = total - active
        
        # Department wise count
        cursor.execute("""
            SELECT department, COUNT(*) as count 
            FROM users 
            WHERE role = 'Employee' AND is_active = 1 AND department IS NOT NULL
            GROUP BY department 
            ORDER BY count DESC 
            LIMIT 5
        """)
        dept_stats = cursor.fetchall()
        
        # New joiners this month
        first_day_of_month = datetime.now().replace(day=1).date()
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM users 
            WHERE role = 'Employee' AND hire_date >= ?
        """, (first_day_of_month,))
        new_joiners = cursor.fetchone()['count']
        
        # Employees by category
        cursor.execute("""
            SELECT employee_category, COUNT(*) as count 
            FROM users 
            WHERE role = 'Employee' AND is_active = 1
            GROUP BY employee_category
        """)
        category_stats = cursor.fetchall()
        
        conn.close()
        
        return jsonify({
            'total_employees': total,
            'active_employees': active,
            'inactive_employees': inactive,
            'new_joiners_this_month': new_joiners,
            'department_stats': [{'department': d['department'], 'count': d['count']} for d in dept_stats],
            'category_stats': [{'category': c['employee_category'], 'count': c['count']} for c in category_stats]
        }), 200
        
    except Exception as e:
        logger.error(f"Get dashboard stats error: {e}")
        return jsonify({'error': 'Failed to fetch dashboard stats'}), 500


@app.route('/api/hr/employees/search', methods=['GET'])
@jwt_required()
def search_employees():
    """Advanced employee search with filters"""
    try:
        # Get query parameters
        search_term = request.args.get('q', '').strip()
        department = request.args.get('department', '').strip()
        designation = request.args.get('designation', '').strip()
        status = request.args.get('status', 'active').strip()
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Build dynamic query
        query = """
            SELECT id, employee_id, full_name, email, department, position, 
                   hire_date, phone, is_active, employee_category, shift, 
                   leave_balance, address, username, password_hash
            FROM users 
            WHERE role = 'Employee'
        """
        params = []
        
        # Status filter
        if status == 'active':
            query += " AND is_active = 1"
        elif status == 'inactive':
            query += " AND is_active = 0"
        
        # Search term (name or employee_id)
        if search_term:
            query += " AND (full_name LIKE ? OR employee_id LIKE ?)"
            params.extend([f'%{search_term}%', f'%{search_term}%'])
        
        # Department filter
        if department:
            query += " AND department = ?"
            params.append(department)
        
        # Designation filter
        if designation:
            query += " AND position = ?"
            params.append(designation)
        
        # Count total records
        count_query = f"SELECT COUNT(*) as total FROM ({query})"
        cursor.execute(count_query, params)
        total = cursor.fetchone()['total']
        
        # Add pagination
        query += " ORDER BY full_name LIMIT ? OFFSET ?"
        params.extend([per_page, (page - 1) * per_page])
        
        cursor.execute(query, params)
        employees = cursor.fetchall()
        conn.close()
        
        return jsonify({
            'employees': [dict(e) for e in employees],
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        }), 200
        
    except Exception as e:
        logger.error(f"Search employees error: {e}")
        return jsonify({'error': 'Failed to search employees'}), 500


@app.route('/api/hr/employees/next-id', methods=['GET'])
@jwt_required()
def get_next_employee_id():
    """Get next available employee ID"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get the highest numeric employee_id
        cursor.execute("""
            SELECT employee_id FROM users 
            WHERE employee_id GLOB '[0-9]*'
            ORDER BY CAST(employee_id AS INTEGER) DESC 
            LIMIT 1
        """)
        result = cursor.fetchone()
        conn.close()
        
        if result and result['employee_id']:
            try:
                next_id = str(int(result['employee_id']) + 1)
            except:
                next_id = "1001"
        else:
            next_id = "1001"
        
        return jsonify({'next_employee_id': next_id}), 200
        
    except Exception as e:
        logger.error(f"Get next employee ID error: {e}")
        return jsonify({'error': 'Failed to generate employee ID'}), 500


# ============================================================
# LOOKUP DATA APIS - For Dropdowns in Employee Form
# ============================================================

@app.route('/api/hr/lookup/blood-groups', methods=['GET'])
@jwt_required()
def get_blood_groups_lookup():
    """Get all blood groups for dropdown"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        cursor.execute("SELECT blood_group_id, blood_group_name FROM blood_groups ORDER BY blood_group_name")
        blood_groups = cursor.fetchall()
        conn.close()
        
        return jsonify({
            'blood_groups': [dict(bg) for bg in blood_groups]
        }), 200
        
    except Exception as e:
        logger.error(f"Get blood groups error: {e}")
        return jsonify({'error': 'Failed to fetch blood groups'}), 500


@app.route('/api/hr/lookup/departments', methods=['GET'])
@jwt_required()
def get_departments_lookup():
    """Get all departments for dropdown from lookup table"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        cursor.execute("SELECT dept_id, dept_name, dept_short FROM departments ORDER BY dept_name")
        departments = cursor.fetchall()
        conn.close()
        
        return jsonify({
            'departments': [dict(dept) for dept in departments]
        }), 200
        
    except Exception as e:
        logger.error(f"Get departments error: {e}")
        return jsonify({'error': 'Failed to fetch departments'}), 500


@app.route('/api/hr/lookup/divisions', methods=['GET'])
@jwt_required()
def get_divisions_lookup():
    """Get all divisions for dropdown from lookup table, optionally filtered by department"""
    try:
        dept_id = request.args.get('dept_id')
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        if dept_id:
            cursor.execute("""
                SELECT division_id, division_name, dept_id 
                FROM divisions 
                WHERE dept_id = ?
                ORDER BY division_name
            """, (dept_id,))
        else:
            cursor.execute("SELECT division_id, division_name, dept_id FROM divisions ORDER BY division_name")
        
        divisions = cursor.fetchall()
        conn.close()
        
        return jsonify({
            'divisions': [dict(div) for div in divisions]
        }), 200
        
    except Exception as e:
        logger.error(f"Get divisions error: {e}")
        return jsonify({'error': 'Failed to fetch divisions'}), 500


@app.route('/api/hr/lookup/designations', methods=['GET'])
@jwt_required()
def get_designations_lookup():
    """Get all designations for dropdown from lookup table"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        cursor.execute("SELECT designation_id, designation_name FROM designations ORDER BY designation_name")
        designations = cursor.fetchall()
        conn.close()
        
        return jsonify({
            'designations': [dict(desig) for desig in designations]
        }), 200
        
    except Exception as e:
        logger.error(f"Get designations error: {e}")
        return jsonify({'error': 'Failed to fetch designations'}), 500


# ============== PAYROLL MANAGEMENT APIs ==============

@app.route('/api/hr/payroll/salary-config', methods=['GET'])
@jwt_required()
def get_salary_configs():
    """Get salary configurations for all employees"""
    try:
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        if user_role not in ('HR', 'Admin', 'MD'):
            return jsonify({'error': 'Unauthorized'}), 403
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.employee_id, u.full_name, u.department, u.position, u.employee_category,
                   COALESCE(u.salary, 0) as basic_salary
            FROM users u
            WHERE u.is_active = 1 AND u.role = 'Employee'
            ORDER BY u.department, u.full_name
        """)
        employees = cursor.fetchall()
        conn.close()
        
        return jsonify({
            'employees': [dict(e) for e in employees]
        }), 200
        
    except Exception as e:
        logger.error(f"Get salary configs error: {e}")
        return jsonify({'error': 'Failed to fetch salary configurations'}), 500


@app.route('/api/hr/payroll/salary-config/<employee_id>', methods=['PUT'])
@jwt_required()
def update_salary_config(employee_id):
    """Update salary configuration for an employee"""
    try:
        username = get_jwt_identity()
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        if user_role not in ('HR', 'Admin', 'MD'):
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        basic_salary = data.get('basic_salary', 0)
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET salary = ? WHERE employee_id = ?", (basic_salary, employee_id))
        conn.commit()
        conn.close()
        
        audit_log('SALARY_UPDATED', username, {'employee_id': employee_id, 'basic_salary': basic_salary})
        
        return jsonify({'message': 'Salary updated successfully'}), 200
        
    except Exception as e:
        logger.error(f"Update salary config error: {e}")
        return jsonify({'error': 'Failed to update salary'}), 500


@app.route('/api/hr/payroll/calculate', methods=['POST'])
@jwt_required()
def calculate_payroll():
    """Calculate payroll for employees for a specific month"""
    try:
        username = get_jwt_identity()
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        if user_role not in ('HR', 'Admin', 'MD'):
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        month = data.get('month')  # Format: YYYY-MM
        employee_id = data.get('employee_id')  # Optional - if not provided, calculate for all
        
        if not month:
            return jsonify({'error': 'Month is required (YYYY-MM format)'}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get employees to process
        if employee_id:
            cursor.execute("""
                SELECT employee_id, full_name, department, salary, employee_category
                FROM users WHERE employee_id = ? AND is_active = 1
            """, (employee_id,))
        else:
            cursor.execute("""
                SELECT employee_id, full_name, department, salary, employee_category
                FROM users WHERE is_active = 1 AND role = 'Employee'
            """)
        
        employees = cursor.fetchall()
        
        # Get month date range
        year, mon = month.split('-')
        start_date = f"{month}-01"
        # Get last day of month
        import calendar
        last_day = calendar.monthrange(int(year), int(mon))[1]
        end_date = f"{month}-{last_day:02d}"
        
        # Calculate working days (excluding Sundays)
        from datetime import date, timedelta
        total_working_days = 0
        current = date(int(year), int(mon), 1)
        end = date(int(year), int(mon), last_day)
        while current <= end:
            if current.weekday() != 6:  # Not Sunday
                total_working_days += 1
            current += timedelta(days=1)
        
        results = []
        
        for emp in employees:
            emp_id = emp['employee_id']
            basic_salary = emp['salary'] or 0
            
            # Get attendance data for the month
            cursor.execute("""
                SELECT COUNT(*) as present_days,
                       SUM(COALESCE(hours_worked, 0)) as total_hours
                FROM attendance
                WHERE employee_id = ? AND date BETWEEN ? AND ? AND status = 'Present'
            """, (emp_id, start_date, end_date))
            attendance = cursor.fetchone()
            
            present_days = attendance['present_days'] or 0
            total_hours = attendance['total_hours'] or 0
            
            # Get approved leaves for the month
            cursor.execute("""
                SELECT leave_type, SUM(total_days) as days
                FROM leave_applications
                WHERE employee_id = ? 
                AND status = 'Approved'
                AND ((start_date BETWEEN ? AND ?) OR (end_date BETWEEN ? AND ?))
                GROUP BY leave_type
            """, (emp_id, start_date, end_date, start_date, end_date))
            leaves = cursor.fetchall()
            
            paid_leave_days = 0
            lop_days = 0
            
            for leave in leaves:
                if leave['leave_type'] == 'LOP':
                    lop_days += leave['days'] or 0
                else:
                    paid_leave_days += leave['days'] or 0
            
            # Calculate overtime (hours beyond 8 per day)
            expected_hours = present_days * 8
            overtime_hours = max(0, total_hours - expected_hours)
            
            # Calculate per day salary
            per_day_salary = basic_salary / total_working_days if total_working_days > 0 else 0
            per_hour_salary = per_day_salary / 8 if per_day_salary > 0 else 0
            
            # Calculate components
            absent_days = total_working_days - present_days - paid_leave_days - lop_days
            absent_days = max(0, absent_days)  # Can't be negative
            
            # Earnings
            basic_earned = per_day_salary * present_days
            leave_pay = per_day_salary * paid_leave_days
            overtime_pay = per_hour_salary * 1.5 * overtime_hours  # 1.5x for overtime
            
            # Standard allowances (can be customized)
            hra = basic_salary * 0.1  # 10% HRA
            conveyance = 1600  # Fixed conveyance
            medical = 1250  # Fixed medical
            total_allowances = hra + conveyance + medical
            
            # Deductions
            lop_deduction = per_day_salary * lop_days
            absent_deduction = per_day_salary * absent_days
            
            # Standard deductions
            pf = basic_salary * 0.12 if basic_salary <= 15000 else 15000 * 0.12  # PF
            professional_tax = 200 if basic_salary > 10000 else 0  # PT
            
            total_deductions = lop_deduction + absent_deduction + pf + professional_tax
            
            # Calculate gross and net
            gross_salary = basic_earned + leave_pay + overtime_pay + total_allowances
            net_pay = gross_salary - total_deductions
            net_pay = max(0, net_pay)  # Can't be negative
            
            # Save to payroll table
            cursor.execute("""
                INSERT OR REPLACE INTO payroll 
                (employee_id, month, basic_salary, allowances, overtime_pay, deductions, net_pay, 
                 worked_days, leave_days, processed_by, processed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """, (emp_id, month, basic_salary, total_allowances, overtime_pay, total_deductions, 
                  net_pay, present_days, paid_leave_days + lop_days, username))
            
            results.append({
                'employee_id': emp_id,
                'employee_name': emp['full_name'],
                'department': emp['department'],
                'month': month,
                'basic_salary': round(basic_salary, 2),
                'working_days': total_working_days,
                'present_days': present_days,
                'paid_leave_days': paid_leave_days,
                'lop_days': lop_days,
                'absent_days': absent_days,
                'overtime_hours': round(overtime_hours, 2),
                'earnings': {
                    'basic': round(basic_earned, 2),
                    'leave_pay': round(leave_pay, 2),
                    'overtime': round(overtime_pay, 2),
                    'hra': round(hra, 2),
                    'conveyance': conveyance,
                    'medical': medical
                },
                'deductions': {
                    'lop': round(lop_deduction, 2),
                    'absent': round(absent_deduction, 2),
                    'pf': round(pf, 2),
                    'professional_tax': professional_tax
                },
                'gross_salary': round(gross_salary, 2),
                'total_deductions': round(total_deductions, 2),
                'net_pay': round(net_pay, 2)
            })
        
        conn.commit()
        conn.close()
        
        audit_log('PAYROLL_CALCULATED', username, {'month': month, 'employees_processed': len(results)})
        
        return jsonify({
            'message': f'Payroll calculated for {len(results)} employees',
            'month': month,
            'payroll': results
        }), 200
        
    except Exception as e:
        logger.error(f"Calculate payroll error: {e}")
        return jsonify({'error': f'Failed to calculate payroll: {str(e)}'}), 500


@app.route('/api/hr/payroll', methods=['GET'])
@jwt_required()
def get_payroll_list():
    """Get payroll list for a specific month"""
    try:
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        if user_role not in ('HR', 'Admin', 'MD'):
            return jsonify({'error': 'Unauthorized'}), 403
        
        month = request.args.get('month')  # Format: YYYY-MM
        
        if not month:
            # Default to current month
            month = datetime.now().strftime('%Y-%m')
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.*, u.full_name, u.department, u.position
            FROM payroll p
            JOIN users u ON p.employee_id = u.employee_id
            WHERE p.month = ?
            ORDER BY u.department, u.full_name
        """, (month,))
        payroll = cursor.fetchall()
        
        # Get summary
        cursor.execute("""
            SELECT 
                COUNT(*) as total_employees,
                SUM(basic_salary) as total_basic,
                SUM(allowances) as total_allowances,
                SUM(overtime_pay) as total_overtime,
                SUM(deductions) as total_deductions,
                SUM(net_pay) as total_net_pay
            FROM payroll WHERE month = ?
        """, (month,))
        summary = cursor.fetchone()
        
        conn.close()
        
        return jsonify({
            'month': month,
            'payroll': [dict(p) for p in payroll],
            'summary': {
                'total_employees': summary['total_employees'] or 0,
                'total_basic': round(summary['total_basic'] or 0, 2),
                'total_allowances': round(summary['total_allowances'] or 0, 2),
                'total_overtime': round(summary['total_overtime'] or 0, 2),
                'total_deductions': round(summary['total_deductions'] or 0, 2),
                'total_net_pay': round(summary['total_net_pay'] or 0, 2)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get payroll list error: {e}")
        return jsonify({'error': 'Failed to fetch payroll'}), 500


@app.route('/api/hr/payroll/payslip/<employee_id>', methods=['GET'])
@jwt_required()
def get_payslip(employee_id):
    """Get payslip for an employee for a specific month"""
    try:
        username = get_jwt_identity()
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        # Employees can only view their own payslip
        if user_role == 'Employee' and username != employee_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        month = request.args.get('month')
        if not month:
            month = datetime.now().strftime('%Y-%m')
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get employee details
        cursor.execute("""
            SELECT u.employee_id, u.full_name, u.email, u.department, u.position, 
                   u.employee_category, u.hire_date, u.salary
            FROM users u WHERE u.employee_id = ?
        """, (employee_id,))
        employee = cursor.fetchone()
        
        if not employee:
            conn.close()
            return jsonify({'error': 'Employee not found'}), 404
        
        # Get payroll data
        cursor.execute("""
            SELECT * FROM payroll WHERE employee_id = ? AND month = ?
        """, (employee_id, month))
        payroll = cursor.fetchone()
        
        if not payroll:
            conn.close()
            return jsonify({'error': 'Payroll not found for this month. Please process payroll first.'}), 404
        
        # Get company name
        cursor.execute("SELECT setting_value FROM system_settings WHERE setting_key = 'company_name'")
        company_row = cursor.fetchone()
        company_name = company_row['setting_value'] if company_row else 'VES Engineering Services'
        
        # Calculate breakdown
        basic_salary = payroll['basic_salary']
        total_working_days = 26  # Approximate
        per_day = basic_salary / total_working_days if total_working_days > 0 else 0
        
        # Standard breakdown
        hra = basic_salary * 0.1
        conveyance = 1600
        medical = 1250
        
        # Deductions breakdown
        pf = basic_salary * 0.12 if basic_salary <= 15000 else 15000 * 0.12
        professional_tax = 200 if basic_salary > 10000 else 0
        lop_deduction = payroll['deductions'] - pf - professional_tax
        
        conn.close()
        
        payslip = {
            'company_name': company_name,
            'month': month,
            'generated_on': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'employee': {
                'employee_id': employee['employee_id'],
                'name': employee['full_name'],
                'department': employee['department'],
                'designation': employee['designation'],
                'category': employee['employee_category'],
                'date_of_joining': employee['hire_date']
            },
            'attendance': {
                'working_days': total_working_days,
                'days_worked': payroll['worked_days'],
                'leave_days': payroll['leave_days'],
                'lop_days': 0  # Can be calculated from deduction
            },
            'earnings': {
                'basic_salary': round(basic_salary, 2),
                'hra': round(hra, 2),
                'conveyance_allowance': conveyance,
                'medical_allowance': medical,
                'overtime_pay': round(payroll['overtime_pay'], 2),
                'total_earnings': round(basic_salary + hra + conveyance + medical + payroll['overtime_pay'], 2)
            },
            'deductions': {
                'provident_fund': round(pf, 2),
                'professional_tax': professional_tax,
                'lop_deduction': round(max(0, lop_deduction), 2),
                'total_deductions': round(payroll['deductions'], 2)
            },
            'net_pay': round(payroll['net_pay'], 2)
        }
        
        return jsonify(payslip), 200
        
    except Exception as e:
        logger.error(f"Get payslip error: {e}")
        return jsonify({'error': 'Failed to generate payslip'}), 500


@app.route('/api/employee/payslip', methods=['GET'])
@jwt_required()
def get_my_payslip():
    """Get own payslip (for employees)"""
    try:
        username = get_jwt_identity()
        month = request.args.get('month')
        
        if not month:
            month = datetime.now().strftime('%Y-%m')
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get employee details
        cursor.execute("""
            SELECT u.employee_id, u.full_name, u.email, u.department, u.position, 
                   u.employee_category, u.hire_date, u.salary
            FROM users u WHERE u.username = ? OR u.employee_id = ?
        """, (username, username))
        employee = cursor.fetchone()
        
        if not employee:
            conn.close()
            return jsonify({'error': 'Employee not found'}), 404
        
        # Get payroll data
        cursor.execute("""
            SELECT * FROM payroll WHERE employee_id = ? AND month = ?
        """, (employee['employee_id'], month))
        payroll = cursor.fetchone()
        
        if not payroll:
            conn.close()
            return jsonify({'error': 'Payslip not available for this month'}), 404
        
        # Get company name
        cursor.execute("SELECT setting_value FROM system_settings WHERE setting_key = 'company_name'")
        company_row = cursor.fetchone()
        company_name = company_row['setting_value'] if company_row else 'VES Engineering Services'
        
        basic_salary = payroll['basic_salary']
        hra = basic_salary * 0.1
        conveyance = 1600
        medical = 1250
        pf = basic_salary * 0.12 if basic_salary <= 15000 else 15000 * 0.12
        professional_tax = 200 if basic_salary > 10000 else 0
        
        conn.close()
        
        payslip = {
            'company_name': company_name,
            'month': month,
            'employee': {
                'employee_id': employee['employee_id'],
                'name': employee['full_name'],
                'department': employee['department'],
                'designation': employee['designation']
            },
            'attendance': {
                'days_worked': payroll['worked_days'],
                'leave_days': payroll['leave_days']
            },
            'earnings': {
                'basic_salary': round(basic_salary, 2),
                'hra': round(hra, 2),
                'conveyance_allowance': conveyance,
                'medical_allowance': medical,
                'overtime_pay': round(payroll['overtime_pay'], 2),
                'total_earnings': round(basic_salary + hra + conveyance + medical + payroll['overtime_pay'], 2)
            },
            'deductions': {
                'provident_fund': round(pf, 2),
                'professional_tax': professional_tax,
                'other_deductions': round(max(0, payroll['deductions'] - pf - professional_tax), 2),
                'total_deductions': round(payroll['deductions'], 2)
            },
            'net_pay': round(payroll['net_pay'], 2)
        }
        
        return jsonify(payslip), 200
        
    except Exception as e:
        logger.error(f"Get my payslip error: {e}")
        return jsonify({'error': 'Failed to fetch payslip'}), 500


@app.route('/api/employee/payslip-history', methods=['GET'])
@jwt_required()
def get_payslip_history():
    """Get payslip history for employee"""
    try:
        username = get_jwt_identity()
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT u.employee_id FROM users u WHERE u.username = ? OR u.employee_id = ?
        """, (username, username))
        emp = cursor.fetchone()
        
        if not emp:
            conn.close()
            return jsonify({'error': 'Employee not found'}), 404
        
        cursor.execute("""
            SELECT month, basic_salary, net_pay, processed_at
            FROM payroll 
            WHERE employee_id = ?
            ORDER BY month DESC
            LIMIT 12
        """, (emp['employee_id'],))
        history = cursor.fetchall()
        conn.close()
        
        return jsonify({
            'history': [dict(h) for h in history]
        }), 200
        
    except Exception as e:
        logger.error(f"Get payslip history error: {e}")
        return jsonify({'error': 'Failed to fetch history'}), 500


# Employee Category and Meal Token Routes
@app.route('/api/employee/category', methods=['GET'])
@jwt_required()
def get_employee_category():
    """Get employee category, shift, and leave balance"""
    try:
        username = get_jwt_identity()
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        cursor.execute("""
            SELECT employee_id, employee_category, shift, leave_balance 
            FROM users 
            WHERE username = ? AND is_active = 1
        """, (username,))
        user = cursor.fetchone()
        conn.close()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'employee_id': user['employee_id'],
            'employee_category': user['employee_category'],
            'shift': user['shift'],
            'leave_balance': user['leave_balance']
        }), 200
        
    except Exception as e:
        logger.error(f"Employee category fetch error: {e}")
        return jsonify({'error': 'Failed to fetch employee category'}), 500

@app.route('/api/meal-tokens/today', methods=['GET'])
@jwt_required()
def get_today_meal_token():
    """Get today's meal token status"""
    try:
        username = get_jwt_identity()
        today = datetime.now().date().isoformat()
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        # Get employee_id
        cursor.execute("SELECT employee_id FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        employee_id = user['employee_id']
        
        # Get today's meal token
        cursor.execute("""
            SELECT id, token_date, shift, meal_type, status, generated_at, used_at 
            FROM meal_tokens 
            WHERE employee_id = ? AND token_date = ?
        """, (employee_id, today))
        
        token = cursor.fetchone()
        conn.close()
        
        if token:
            return jsonify({
                'token': dict(token)
            }), 200
        else:
            return jsonify({
                'token': None,
                'message': 'No meal token for today'
            }), 200
        
    except Exception as e:
        logger.error(f"Meal token fetch error: {e}")
        return jsonify({'error': 'Failed to fetch meal token'}), 500

@app.route('/api/meal-tokens/history', methods=['GET'])
@jwt_required()
def get_meal_token_history():
    """Get meal token history for current month"""
    try:
        username = get_jwt_identity()
        days = request.args.get('days', 30, type=int)
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        # Get employee_id
        cursor.execute("SELECT employee_id FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        employee_id = user['employee_id']
        
        # Get token history
        cursor.execute("""
            SELECT id, token_date, shift, meal_type, status, generated_at, used_at 
            FROM meal_tokens 
            WHERE employee_id = ? AND token_date >= date('now', '-' || ? || ' days')
            ORDER BY token_date DESC
        """, (employee_id, days))
        
        tokens = cursor.fetchall()
        conn.close()
        
        # Convert to dict and calculate summary
        tokens_list = [dict(token) for token in tokens]
        issued = len([t for t in tokens_list if t['status'] == 'Issued'])
        used = len([t for t in tokens_list if t['status'] == 'Used'])
        cancelled = len([t for t in tokens_list if t['status'] == 'Cancelled'])
        
        return jsonify({
            'tokens': tokens_list,
            'summary': {
                'total': len(tokens_list),
                'issued': issued,
                'used': used,
                'cancelled': cancelled
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Meal token history error: {e}")
        return jsonify({'error': 'Failed to fetch meal token history'}), 500

@app.route('/api/hr/meal-report', methods=['GET'])
@jwt_required()
def get_hr_meal_report():
    """Get meal report for HR dashboard - all employees"""
    try:
        username = get_jwt_identity()
        date = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Check if user is HR
        cursor.execute("SELECT role FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        if not user or user['role'] not in ['HR', 'Admin', 'MD']:
            conn.close()
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get meal token summary by shift/meal type
        cursor.execute("""
            SELECT 
                mt.meal_type,
                mt.shift,
                mt.status,
                COUNT(*) as count
            FROM meal_tokens mt
            WHERE mt.token_date = ?
            GROUP BY mt.meal_type, mt.shift, mt.status
        """, (date,))
        summary = cursor.fetchall()
        
        # Get category-wise breakdown
        cursor.execute("""
            SELECT 
                u.employee_category,
                COUNT(mt.id) as tokens_issued,
                SUM(CASE WHEN mt.status = 'Used' THEN 1 ELSE 0 END) as tokens_used
            FROM users u
            LEFT JOIN meal_tokens mt ON u.employee_id = mt.employee_id AND mt.token_date = ?
            WHERE u.employee_category IN ('W001', 'M001')
            GROUP BY u.employee_category
        """, (date,))
        category_breakdown = cursor.fetchall()
        
        # Get detailed token list
        cursor.execute("""
            SELECT 
                mt.id,
                mt.employee_id,
                u.name,
                u.employee_category,
                mt.shift,
                mt.meal_type,
                mt.status,
                mt.generated_at,
                mt.used_at
            FROM meal_tokens mt
            JOIN users u ON mt.employee_id = u.employee_id
            WHERE mt.token_date = ?
            ORDER BY mt.generated_at DESC
        """, (date,))
        tokens = cursor.fetchall()
        
        # Calculate shift-wise counts
        breakfast_count = sum(1 for s in summary if s['meal_type'] == 'Breakfast' and s['status'] in ('Issued', 'Used'))
        lunch_count = sum(1 for s in summary if s['meal_type'] == 'Lunch' and s['status'] in ('Issued', 'Used'))
        dinner_count = sum(1 for s in summary if s['meal_type'] == 'Dinner' and s['status'] in ('Issued', 'Used'))
        
        conn.close()
        
        return jsonify({
            'date': date,
            'meal_summary': {
                'breakfast': breakfast_count,
                'lunch': lunch_count,
                'dinner': dinner_count,
                'total': breakfast_count + lunch_count + dinner_count
            },
            'category_breakdown': [dict(c) for c in category_breakdown],
            'tokens': [dict(t) for t in tokens]
        }), 200
        
    except Exception as e:
        logger.error(f"HR meal report error: {e}")
        return jsonify({'error': 'Failed to fetch meal report'}), 500

@app.route('/api/meal-tokens/generate', methods=['POST'])
@jwt_required()
def generate_meal_token():
    """Generate a meal token for the current user"""
    try:
        username = get_jwt_identity()
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get user details
        cursor.execute("""
            SELECT employee_id, employee_category, shift, name 
            FROM users WHERE username = ?
        """, (username,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        # Check if eligible for meal tokens
        if user['employee_category'] not in ('W001', 'M001'):
            conn.close()
            return jsonify({'error': 'Your category is not eligible for meal tokens'}), 403
        
        employee_id = user['employee_id']
        shift = user['shift'] or 1
        
        # Determine meal type based on shift
        meal_type_map = {1: 'Lunch', 2: 'Dinner', 3: 'Breakfast'}
        meal_type = meal_type_map.get(shift, 'Lunch')
        
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Check if token already exists for today
        cursor.execute("""
            SELECT id, status FROM meal_tokens 
            WHERE employee_id = ? AND token_date = ?
        """, (employee_id, today))
        existing = cursor.fetchone()
        
        if existing:
            conn.close()
            return jsonify({
                'error': 'Token already exists for today',
                'token_id': existing['id'],
                'status': existing['status']
            }), 409
        
        # Generate token
        token_id = f"MTK-{today.replace('-', '')}-{employee_id}"
        
        cursor.execute("""
            INSERT INTO meal_tokens (employee_id, token_date, shift, meal_type, status, generated_at)
            VALUES (?, ?, ?, ?, 'Issued', datetime('now'))
        """, (employee_id, today, shift, meal_type))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Token generated successfully',
            'token': {
                'token_id': token_id,
                'employee_name': user['name'],
                'date': today,
                'shift': shift,
                'meal_type': meal_type,
                'status': 'Issued'
            }
        }), 201
        
    except Exception as e:
        logger.error(f"Token generation error: {e}")
        return jsonify({'error': 'Failed to generate meal token'}), 500

@app.route('/api/meal-tokens/mark-used/<int:token_id>', methods=['PUT'])
@jwt_required()
def mark_token_used(token_id):
    """Mark a meal token as used (HR only or self)"""
    try:
        username = get_jwt_identity()
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get user role
        cursor.execute("SELECT role, employee_id FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        # Get token details
        cursor.execute("SELECT * FROM meal_tokens WHERE id = ?", (token_id,))
        token = cursor.fetchone()
        
        if not token:
            conn.close()
            return jsonify({'error': 'Token not found'}), 404
        
        # Check authorization (HR/Admin or token owner)
        if user['role'] not in ('HR', 'Admin', 'MD') and token['employee_id'] != user['employee_id']:
            conn.close()
            return jsonify({'error': 'Unauthorized'}), 403
        
        if token['status'] == 'Used':
            conn.close()
            return jsonify({'error': 'Token already used'}), 409
        
        if token['status'] == 'Cancelled':
            conn.close()
            return jsonify({'error': 'Cannot use a cancelled token'}), 409
        
        # Mark as used
        cursor.execute("""
            UPDATE meal_tokens 
            SET status = 'Used', used_at = datetime('now')
            WHERE id = ?
        """, (token_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Token marked as used'}), 200
        
    except Exception as e:
        logger.error(f"Mark token used error: {e}")
        return jsonify({'error': 'Failed to update token'}), 500


# ============== ADMIN SETTINGS API ==============

@app.route('/api/admin/settings', methods=['GET'])
@jwt_required()
def get_settings():
    """Get all system settings (Admin/HR only)"""
    try:
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        if user_role not in ('HR', 'Admin', 'MD'):
            return jsonify({'error': 'Unauthorized'}), 403
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        cursor.execute("SELECT setting_key, setting_value, description, updated_at FROM system_settings")
        settings = cursor.fetchall()
        conn.close()
        
        # Convert to dict, mask password
        settings_dict = {}
        for s in settings:
            value = s['setting_value']
            if 'password' in s['setting_key'].lower() and value:
                value = '••••••••'  # Mask password
            settings_dict[s['setting_key']] = {
                'value': value,
                'description': s['description'],
                'updated_at': s['updated_at']
            }
        
        return jsonify({'settings': settings_dict}), 200
        
    except Exception as e:
        logger.error(f"Get settings error: {e}")
        return jsonify({'error': 'Failed to fetch settings'}), 500


@app.route('/api/admin/settings', methods=['PUT'])
@jwt_required()
def update_settings():
    """Update system settings (Admin/HR only)"""
    try:
        username = get_jwt_identity()
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        if user_role not in ('HR', 'Admin', 'MD'):
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        settings_to_update = data.get('settings', {})
        
        if not settings_to_update:
            return jsonify({'error': 'No settings provided'}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        for key, value in settings_to_update.items():
            # Don't update password if it's masked
            if 'password' in key.lower() and value == '••••••••':
                continue
            
            cursor.execute("""
                UPDATE system_settings 
                SET setting_value = ?, updated_by = ?, updated_at = datetime('now')
                WHERE setting_key = ?
            """, (value, username, key))
        
        conn.commit()
        conn.close()
        
        audit_log('SETTINGS_UPDATED', username, {'keys': list(settings_to_update.keys())})
        
        return jsonify({'message': 'Settings updated successfully'}), 200
        
    except Exception as e:
        logger.error(f"Update settings error: {e}")
        return jsonify({'error': 'Failed to update settings'}), 500


@app.route('/api/admin/settings/test-email', methods=['POST'])
@jwt_required()
def test_email_settings():
    """Send a test email to verify SMTP configuration"""
    try:
        username = get_jwt_identity()
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', '')
        
        if user_role not in ('HR', 'Admin', 'MD'):
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        test_email = data.get('email', jwt_claims.get('email', ''))
        
        if not test_email:
            return jsonify({'error': 'Test email address required'}), 400
        
        config = get_email_config()
        company_name = config['COMPANY_NAME']
        
        # Send test email
        subject = f"{company_name} HRMS - Email Configuration Test"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px; padding: 30px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #A020F0;">{company_name}</h1>
                    <p style="color: #666;">Email Configuration Test</p>
                </div>
                
                <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #155724; margin: 0;">✅ Email Configuration Successful!</h3>
                </div>
                
                <p>This is a test email to verify that your SMTP settings are configured correctly.</p>
                
                <p><strong>Settings Used:</strong></p>
                <ul>
                    <li>SMTP Server: {config['SMTP_SERVER']}</li>
                    <li>SMTP Port: {config['SMTP_PORT']}</li>
                    <li>From Email: {config['SMTP_EMAIL']}</li>
                </ul>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                
                <p style="color: #888; font-size: 12px;">
                    Test sent by: {username}<br>
                    Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
                </p>
            </div>
        </body>
        </html>
        """
        
        success = send_email(test_email, subject, html_content)
        
        if success:
            audit_log('EMAIL_TEST_SENT', username, {'to': test_email})
            return jsonify({
                'message': f'Test email sent successfully to {test_email}',
                'success': True
            }), 200
        else:
            return jsonify({
                'error': 'Failed to send test email. Check SMTP settings.',
                'success': False
            }), 400
        
    except Exception as e:
        logger.error(f"Test email error: {e}")
        return jsonify({'error': f'Email test failed: {str(e)}'}), 500


# ============================================================
# DOCUMENT UPLOAD MANAGEMENT ENDPOINTS
# ============================================================

def init_documents_table():
    """Initialize employee_documents table if it doesn't exist"""
    try:
        conn = get_db_connection()
        if not conn:
            return False
        
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS employee_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id TEXT NOT NULL,
                document_type TEXT NOT NULL,
                document_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER,
                upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'Pending',
                notes TEXT,
                FOREIGN KEY (employee_id) REFERENCES users(employee_id)
            )
        ''')
        conn.commit()
        conn.close()
        logger.info("employee_documents table initialized")
        return True
    except Exception as e:
        logger.error(f"Error initializing documents table: {e}")
        return False

# Initialize documents table on startup
init_documents_table()

ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_employee_folder(employee_id, employee_name):
    """Get or create employee-specific folder"""
    # Sanitize employee name
    safe_name = "".join(c for c in employee_name if c.isalnum() or c in (' ', '_')).strip().replace(' ', '_')
    folder_name = f"{safe_name}_{employee_id}"
    folder_path = os.path.join(app.config['UPLOAD_FOLDER'], folder_name)
    
    # Create folder if it doesn't exist
    os.makedirs(folder_path, exist_ok=True)
    
    return folder_path, folder_name

@app.route('/api/employee/documents/upload', methods=['POST'])
@jwt_required()
def upload_document():
    """Upload employee document"""
    try:
        current_user = get_jwt_identity()
        claims = get_jwt()
        
        # Get employee details
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        cursor.execute(
            "SELECT employee_id, full_name FROM users WHERE username = ?",
            (current_user,)
        )
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        employee_id = user['employee_id']
        employee_name = user['full_name']
        
        # Check if file is present
        if 'file' not in request.files:
            conn.close()
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        document_type = request.form.get('document_type', 'Other')
        notes = request.form.get('notes', '')
        
        if file.filename == '':
            conn.close()
            return jsonify({'error': 'No file selected'}), 400
        
        # Validate file
        if not allowed_file(file.filename):
            conn.close()
            return jsonify({'error': 'File type not allowed. Allowed: PDF, PNG, JPG, JPEG, DOC, DOCX'}), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            conn.close()
            return jsonify({'error': f'File too large. Maximum size: {MAX_FILE_SIZE / (1024*1024)}MB'}), 400
        
        # Get employee folder
        folder_path, folder_name = get_employee_folder(employee_id, employee_name)
        
        # Secure filename
        filename = secure_filename(file.filename)
        
        # Add timestamp to avoid conflicts
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        name, ext = os.path.splitext(filename)
        unique_filename = f"{name}_{timestamp}{ext}"
        
        file_path = os.path.join(folder_path, unique_filename)
        
        # Save file
        file.save(file_path)
        
        # Store in database
        relative_path = os.path.join(folder_name, unique_filename)
        cursor.execute('''
            INSERT INTO employee_documents 
            (employee_id, document_type, document_name, file_path, file_size, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (employee_id, document_type, filename, relative_path, file_size, notes))
        
        conn.commit()
        document_id = cursor.lastrowid
        conn.close()
        
        audit_log('DOCUMENT_UPLOADED', current_user, {
            'document_id': document_id,
            'document_type': document_type,
            'filename': filename,
            'size': file_size
        })
        
        return jsonify({
            'message': 'Document uploaded successfully',
            'document_id': document_id,
            'filename': filename
        }), 201
        
    except Exception as e:
        logger.error(f"Document upload error: {e}")
        return jsonify({'error': 'Document upload failed'}), 500

@app.route('/api/employee/documents', methods=['GET'])
@jwt_required()
def get_employee_documents():
    """Get all documents for current employee"""
    try:
        current_user = get_jwt_identity()
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get employee_id
        cursor.execute("SELECT employee_id FROM users WHERE username = ?", (current_user,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        employee_id = user['employee_id']
        
        # Get documents
        cursor.execute('''
            SELECT id, document_type, document_name, file_size, upload_date, status, notes
            FROM employee_documents
            WHERE employee_id = ?
            ORDER BY upload_date DESC
        ''', (employee_id,))
        
        documents = []
        for row in cursor.fetchall():
            documents.append({
                'id': row['id'],
                'document_type': row['document_type'],
                'document_name': row['document_name'],
                'file_size': row['file_size'],
                'upload_date': row['upload_date'],
                'status': row['status'],
                'notes': row['notes']
            })
        
        conn.close()
        
        return jsonify({'documents': documents}), 200
        
    except Exception as e:
        logger.error(f"Get documents error: {e}")
        return jsonify({'error': 'Failed to retrieve documents'}), 500

@app.route('/api/employee/documents/<int:document_id>', methods=['GET'])
@jwt_required()
def download_document(document_id):
    """Download a specific document"""
    try:
        current_user = get_jwt_identity()
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get employee_id
        cursor.execute("SELECT employee_id, role FROM users WHERE username = ?", (current_user,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        # Get document
        cursor.execute('''
            SELECT employee_id, document_name, file_path
            FROM employee_documents
            WHERE id = ?
        ''', (document_id,))
        
        document = cursor.fetchone()
        conn.close()
        
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Check permissions - employee can only download their own, HR/Admin can download all
        if user['role'] == 'Employee' and document['employee_id'] != user['employee_id']:
            return jsonify({'error': 'Access denied'}), 403
        
        # Send file
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], document['file_path'])
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found on server'}), 404
        
        audit_log('DOCUMENT_DOWNLOADED', current_user, {
            'document_id': document_id,
            'filename': document['document_name']
        })
        
        return send_from_directory(
            os.path.dirname(file_path),
            os.path.basename(file_path),
            as_attachment=True,
            download_name=document['document_name']
        )
        
    except Exception as e:
        logger.error(f"Document download error: {e}")
        return jsonify({'error': 'Document download failed'}), 500

@app.route('/api/employee/documents/<int:document_id>', methods=['DELETE'])
@jwt_required()
def delete_document(document_id):
    """Delete a document"""
    try:
        current_user = get_jwt_identity()
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get employee_id
        cursor.execute("SELECT employee_id, role FROM users WHERE username = ?", (current_user,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        # Get document
        cursor.execute('''
            SELECT employee_id, file_path, document_name
            FROM employee_documents
            WHERE id = ?
        ''', (document_id,))
        
        document = cursor.fetchone()
        
        if not document:
            conn.close()
            return jsonify({'error': 'Document not found'}), 404
        
        # Check permissions - employee can only delete their own, HR/Admin can delete all
        if user['role'] == 'Employee' and document['employee_id'] != user['employee_id']:
            conn.close()
            return jsonify({'error': 'Access denied'}), 403
        
        # Delete file from filesystem
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], document['file_path'])
        if os.path.exists(file_path):
            os.remove(file_path)
        
        # Delete from database
        cursor.execute('DELETE FROM employee_documents WHERE id = ?', (document_id,))
        conn.commit()
        conn.close()
        
        audit_log('DOCUMENT_DELETED', current_user, {
            'document_id': document_id,
            'filename': document['document_name']
        })
        
        return jsonify({'message': 'Document deleted successfully'}), 200
        
    except Exception as e:
        logger.error(f"Document delete error: {e}")
        return jsonify({'error': 'Document deletion failed'}), 500

@app.route('/api/hr/documents', methods=['GET'])
@jwt_required()
def get_all_documents():
    """Get all documents for HR/Admin"""
    try:
        current_user = get_jwt_identity()
        claims = get_jwt()
        
        # Only HR and Admin can access
        if claims.get('role') not in ['HR', 'Admin']:
            return jsonify({'error': 'Access denied'}), 403
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get all documents with employee info
        cursor.execute('''
            SELECT d.id, d.employee_id, d.document_type, d.document_name, 
                   d.file_size, d.upload_date, d.status, d.notes,
                   u.full_name, u.department
            FROM employee_documents d
            JOIN users u ON d.employee_id = u.employee_id
            ORDER BY d.upload_date DESC
        ''')
        
        documents = []
        for row in cursor.fetchall():
            documents.append({
                'id': row['id'],
                'employee_id': row['employee_id'],
                'employee_name': row['full_name'],
                'department': row['department'],
                'document_type': row['document_type'],
                'document_name': row['document_name'],
                'file_size': row['file_size'],
                'upload_date': row['upload_date'],
                'status': row['status'],
                'notes': row['notes']
            })
        
        conn.close()
        
        return jsonify({'documents': documents}), 200
        
    except Exception as e:
        logger.error(f"Get all documents error: {e}")
        return jsonify({'error': 'Failed to retrieve documents'}), 500

@app.route('/api/hr/documents/<int:document_id>/approve', methods=['PUT'])
@jwt_required()
def approve_document(document_id):
    """Approve/Reject a document (HR/Admin only)"""
    try:
        current_user = get_jwt_identity()
        claims = get_jwt()
        
        # Only HR and Admin can approve
        if claims.get('role') not in ['HR', 'Admin']:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        status = data.get('status', 'Approved')  # 'Approved' or 'Rejected'
        notes = data.get('notes', '')
        
        if status not in ['Approved', 'Rejected']:
            return jsonify({'error': 'Invalid status'}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Update document status
        cursor.execute('''
            UPDATE employee_documents
            SET status = ?, notes = ?
            WHERE id = ?
        ''', (status, notes, document_id))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'Document not found'}), 404
        
        conn.commit()
        conn.close()
        
        audit_log(f'DOCUMENT_{status.upper()}', current_user, {
            'document_id': document_id,
            'notes': notes
        })
        
        return jsonify({
            'message': f'Document {status.lower()} successfully',
            'status': status
        }), 200
        
    except Exception as e:
        logger.error(f"Document approval error: {e}")
        return jsonify({'error': 'Document approval failed'}), 500


if __name__ == '__main__':
    print("🚀 VES HRMS Backend Starting...")
    print("📍 Backend URL: http://localhost:5000")
    print("🔐 Login Credentials:")
    print("   Admin:    admin / admin123")
    print("   HR:       hr_manager / hr123")
    print("   Employee: Use employee username from Excel (lowercase name without spaces)")
    print("")
    print("🌟 Role-Morphing Dashboards Ready!")
    print("💜 Employee Dashboard: Purple Theme")
    print("💙 HR Dashboard: Blue Theme") 
    print("="*50)


# ============== PUNCH IN/OUT DATA ENDPOINTS ==============

@app.route('/api/punch-records', methods=['GET'])
@jwt_required()
def get_punch_records():
    """
    Get punch in/out records from CheckInOut_DB.db
    Employee: Get own records only
    HR/Admin: Get all records with optional filters
    
    Query Parameters:
    - employee_id: Filter by employee (HR/Admin only)
    - date_from: Start date (YYYY-MM-DD)
    - date_to: End date (YYYY-MM-DD)
    - limit: Number of records to return (default: 50)
    """
    try:
        current_user = get_jwt_identity()
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get user details
        cursor.execute("SELECT employee_id, role FROM users WHERE username = ?", (current_user,))
        user_data = cursor.fetchone()
        
        if not user_data:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        user_employee_id = user_data['employee_id']
        user_role = user_data['role']
        
        # Parse query parameters
        filter_employee_id = request.args.get('employee_id')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        limit = request.args.get('limit', 50, type=int)
        
        # Access control: Employees can only see their own records
        if user_role == 'Employee':
            filter_employee_id = user_employee_id
        
        # Connect to CheckInOut_DB
        checkinout_conn = get_checkinout_db_connection()
        if not checkinout_conn:
            conn.close()
            return jsonify({'error': 'Could not connect to punch records database'}), 500
        
        checkinout_cursor = checkinout_conn.cursor()
        
        # Build query with filters
        query = "SELECT * FROM Punch_Tym WHERE 1=1"
        params = []
        
        if filter_employee_id:
            query += " AND employee_id = ?"
            params.append(filter_employee_id)
        
        if date_from:
            query += " AND punch_date >= ?"
            params.append(date_from)
        
        if date_to:
            query += " AND punch_date <= ?"
            params.append(date_to)
        
        query += " ORDER BY punch_date DESC, employee_id LIMIT ?"
        params.append(limit)
        
        checkinout_cursor.execute(query, params)
        rows = checkinout_cursor.fetchall()
        
        # Convert to list of dicts
        punch_records = []
        for row in rows:
            punch_records.append({
                'id': row['id'],
                'employee_id': row['employee_id'],
                'employee_name': row['employee_name'],
                'punch_date': row['punch_date'],
                'punch_in_time': row['punch_in_time'],
                'punch_out_time': row['punch_out_time'],
                'total_hours': row['total_hours'],
                'status': row['status'],
                'late_entry': row['late_entry'],
                'early_exit': row['early_exit'],
                'overtime_hours': row['overtime_hours'],
                'remarks': row['remarks']
            })
        
        checkinout_conn.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'records': punch_records,
            'total': len(punch_records)
        })
        
    except Exception as e:
        logger.error(f"Fetch punch records error: {e}", extra={'user': current_user, 'ip': get_client_ip(), 'endpoint': '/api/punch-records'})
        return jsonify({'error': str(e)}), 500


@app.route('/api/punch-records/summary', methods=['GET'])
@jwt_required()
def get_punch_summary():
    """
    Get summary statistics of punch records for current user or all employees
    Shows present/absent days, total hours, etc.
    """
    try:
        current_user = get_jwt_identity()
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get user details
        cursor.execute("SELECT employee_id, role FROM users WHERE username = ?", (current_user,))
        user_data = cursor.fetchone()
        
        if not user_data:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        user_employee_id = user_data['employee_id']
        user_role = user_data['role']
        
        # Connect to CheckInOut_DB
        checkinout_conn = get_checkinout_db_connection()
        if not checkinout_conn:
            conn.close()
            return jsonify({'error': 'Could not connect to punch records database'}), 500
        
        checkinout_cursor = checkinout_conn.cursor()
        
        # Get current month stats for employee
        from datetime import datetime
        current_month = datetime.now().strftime('%Y-%m')
        
        if user_role == 'Employee':
            # Employee sees only their own summary
            checkinout_cursor.execute("""
                SELECT 
                    COUNT(*) as total_days,
                    SUM(CASE WHEN punch_in_time IS NOT NULL THEN 1 ELSE 0 END) as present_days,
                    SUM(CASE WHEN late_entry = 1 THEN 1 ELSE 0 END) as late_days,
                    SUM(CASE WHEN early_exit = 1 THEN 1 ELSE 0 END) as early_exits,
                    ROUND(SUM(total_hours), 2) as total_hours,
                    ROUND(SUM(overtime_hours), 2) as overtime_hours
                FROM Punch_Tym
                WHERE employee_id = ? AND punch_date LIKE ?
            """, (user_employee_id, f'{current_month}%'))
        else:
            # HR/Admin sees organization summary
            checkinout_cursor.execute("""
                SELECT 
                    COUNT(DISTINCT employee_id) as total_employees,
                    COUNT(*) as total_records,
                    SUM(CASE WHEN punch_in_time IS NOT NULL THEN 1 ELSE 0 END) as present_count,
                    SUM(CASE WHEN late_entry = 1 THEN 1 ELSE 0 END) as late_count,
                    ROUND(AVG(total_hours), 2) as avg_hours_per_day
                FROM Punch_Tym
                WHERE punch_date LIKE ?
            """, (f'{current_month}%',))
        
        result = checkinout_cursor.fetchone()
        
        checkinout_conn.close()
        conn.close()
        
        if user_role == 'Employee':
            summary = {
                'total_days': result[0] or 0,
                'present_days': result[1] or 0,
                'late_days': result[2] or 0,
                'early_exits': result[3] or 0,
                'total_hours': result[4] or 0.0,
                'overtime_hours': result[5] or 0.0,
                'month': current_month
            }
        else:
            summary = {
                'total_employees': result[0] or 0,
                'total_records': result[1] or 0,
                'present_count': result[2] or 0,
                'late_count': result[3] or 0,
                'avg_hours_per_day': result[4] or 0.0,
                'month': current_month
            }
        
        return jsonify({
            'success': True,
            'summary': summary
        })
        
    except Exception as e:
        logger.error(f"Fetch punch summary error: {e}", extra={'user': current_user, 'ip': get_client_ip(), 'endpoint': '/api/punch-records/summary'})
        return jsonify({'error': str(e)}), 500


@app.route('/api/punch-records/checkin', methods=['POST'])
@jwt_required()
def punch_check_in():
    """Employee check-in (punch in)"""
    try:
        current_user = get_jwt_identity()
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get user details
        cursor.execute("SELECT employee_id, full_name FROM users WHERE username = ?", (current_user,))
        user_data = cursor.fetchone()
        
        if not user_data:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        employee_id = user_data['employee_id']
        employee_name = user_data['full_name']
        
        # Connect to CheckInOut_DB
        checkinout_conn = get_checkinout_db_connection()
        if not checkinout_conn:
            conn.close()
            return jsonify({'error': 'Could not connect to punch records database'}), 500
        
        checkinout_cursor = checkinout_conn.cursor()
        
        # Check if already checked in today
        from datetime import datetime
        today = datetime.now().strftime('%Y-%m-%d')
        current_time = datetime.now().strftime('%H:%M:%S')
        
        checkinout_cursor.execute("""
            SELECT id, punch_in_time FROM Punch_Tym
            WHERE employee_id = ? AND punch_date = ?
        """, (employee_id, today))
        
        existing = checkinout_cursor.fetchone()
        
        if existing and existing[1]:
            checkinout_conn.close()
            conn.close()
            return jsonify({
                'error': 'Already checked in today',
                'punch_in_time': existing[1]
            }), 400
        
        # Determine if late (assuming 8:30 AM is the cutoff)
        late_entry = 1 if current_time > '08:30:00' else 0
        
        if existing:
            # Update existing record
            checkinout_cursor.execute("""
                UPDATE Punch_Tym
                SET punch_in_time = ?, late_entry = ?, updated_at = ?
                WHERE id = ?
            """, (current_time, late_entry, datetime.now().isoformat(), existing[0]))
        else:
            # Create new record
            checkinout_cursor.execute("""
                INSERT INTO Punch_Tym 
                (employee_id, employee_name, punch_date, punch_in_time, status, late_entry)
                VALUES (?, ?, ?, ?, 'Present', ?)
            """, (employee_id, employee_name, today, current_time, late_entry))
        
        checkinout_conn.commit()
        checkinout_conn.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Checked in successfully',
            'punch_in_time': current_time,
            'late_entry': late_entry == 1,
            'date': today
        }), 200
        
    except Exception as e:
        logger.error(f"Punch check-in error: {e}", extra={'user': current_user, 'ip': get_client_ip(), 'endpoint': '/api/punch-records/checkin'})
        return jsonify({'error': str(e)}), 500


@app.route('/api/punch-records/checkout', methods=['POST'])
@jwt_required()
def punch_check_out():
    """Employee check-out (punch out)"""
    try:
        current_user = get_jwt_identity()
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get user details
        cursor.execute("SELECT employee_id FROM users WHERE username = ?", (current_user,))
        user_data = cursor.fetchone()
        
        if not user_data:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        employee_id = user_data['employee_id']
        
        # Connect to CheckInOut_DB
        checkinout_conn = get_checkinout_db_connection()
        if not checkinout_conn:
            conn.close()
            return jsonify({'error': 'Could not connect to punch records database'}), 500
        
        checkinout_cursor = checkinout_conn.cursor()
        
        # Get today's check-in record
        from datetime import datetime
        today = datetime.now().strftime('%Y-%m-%d')
        current_time = datetime.now().strftime('%H:%M:%S')
        
        checkinout_cursor.execute("""
            SELECT id, punch_in_time, punch_out_time FROM Punch_Tym
            WHERE employee_id = ? AND punch_date = ?
        """, (employee_id, today))
        
        record = checkinout_cursor.fetchone()
        
        if not record:
            checkinout_conn.close()
            conn.close()
            return jsonify({'error': 'No check-in record found for today. Please check in first.'}), 400
        
        if not record[1]:
            checkinout_conn.close()
            conn.close()
            return jsonify({'error': 'No check-in time found. Please check in first.'}), 400
        
        if record[2]:
            checkinout_conn.close()
            conn.close()
            return jsonify({
                'error': 'Already checked out today',
                'punch_out_time': record[2]
            }), 400
        
        # Calculate total hours
        punch_in = datetime.strptime(record[1], '%H:%M:%S')
        punch_out = datetime.strptime(current_time, '%H:%M:%S')
        total_seconds = (punch_out - punch_in).total_seconds()
        total_hours = round(total_seconds / 3600, 2)
        
        # Determine early exit (assuming 5:00 PM is standard)
        early_exit = 1 if current_time < '17:00:00' else 0
        
        # Calculate overtime (if worked more than 9 hours)
        overtime_hours = max(0, total_hours - 9)
        
        # Update record
        checkinout_cursor.execute("""
            UPDATE Punch_Tym
            SET punch_out_time = ?, total_hours = ?, early_exit = ?, 
                overtime_hours = ?, updated_at = ?
            WHERE id = ?
        """, (current_time, total_hours, early_exit, overtime_hours, 
              datetime.now().isoformat(), record[0]))
        
        checkinout_conn.commit()
        checkinout_conn.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Checked out successfully',
            'punch_in_time': record[1],
            'punch_out_time': current_time,
            'total_hours': total_hours,
            'overtime_hours': overtime_hours,
            'early_exit': early_exit == 1,
            'date': today
        }), 200
        
    except Exception as e:
        logger.error(f"Punch check-out error: {e}", extra={'user': current_user, 'ip': get_client_ip(), 'endpoint': '/api/punch-records/checkout'})
        return jsonify({'error': str(e)}), 500


@app.route('/api/punch-records/today', methods=['GET'])
@jwt_required()
def get_today_punch():
    """Get today's punch record for current user"""
    try:
        current_user = get_jwt_identity()
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get user details
        cursor.execute("SELECT employee_id FROM users WHERE username = ?", (current_user,))
        user_data = cursor.fetchone()
        
        if not user_data:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        employee_id = user_data['employee_id']
        
        # Connect to CheckInOut_DB
        checkinout_conn = get_checkinout_db_connection()
        if not checkinout_conn:
            conn.close()
            return jsonify({'error': 'Could not connect to punch records database'}), 500
        
        checkinout_cursor = checkinout_conn.cursor()
        
        # Get today's record
        from datetime import datetime
        today = datetime.now().strftime('%Y-%m-%d')
        
        checkinout_cursor.execute("""
            SELECT * FROM Punch_Tym
            WHERE employee_id = ? AND punch_date = ?
        """, (employee_id, today))
        
        record = checkinout_cursor.fetchone()
        
        checkinout_conn.close()
        conn.close()
        
        if record:
            return jsonify({
                'success': True,
                'record': {
                    'id': record['id'],
                    'employee_id': record['employee_id'],
                    'employee_name': record['employee_name'],
                    'punch_date': record['punch_date'],
                    'punch_in_time': record['punch_in_time'],
                    'punch_out_time': record['punch_out_time'],
                    'total_hours': record['total_hours'],
                    'status': record['status'],
                    'late_entry': record['late_entry'],
                    'early_exit': record['early_exit'],
                    'overtime_hours': record['overtime_hours']
                }
            })
        else:
            return jsonify({
                'success': True,
                'record': None,
                'message': 'No punch record for today'
            })
        
    except Exception as e:
        logger.error(f"Get today punch error: {e}", extra={'user': current_user, 'ip': get_client_ip(), 'endpoint': '/api/punch-records/today'})
        return jsonify({'error': str(e)}), 500


# ============== END PUNCH IN/OUT DATA ENDPOINTS ==============


if __name__ == '__main__':
    app.run(
        debug=os.environ.get('FLASK_ENV') == 'development', 
        host='0.0.0.0', 
        port=5000,
        threaded=True
    )