# VES HRMS - People App

**Virrudheeswara Engineering Services**

HRMS system with Purple Employee Dashboard and Blue HR Dashboard.

---

## Prerequisites

Install these first:
- **Python 3.8+** - Download from https://www.python.org/downloads/
- **Node.js 16+** - Download from https://nodejs.org/

---

## Setup Commands

### 1. Install Python Dependencies
```cmd
cd VesHRMS
pip install -r requirements.txt
```

### 2. Install Frontend Dependencies  
```cmd
cd frontend
npm install
cd ..
```

### 3. Setup Database
```cmd
python seed.py --file "Employee Details.xlsx"
```

---

## Launch Application

### Start Backend (Terminal 1)
```cmd
cd VesHRMS
python app.py
```

### Start Frontend (Terminal 2)  
```cmd
cd VesHRMS\frontend
npm start
```

**Application URL**: http://localhost:3000

---

## Login Credentials

HR accounts:
	• hr1 / HR@123
	• hr2 / HR@123
	• hr3 / HR@123
hr4 / HR@123

---

💜 Employee Dashboard (Purple Theme)
Username	Password	Category	Notes
worker1	worker123	W001	✅ Full benefits - meal + leave
worker2	worker123	W001	✅ Full benefits
worker3	worker123	W001	✅ Full benefits
staff1	staff123	S001	✅ Leave only, no meal
migrant1	migrant123	M001	⚠️ Meal only, no leave
trainee1	trainee123	T001	⚠️ No benefits
💙 HR Dashboard (Blue Theme)
Username	Password	Notes
hr_manager	VEShr123!	✅ Single-session only
hr_staff1	VEShr123!	✅ Single-session only
hr_staff2	VEShr123!	✅ Single-session only
🔴 Admin Dashboard
Username	Password	Notes
admin	admin123	✅ Created by seed.py
<img width="581" height="641" alt="image" src="https://github.com/user-attachments/assets/34365b81-c381-4e61-9493-58d16998184e" />

## Features

### Purple Branch (Employee)
- Leave Request
- Payroll View  
- Document Upload
- Attendance Tracking
- Custom Requests
- Lunch Token

### Blue Branch (HR)
- Company Attendance Monitor
- Payroll Management
- Document Review
- Leave Approvals  
- Employee Database
- Designation Management

- Exit Tracking


┌──────────────────────────────────────────────────────────────────┐
│                     📍 YOUR OFFICE (VES)                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   Your Laptop has:                                               │
│   ┌─────────────────────┐                                        │
│   │ VesHRMS/            │  ← FULL SOURCE CODE                    │
│   │ ├── app.py          │  ← Python code (SECRET)                │
│   │ ├── frontend/src/   │  ← React code (SECRET)                 │
│   │ ├── seed.py         │  ← Seeding script (SECRET)             │
│   │ └── production/     │  ← Deployment tools                    │
│   └─────────────────────┘                                        │
│              │                                                    │
│              ▼                                                    │
│   ┌─────────────────────┐                                        │
│   │ RUN: build_for_     │  ← Creates compiled version            │
│   │      client.py      │                                        │
│   └─────────────────────┘                                        │
│              │                                                    │
│              ▼                                                    │
│   ┌─────────────────────┐                                        │
│   │ client_deployment/  │  ← COMPILED (No source visible)        │
│   │ ├── ves_hrms.exe    │  ← Compiled Python                     │
│   │ ├── frontend/       │  ← Compiled React                      │
│   │ ├── config.ini      │  ← Settings only                       │
│   │ └── START_SERVER.bat│                                        │
│   └─────────────────────┘                                        │
│              │                                                    │
│         Copy to USB                                              │
│              │                                                    │
└──────────────┼───────────────────────────────────────────────────┘
               │
               │  🚗 You go to client site
               │
┌──────────────┼───────────────────────────────────────────────────┐
│              ▼           📍 CLIENT SITE                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   1. YOU Setup Database (SSMS):                                  │
│      ┌─────────────────────────────────────────────┐             │
│      │ • Create database: VES_HRMS                 │             │
│      │ • Run init_sqlserver.sql                    │             │
│      │ • Create user account                       │             │
│      └─────────────────────────────────────────────┘             │
│                                                                   │
│   2. YOU Seed Data (from YOUR laptop):                           │
│      ┌─────────────────────────────────────────────┐             │
│      │ Connect your laptop to their network        │             │
│      │ Run: python seed_sqlserver.py               │             │
│      │      --server="CLIENT_SQL_SERVER"           │             │
│      │      --file="Employee Details.xlsx"         │             │
│      └─────────────────────────────────────────────┘             │
│                                                                   │
│   3. Copy ONLY compiled files to client server:                  │
│      ┌─────────────────────────────────────────────┐             │
│      │ C:\VES_HRMS\                                │             │
│      │ ├── ves_hrms.exe      ← Can't see code!    │             │
│      │ ├── frontend/         ← Can't see code!    │             │
│      │ ├── config.ini        ← Only settings      │             │
│      │ ├── logs/                                   │             │
│      │ └── uploads/                                │             │
│      └─────────────────────────────────────────────┘             │
│                                                                   │
│   4. Test everything, then LEAVE:                                │
│      • Delete seed scripts from your laptop (client network)     │
│      • Delete Excel file                                         │
│      • Client only has .exe and compiled frontend                │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

               │
               │  📞 FUTURE: Client has issue
               │
