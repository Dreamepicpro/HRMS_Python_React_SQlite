import sqlite3

conn = sqlite3.connect('ves_hrms.db')
c = conn.cursor()

print("\n" + "="*70)
print("WORKER/OPERATOR CREDENTIALS (Category: W001)")
print("="*70)

c.execute('''
    SELECT username, employee_id, shift, leave_balance 
    FROM users 
    WHERE employee_category = 'W001' 
    LIMIT 10
''')

workers = c.fetchall()
if workers:
    for w in workers:
        shift_meal = {None: "No shift", "1": "Lunch", "2": "Dinner", "3": "Breakfast"}
        print(f"Username: {w[0]:25} Password: {w[1]:15} | Shift: {w[2] or '-':5} | Meal: {shift_meal.get(w[2], '-'):10} | Leave: {w[3]} days")
else:
    print("No W001 workers found!")

print("\nTo test: Login with Username and Password above")
print("="*70)

conn.close()
