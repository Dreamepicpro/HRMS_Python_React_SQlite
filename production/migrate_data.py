# ============================================================
# VES HRMS - Data Migration Script
# Migrate data from SQLite (development) to SQL Server (production)
# ============================================================
# 
# USAGE:
# 1. Ensure SQL Server database is created with init_sqlserver.sql
# 2. Update connection details below
# 3. Run: python migrate_data.py
# ============================================================

import sqlite3
import pyodbc
import os
from datetime import datetime

# ============================================================
# CONFIGURATION - UPDATE THESE VALUES
# ============================================================

# Source: SQLite database path
SQLITE_PATH = r'C:\Users\amurugai\Documents\VesHRMS\ves_hrms.db'

# Target: SQL Server connection
SQLSERVER_CONFIG = {
    'server': 'localhost',          # e.g., 'SERVER\\SQLEXPRESS' or 'localhost'
    'database': 'VES_HRMS',
    'username': 'ves_hrms_app',     # SQL Server login
    'password': 'YourPassword123!', # SQL Server password
    'driver': 'ODBC Driver 17 for SQL Server'
}

# Tables to migrate (in order to handle foreign keys)
TABLES_TO_MIGRATE = [
    'users',
    'attendance',
    'leaves',
    'leave_balance',
    'documents',
    'payroll',
    'audit_logs',
    'meal_tokens',
    'custom_requests',
    'system_settings',
    'password_reset_tokens',
]

# ============================================================
# MIGRATION FUNCTIONS
# ============================================================

def get_sqlite_connection():
    """Connect to SQLite database"""
    if not os.path.exists(SQLITE_PATH):
        print(f"❌ SQLite database not found: {SQLITE_PATH}")
        return None
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_sqlserver_connection():
    """Connect to SQL Server database"""
    try:
        conn_str = (
            f"DRIVER={{{SQLSERVER_CONFIG['driver']}}};"
            f"SERVER={SQLSERVER_CONFIG['server']};"
            f"DATABASE={SQLSERVER_CONFIG['database']};"
            f"UID={SQLSERVER_CONFIG['username']};"
            f"PWD={SQLSERVER_CONFIG['password']};"
            "TrustServerCertificate=yes;"
        )
        return pyodbc.connect(conn_str)
    except pyodbc.Error as e:
        print(f"❌ SQL Server connection error: {e}")
        return None

def get_table_columns(sqlite_cursor, table_name):
    """Get column names from SQLite table"""
    sqlite_cursor.execute(f"PRAGMA table_info({table_name})")
    return [row[1] for row in sqlite_cursor.fetchall()]

def migrate_table(sqlite_conn, sqlserver_conn, table_name):
    """Migrate a single table from SQLite to SQL Server"""
    print(f"\n📋 Migrating table: {table_name}")
    
    sqlite_cursor = sqlite_conn.cursor()
    sqlserver_cursor = sqlserver_conn.cursor()
    
    # Get columns
    columns = get_table_columns(sqlite_cursor, table_name)
    if not columns:
        print(f"   ⚠️ Table {table_name} not found in SQLite")
        return 0
    
    # Skip 'id' column (auto-increment in SQL Server)
    columns_without_id = [c for c in columns if c.lower() != 'id']
    
    # Read data from SQLite
    sqlite_cursor.execute(f"SELECT * FROM {table_name}")
    rows = sqlite_cursor.fetchall()
    
    if not rows:
        print(f"   ℹ️ No data in {table_name}")
        return 0
    
    # Prepare INSERT statement for SQL Server
    placeholders = ', '.join(['?' for _ in columns_without_id])
    columns_str = ', '.join(columns_without_id)
    
    # Enable identity insert for tables with id
    try:
        sqlserver_cursor.execute(f"SET IDENTITY_INSERT {table_name} ON")
    except:
        pass
    
    # Insert rows
    migrated = 0
    for row in rows:
        try:
            # Get values (excluding id)
            values = []
            for col in columns_without_id:
                idx = columns.index(col)
                val = row[idx]
                # Handle None values
                if val is None:
                    values.append(None)
                else:
                    values.append(val)
            
            insert_sql = f"INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders})"
            sqlserver_cursor.execute(insert_sql, values)
            migrated += 1
        except pyodbc.Error as e:
            print(f"   ⚠️ Error inserting row: {e}")
    
    # Disable identity insert
    try:
        sqlserver_cursor.execute(f"SET IDENTITY_INSERT {table_name} OFF")
    except:
        pass
    
    sqlserver_conn.commit()
    print(f"   ✅ Migrated {migrated}/{len(rows)} rows")
    return migrated

def main():
    print("=" * 60)
    print("VES HRMS - Data Migration: SQLite → SQL Server")
    print("=" * 60)
    print(f"\nSource: {SQLITE_PATH}")
    print(f"Target: {SQLSERVER_CONFIG['server']}/{SQLSERVER_CONFIG['database']}")
    print("\n⚠️ WARNING: This will insert data into SQL Server.")
    print("   Existing data may cause duplicate key errors.\n")
    
    confirm = input("Continue? (yes/no): ")
    if confirm.lower() != 'yes':
        print("Migration cancelled.")
        return
    
    # Connect to databases
    print("\n🔌 Connecting to databases...")
    sqlite_conn = get_sqlite_connection()
    if not sqlite_conn:
        return
    print("   ✅ SQLite connected")
    
    sqlserver_conn = get_sqlserver_connection()
    if not sqlserver_conn:
        sqlite_conn.close()
        return
    print("   ✅ SQL Server connected")
    
    # Migrate tables
    total_migrated = 0
    start_time = datetime.now()
    
    for table in TABLES_TO_MIGRATE:
        try:
            count = migrate_table(sqlite_conn, sqlserver_conn, table)
            total_migrated += count
        except Exception as e:
            print(f"   ❌ Error migrating {table}: {e}")
    
    # Cleanup
    sqlite_conn.close()
    sqlserver_conn.close()
    
    # Summary
    duration = (datetime.now() - start_time).seconds
    print("\n" + "=" * 60)
    print("Migration Complete!")
    print(f"Total rows migrated: {total_migrated}")
    print(f"Duration: {duration} seconds")
    print("=" * 60)

if __name__ == '__main__':
    main()
