import sqlite3
import bcrypt

conn = sqlite3.connect('ves_hrms.db')
c = conn.cursor()

test_users = [
    # W001 - Worker with Shift 1 (Lunch)
    ('W001TEST', 'worker1', 'worker1@test.com', 'worker123', 'Test Worker - Shift 1', 'Employee', 'W001', '1', 12),
    
    # W001 - Worker with Shift 2 (Dinner)
    ('W002TEST', 'worker2', 'worker2@test.com', 'worker123', 'Test Worker - Shift 2', 'Employee', 'W001', '2', 12),
    
    # W001 - Worker with Shift 3 (Breakfast)
    ('W003TEST', 'worker3', 'worker3@test.com', 'worker123', 'Test Worker - Shift 3', 'Employee', 'W001', '3', 12),
    
    # S001 - Staff (no meal token)
    ('S001TEST', 'staff1', 'staff1@test.com', 'staff123', 'Test Staff Member', 'Employee', 'S001', None, 12),
    
    # M001 - Migrant Worker (no leave, yes meal)
    ('M001TEST', 'migrant1', 'migrant1@test.com', 'migrant123', 'Test Migrant Worker', 'Employee', 'M001', '1', 0),
    
    # T001 - Trainee (no leave, no meal)
    ('T001TEST', 'trainee1', 'trainee1@test.com', 'trainee123', 'Test Trainee', 'Employee', 'T001', None, 0),
]

print("Creating test users...")

for user in test_users:
    emp_id, username, email, password, name, role, category, shift, leave = user
    
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
                          employee_category, shift, leave_balance, is_active, hire_date, account_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '2024-01-01', 'Active')
    ''', (emp_id, username, email, pwd_hash, name, role, category, shift, leave))
    
    print(f"✓ Created {username} - {category} (Shift: {shift}, Leave: {leave} days)")

conn.commit()
conn.close()

print("\n🎉 Test users created successfully!")
print("\n📋 TEST CREDENTIALS:")
print("="*60)
print("WORKER with Lunch (Shift 1):")
print("  Username: worker1  |  Password: worker123")
print("  Category: W001  |  Leave: 12 days  |  Meal: Lunch")
print()
print("WORKER with Dinner (Shift 2):")
print("  Username: worker2  |  Password: worker123")
print("  Category: W001  |  Leave: 12 days  |  Meal: Dinner")
print()
print("WORKER with Breakfast (Shift 3):")
print("  Username: worker3  |  Password: worker123")
print("  Category: W001  |  Leave: 12 days  |  Meal: Breakfast")
print()
print("STAFF (No meal token):")
print("  Username: staff1  |  Password: staff123")
print("  Category: S001  |  Leave: 12 days  |  Meal: None")
print()
print("MIGRANT WORKER (No leave, yes meal):")
print("  Username: migrant1  |  Password: migrant123")
print("  Category: M001  |  Leave: 0 days  |  Meal: Lunch")
print()
print("TRAINEE (No benefits):")
print("  Username: trainee1  |  Password: trainee123")
print("  Category: T001  |  Leave: 0 days  |  Meal: None")
print("="*60)
