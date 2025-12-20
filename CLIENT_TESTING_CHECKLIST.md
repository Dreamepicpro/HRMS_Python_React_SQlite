# 🎯 CLIENT TESTING CHECKLIST - VES HRMS

**Date:** December 19, 2025
**Tester:** _______________
**All 6 Requirements Complete:** ✅

---

## 🚀 SETUP (Do Once)

### Start Servers:
```bash
# Terminal 1: Backend
cd C:\Users\amurugai\Documents\VesHRMS
python app.py
# ✅ Wait for "🌟 Role-Morphing Dashboards Ready!"

# Terminal 2: Frontend  
cd C:\Users\amurugai\Documents\VesHRMS\frontend
npm start
# ✅ Browser opens at http://localhost:3000
```

### Test Accounts:
- **Employee:** `ajith.b` / `1012`
- **HR Manager:** `hr_manager` / `hr123`
- **Admin:** `admin` / `admin123`

---

## ✅ REQUIREMENT 1: Payroll Section Removed

### Test Steps:
1. [ ] Login as `ajith.b` / `1012`
2. [ ] Check navigation tabs
3. [ ] Verify tabs shown: Overview, Leave Request, Documents, Attendance, Custom Requests
4. [ ] Confirm "Payroll" tab NOT present
5. [ ] Check quick actions - No "View Payroll" button

**Status:** ⬜ PASS  ⬜ FAIL  
**Notes:** _________________________________

---

## ✅ REQUIREMENT 2: Concurrent Login Handling

### Test Steps:
1. [ ] Open **Chrome** (normal) → Login as `ajith.b`
   - Check localStorage → Should see `ves_token_ajith.b` key
2. [ ] Open **Chrome Incognito** → Login as `hr_manager`
   - Check localStorage → Should see `ves_token_hr_manager` key
3. [ ] In Chrome (ajith.b): Submit a leave request → Should work ✅
4. [ ] In Incognito (hr_manager): View leave approvals → Should work ✅
5. [ ] Both sessions work simultaneously without logout
6. [ ] Open **Firefox** → Login as `ajith.b` (same user)
7. [ ] Perform actions in both Chrome and Firefox (same user)
8. [ ] Both sessions work fine (no conflicts)

**Status:** ⬜ PASS  ⬜ FAIL  
**Notes:** _________________________________

---

## ✅ REQUIREMENT 3: Document Upload System

### Employee Side:
1. [ ] Login as `ajith.b` / `1012`
2. [ ] Go to "Documents" tab
3. [ ] Click "Upload Document"
4. [ ] Select type: "ID Proof"
5. [ ] Add notes: "Testing document upload"
6. [ ] Choose a PDF file (under 10MB)
7. [ ] Click "Upload" button
8. [ ] Success message appears
9. [ ] Document appears in list with "Pending" status
10. [ ] Try uploading file > 10MB → Error message appears ✅
11. [ ] Try uploading .txt file → Error message appears ✅
12. [ ] Click download icon → File downloads correctly ✅
13. [ ] Click delete icon → Confirm → Document removed ✅

### HR Side:
14. [ ] Login as `hr_manager` / `hr123`
15. [ ] Go to "Documents" tab
16. [ ] See list of all employee documents
17. [ ] Find the test document uploaded by ajith.b
18. [ ] Click "Approve" button
19. [ ] Add approval notes: "Verified and approved"
20. [ ] Confirm approval
21. [ ] Status changes to "Approved"
22. [ ] Login back as `ajith.b` → See approved status ✅

