# ============================================================
# SQL Syntax Differences: SQLite vs SQL Server
# Quick Reference for VES HRMS Migration
# ============================================================
#
# Most queries work in both databases, but some need changes.
# This file documents the differences you might encounter.
# ============================================================

# ============================================================
# 1. AUTO INCREMENT / IDENTITY
# ============================================================

# SQLite:
# CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, ...)

# SQL Server:
# CREATE TABLE users (id INT IDENTITY(1,1) PRIMARY KEY, ...)


# ============================================================
# 2. DATE/TIME FUNCTIONS
# ============================================================

# Current timestamp
# SQLite:     datetime('now') or CURRENT_TIMESTAMP
# SQL Server: GETDATE() or CURRENT_TIMESTAMP

# Date formatting
# SQLite:     strftime('%Y-%m-%d', date_column)
# SQL Server: FORMAT(date_column, 'yyyy-MM-dd') or CONVERT(VARCHAR, date_column, 23)

# Date difference
# SQLite:     julianday(date1) - julianday(date2)
# SQL Server: DATEDIFF(day, date2, date1)


# ============================================================
# 3. STRING CONCATENATION
# ============================================================

# SQLite:     column1 || ' ' || column2
# SQL Server: column1 + ' ' + column2  (or CONCAT(column1, ' ', column2))


# ============================================================
# 4. LIMIT / TOP
# ============================================================

# Get first N rows
# SQLite:     SELECT * FROM users LIMIT 10
# SQL Server: SELECT TOP 10 * FROM users

# Pagination
# SQLite:     SELECT * FROM users LIMIT 10 OFFSET 20
# SQL Server: SELECT * FROM users ORDER BY id OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY


# ============================================================
# 5. BOOLEAN VALUES
# ============================================================

# SQLite:     Uses 0 and 1 (or TRUE/FALSE)
# SQL Server: Uses BIT type with 0 and 1


# ============================================================
# 6. TEXT/VARCHAR
# ============================================================

# SQLite:     TEXT (unlimited)
# SQL Server: VARCHAR(MAX) or NVARCHAR(MAX) for unicode


# ============================================================
# 7. PARAMETER PLACEHOLDERS
# ============================================================

# Both use ? for parameters, but:
# SQLite (sqlite3):  cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
# SQL Server (pyodbc): cursor.execute("SELECT * FROM users WHERE id = ?", user_id)
#                      Note: pyodbc doesn't need tuple for single param


# ============================================================
# 8. UPSERT (INSERT OR UPDATE)
# ============================================================

# SQLite:
# INSERT OR REPLACE INTO table (col1, col2) VALUES (?, ?)
# or
# INSERT INTO table (col1, col2) VALUES (?, ?) 
# ON CONFLICT(col1) DO UPDATE SET col2 = ?

# SQL Server:
# MERGE INTO table AS target
# USING (SELECT ? AS col1, ? AS col2) AS source
# ON target.col1 = source.col1
# WHEN MATCHED THEN UPDATE SET col2 = source.col2
# WHEN NOT MATCHED THEN INSERT (col1, col2) VALUES (source.col1, source.col2);


# ============================================================
# 9. GROUP_CONCAT / STRING_AGG
# ============================================================

# Combine multiple rows into one string
# SQLite:     GROUP_CONCAT(column, ',')
# SQL Server: STRING_AGG(column, ',')


# ============================================================
# 10. CASE SENSITIVITY
# ============================================================

# SQLite:     Case-insensitive by default for LIKE
# SQL Server: Depends on collation (usually case-insensitive)

# To ensure case-insensitive search:
# SQLite:     LIKE '%text%' (already case-insensitive)
# SQL Server: LIKE '%text%' COLLATE SQL_Latin1_General_CP1_CI_AS


# ============================================================
# QUERIES THAT NEED CHANGES IN VES HRMS
# ============================================================

# In app.py, look for these patterns and update for SQL Server:

# 1. datetime('now') → GETDATE()
# 2. strftime() → FORMAT() or CONVERT()
# 3. LIMIT x → TOP x (or use OFFSET/FETCH)
# 4. || for concat → + or CONCAT()

# Example changes:

# SQLite version:
# cursor.execute("INSERT INTO audit_logs (timestamp) VALUES (datetime('now'))")

# SQL Server version:
# cursor.execute("INSERT INTO audit_logs (timestamp) VALUES (GETDATE())")


# ============================================================
# PRO TIP: Use try/except to support both databases
# ============================================================

# def insert_audit_log(cursor, user_id, action):
#     if DATABASE_TYPE == 'sqlite':
#         cursor.execute(
#             "INSERT INTO audit_logs (user_id, action, timestamp) VALUES (?, ?, datetime('now'))",
#             (user_id, action)
#         )
#     else:  # sqlserver
#         cursor.execute(
#             "INSERT INTO audit_logs (user_id, action, timestamp) VALUES (?, ?, GETDATE())",
#             (user_id, action)
#         )
