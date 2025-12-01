import sqlite3
import bcrypt

conn = sqlite3.connect('ves_hrms.db')
c = conn.cursor()

hr_users = [
    ('HR002', 'hr_staff1', 'hr1@ves.com', 'VEShr123!', 'HR Staff 1', 'HR'),
    ('HR003', 'hr_staff2', 'hr2@ves.com', 'VEShr123!', 'HR Staff 2', 'HR'),
]

print("Creating HR users...")

for user in hr_users:
    emp_id, username, email, password, name, role = user
    
    # Check if user exists
    c.execute('SELECT username FROM users WHERE username=?', (username,))
    if c.fetchone():
        print(f"✓ {username} already exists - skipping")
        continue
    
    # Hash password
    pwd_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Insert user
    c.execute('''
        INSERT INTO users (employee_id, username, email, password_hash, full_name, role, 
                          employee_category, hire_date, is_active, account_status)
        VALUES (?, ?, ?, ?, ?, ?, 'S001', '2024-01-01', 1, 'Active')
    ''', (emp_id, username, email, pwd_hash, name, role))
    
    print(f"✓ Created {username} - {role}")

conn.commit()
conn.close()

print("\n🎉 HR users created successfully!")
print("\n📋 HR CREDENTIALS (3 Different HR Logins):")
print("="*60)
print("HR 1: hr_manager  | Password: VEShr123!")
print("HR 2: hr_staff1   | Password: VEShr123!")
print("HR 3: hr_staff2   | Password: VEShr123!")
print("="*60)
print("\n⚠️  Single-Session Policy:")
print("Same credential CANNOT be used on multiple computers simultaneously!")
print("If already logged in elsewhere, user will be prompted to force logout.")