### File System Check:
23. [ ] Open folder: `C:\Users\amurugai\Documents\VesHRMS\uploads\`
24. [ ] Verify folder exists: `AJITH_B_1012\` (or similar)
25. [ ] Uploaded file is present inside folder ✅

**Status:** ⬜ PASS  ⬜ FAIL  
**Notes:** _________________________________

---

## ✅ REQUIREMENT 4: Leave Approval System

### Employee Side:
1. [ ] Login as `ajith.b` / `1012`
2. [ ] Go to "Leave Request" tab
3. [ ] See leave balance cards: CL, SL, EL with counts
4. [ ] Select leave type: "CL" (Casual Leave)
5. [ ] Choose start date: Tomorrow's date
6. [ ] Choose end date: Tomorrow's date (1 day)
7. [ ] Add reason: "Personal work"
8. [ ] Click "Submit Leave Request"
9. [ ] Success message appears
10. [ ] Leave appears in history with "Pending" status
11. [ ] Try selecting past date → Error message ✅
12. [ ] Try end date before start date → Error message ✅

### HR Side:
13. [ ] Login as `hr_manager` / `hr123`
14. [ ] Go to "Leave Approvals" tab
15. [ ] See "Pending approvals" counter (should show 1 or more)
16. [ ] Click "Pending" filter button
17. [ ] See ajith.b's leave request in list
18. [ ] Click "Approve" button
19. [ ] Confirm approval in popup
20. [ ] Status changes to "Approved"
21. [ ] Login back as `ajith.b` → See "Approved" status ✅
22. [ ] Leave balance decreased by 1 day ✅

### Test Rejection:
23. [ ] As `ajith.b`: Submit another leave request
24. [ ] As `hr_manager`: Click "Reject" on new request
25. [ ] Enter reason: "Team understaffed on these dates"
26. [ ] Confirm rejection
27. [ ] As `ajith.b`: See "Rejected" status with reason ✅

**Status:** ⬜ PASS  ⬜ FAIL  
**Notes:** _________________________________

---

## ✅ REQUIREMENT 5: Punch In/Out Data Integration

### Employee View:
1. [ ] Login as `ajith.b` / `1012`
2. [ ] Go to "Attendance" tab
3. [ ] Scroll down to "Punch In/Out Records" section
4. [ ] See table with columns: Date Column, Punch Time, Employee, Department, Category
5. [ ] Verify shows only records for ajith.b (employee_id 1012)
6. [ ] Check record count displayed
7. [ ] Verify punch times are visible (format: HH:MM:SS)

### HR View:
8. [ ] Login as `hr_manager` / `hr123`
9. [ ] Go to "Attendance" tab
10. [ ] Scroll down to "Punch In/Out Records" section
11. [ ] See summary cards at top:
    - Total Employees
    - Total Punches (should show ~201)
    - Date Columns
12. [ ] See filter controls: Employee ID, Department, Search, Reset
13. [ ] Enter Employee ID: "1001" → Click "Search"
14. [ ] Only employee 1001's records shown ✅
15. [ ] Click "Reset" → All records shown again ✅
16. [ ] Select a department from dropdown → Click "Search"
17. [ ] Only that department's records shown ✅
18. [ ] Verify table shows all 201 punch records when no filters applied

### Database Verification:
19. [ ] Open SQLite browser or run Python script:
```python
import sqlite3
conn = sqlite3.connect('CheckInOut_DB.db')
cursor = conn.cursor()
cursor.execute("SELECT COUNT(*) FROM Punch_Tym")
print(f"Records: {cursor.fetchone()[0]}")  # Should be 201
conn.close()
```
20. [ ] Confirm 201 records in database ✅

**Status:** ⬜ PASS  ⬜ FAIL  
**Notes:** _________________________________

---

## ✅ REQUIREMENT 6: Production-Ready Features

### Loading States:
1. [ ] Login and observe spinners during data load
2. [ ] Upload document → See upload progress/spinner
3. [ ] Submit leave → Button shows loading state
4. [ ] All async operations show loading indicators ✅

### Error Handling:
5. [ ] Stop backend server (Ctrl+C)
6. [ ] Try any action in frontend
7. [ ] See appropriate error message (not just blank screen)
8. [ ] Restart backend → Features work again ✅

### Empty States:
9. [ ] Login as new employee with no data
10. [ ] Check each tab for empty state messages:
    - Documents: "No documents found" with icon ✅
    - Leaves: "No leave requests" with icon ✅
    - Punch records: "No punch records found" with icon ✅

### Validation:
11. [ ] Try uploading 15MB file → Size error ✅
12. [ ] Try uploading .exe file → Type error ✅
13. [ ] Try submitting leave without dates → Required field error ✅
14. [ ] Try document upload without selecting file → Error ✅

### User Feedback:
15. [ ] Successful actions show green success messages ✅
16. [ ] Failed actions show red error messages ✅
17. [ ] Destructive actions (delete, reject) show confirmation dialogs ✅
18. [ ] Success messages auto-dismiss after few seconds ✅

### Browser Console:
19. [ ] Open browser DevTools (F12) → Console tab
20. [ ] Navigate through all tabs and features
21. [ ] Verify no critical errors in console ✅
22. [ ] Check for session validation logs every 30 seconds ✅

### Responsive Design:
23. [ ] Resize browser window to smaller width
24. [ ] Verify UI adjusts properly (no horizontal scroll)
25. [ ] Check mobile view (if applicable) ✅

**Status:** ⬜ PASS  ⬜ FAIL  
**Notes:** _________________________________

---

## 🔒 SECURITY CHECKS

### Token Isolation:
1. [ ] Open DevTools → Application → Local Storage
2. [ ] Verify separate tokens for each user:
   - `ves_token_ajith.b` for ajith.b
   - `ves_token_hr_manager` for hr_manager
3. [ ] Verify `ves_current_user` key shows current username
4. [ ] No generic `ves_token` key present ✅

### Session Validation:
5. [ ] Login and keep browser idle
6. [ ] Check console logs - should see validation every 30s
7. [ ] Session remains valid (no unexpected logout) ✅

### Access Control:
8. [ ] As employee: Try to access HR-only features
9. [ ] Should be blocked or show appropriate error ✅
10. [ ] As HR: Can access all features ✅

**Status:** ⬜ PASS  ⬜ FAIL  
**Notes:** _________________________________

---

## 📊 FINAL VERIFICATION

### Database Checks:
```python
import sqlite3

