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

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| HR | `hr_manager` | `hr123` |
| Employee | `ajith.b` | `1012` |

---

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