┌──────────────┼───────────────────────────────────────────────────┐
│              ▼           📍 SUPPORT FLOW                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   Client: "Attendance not working!"                              │
│                         │                                         │
│                         ▼                                         │
│   You: Connect via TeamViewer/AnyDesk                            │
│                         │                                         │
│                         ▼                                         │
│   You: Check C:\VES_HRMS\logs\error.log                          │
│                         │                                         │
│                         ▼                                         │
│   You: Find the bug, fix in YOUR source code                     │
│                         │                                         │
│                         ▼                                         │
│   You: Rebuild .exe on YOUR laptop                               │
│                         │                                         │
│                         ▼                                         │
│   You: Replace old .exe with new .exe on client server           │
│                         │                                         │
│                         ▼                                         │
│   Done! Client still can't see your code! 🔒                     │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘



┌─────────────────────────────────────────────────────────────────┐
│                  AT CLIENT SITE - DATABASE SETUP                 │
└─────────────────────────────────────────────────────────────────┘

STEP 1: In SSMS (SQL Server Management Studio)
─────────────────────────────────────────────
   YOU manually create an EMPTY database first!
   
   Right-click "Databases" → "New Database"
   Name: VES_HRMS
   Click OK
   
   Result: Empty database created (no tables yet)


STEP 2: Run init_sqlserver.sql
─────────────────────────────────────────────
   In SSMS: File → Open → init_sqlserver.sql
   Press F5 (Execute)
   
   This creates ALL TABLES (empty):
   ├── employees (empty)
   ├── attendance (empty)
   ├── leave_requests (empty)
   ├── salary_config (empty)
   ├── payslips (empty)
   ├── meal_tokens (empty)
   ├── audit_log (empty)
   └── ... all other tables (empty)
   
   Result: Database has structure, but NO DATA


STEP 3: Run seed_sqlserver.py (from YOUR laptop)
─────────────────────────────────────────────
   YOU connect your laptop to client's SQL Server
   
   python seed_sqlserver.py --file="Employee Details.xlsx" 
                            --server="CLIENT_SERVER_IP"
                            --database="VES_HRMS"
                            --user="sa" --password="xxx"
   
   This READS Excel and INSERTS into database:
   ├── employees → Filled with Excel data
   ├── HR users → Created (hr_manager, etc.)
   ├── Admin user → Created (admin)
   └── Initial settings → Created
   
   Result: Database has employees from Excel!


STEP 4: App Running - HR Adds More
─────────────────────────────────────────────
   After this, whatever HR adds goes to same database:
   ├── New employees → INSERT into employees table
   ├── Attendance → INSERT into attendance table
   ├── Leave requests → INSERT into leave_requests table
   └── Payroll → INSERT into payslips table

   c:\Users\amurugai\Documents\VesHRMS\
│
├── (your source code - KEEP SECRET)
│
└── client_deployment/     <-- THIS FOLDER GOES TO CLIENT
    ├── config.ini              [OK] - Database settings
    ├── START_SERVER.bat        [OK] - Double-click to start
    ├── INSTALL_AS_SERVICE.bat  [OK] - Auto-start on boot
    ├── database_setup/         [OK] - SQL scripts (YOU run)
    │   └── init_sqlserver.sql
    ├── logs/                   [OK] - Empty, logs go here
    ├── uploads/                [OK] - Empty, uploads go here
    ├── DEPLOYMENT_NOTES.md     [OK] - Your reference
    └── CHECKLIST.txt           [OK] - Step-by-step checklist


┌─────────────────────────────────────────────────────────────────┐
│                     PASSWORD FLOW                                │
└─────────────────────────────────────────────────────────────────┘

USER ENTERS:  "VEShr123!"
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  bcrypt.hashpw("VEShr123!".encode(), bcrypt.gensalt())          │
│                                                                  │
│  GENERATES:  $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X...   │
│              └──┘└──┘└─────────────────────────────────────┘    │
│               │    │              │                              │
│            Algorithm │        Hashed Password (60 chars)         │
│                   Salt (random, unique each time)                │
└─────────────────────────────────────────────────────────────────┘
                  │
                  ▼
          STORED IN DATABASE
          (only the hash, never plain password)