# Main database
conn = sqlite3.connect('ves_hrms.db')
cursor = conn.cursor()

cursor.execute("SELECT COUNT(*) FROM employee_documents")
doc_count = cursor.fetchone()[0]
print(f"Documents: {doc_count}")

cursor.execute("SELECT COUNT(*) FROM leave_applications")
leave_count = cursor.fetchone()[0]
print(f"Leaves: {leave_count}")

conn.close()

# Punch database
conn = sqlite3.connect('CheckInOut_DB.db')
cursor = conn.cursor()
cursor.execute("SELECT COUNT(*) FROM Punch_Tym")
punch_count = cursor.fetchone()[0]
print(f"Punch Records: {punch_count}")  # Should be 201
conn.close()
```

- [ ] Documents table populated ✅
- [ ] Leaves table populated ✅
- [ ] Punch records = 201 ✅

### File System Checks:
- [ ] `uploads/` folder exists ✅
- [ ] Employee folders created: `<Name>_<ID>/` ✅
- [ ] Uploaded files present in folders ✅

### Log Files:
- [ ] Check `logs/app.log` for any errors
- [ ] No critical errors or stack traces ✅

**Status:** ⬜ PASS  ⬜ FAIL  
**Notes:** _________________________________

---

## 📋 FINAL SIGN-OFF

### Summary:
- [ ] Requirement 1: Payroll Removed - **PASS/FAIL**
- [ ] Requirement 2: Concurrent Logins - **PASS/FAIL**
- [ ] Requirement 3: Document Upload - **PASS/FAIL**
- [ ] Requirement 4: Leave System - **PASS/FAIL**
- [ ] Requirement 5: Punch Records - **PASS/FAIL**
- [ ] Requirement 6: Production Ready - **PASS/FAIL**

### Overall Status:
⬜ **ALL TESTS PASSED** - Ready for Production  
⬜ **MINOR ISSUES** - Document and fix  
⬜ **MAJOR ISSUES** - Requires rework  

### Issues Found:
```
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________
```

### Tester Sign-Off:
**Name:** _______________  
**Date:** _______________  
**Signature:** _______________

---

## 📖 REFERENCE DOCUMENTS

- **QUICK_START.md** - 5-minute setup guide
- **TESTING_GUIDE.md** - Comprehensive testing details
- **IMPLEMENTATION_SUMMARY.md** - Technical implementation details

---

**🎉 All 6 Requirements Successfully Implemented!**

**Total Estimated Testing Time:** 30-45 minutes  
**Critical Path:** Requirements 1-5 (15 minutes)  
**Full Validation:** All requirements + edge cases (45 minutes)

**Happy Testing! 🚀**
