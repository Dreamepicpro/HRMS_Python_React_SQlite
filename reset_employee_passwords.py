"""
Reset Employee Passwords Script
This makes employee passwords = their employee_id (without .0)

For example:
- Username: ajith.b  →  Password: 1012
- Username: ajith.s  →  Password: 3250
"""

import sqlite3
import bcrypt

conn = sqlite3.connect('ves_hrms.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

# Get all employees (not test users, not HR/Admin)
c.execute("""
    SELECT employee_id, username, full_name 
    FROM users 
    WHERE role = 'Employee' 
    AND username NOT IN ('worker1','worker2','worker3','staff1','migrant1','trainee1')
""")

employees = c.fetchall()

print("🔄 Resetting Employee Passwords...")
print("="*60)

updated = 0
for emp in employees:
    emp_id = emp['employee_id']
    username = emp['username']
    
    # Password = employee_id without .0 suffix
    password = emp_id.replace('.0', '') if emp_id.endswith('.0') else emp_id
    
    # Hash the password
    pwd_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Update in database
    c.execute("UPDATE users SET password_hash = ? WHERE employee_id = ?", (pwd_hash, emp_id))
    
    print(f"✓ {username:20} → Password: {password}")
    updated += 1

conn.commit()
conn.close()

print("="*60)
print(f"\n🎉 Updated {updated} employee passwords!")
print("\n📋 EMPLOYEE LOGIN FORMAT:")
print("   Username: (from Excel, e.g., ajith.b)")
print("   Password: Employee ID without .0 (e.g., 1012)")
print("\n📌 Examples:")
print("   ajith.b      / 1012")
print("   ajith.s      / 3250")
print("   akhil.s      / 3062")
print("   baby         / 1034")
