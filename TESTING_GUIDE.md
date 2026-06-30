# Project Management - Testing & Deployment Guide

## Prerequisites

Before testing, ensure:
- [ ] Backend server running: `python new_backend/app.py`
- [ ] Frontend dev server running: `npm run dev`
- [ ] PostgreSQL database accessible
- [ ] Browser DevTools open (F12) for debugging

---

## Part 1: Database Verification

### Step 1.1: Check Tables Created
```sql
-- Connect to your PostgreSQL database and run:

-- Check project table
SELECT * FROM trueday.project;

-- Check project_users table (NEW)
SELECT * FROM trueday.project_users;

-- Check table structure
\d trueday.project
\d trueday.project_users
```

**Expected Output:**
```
 project_id | project_name | color | created_at
────────────────────────────────────────────────
(empty if new)

 project_users_id | user_id | project_id | role | created_at
────────────────────────────────────────────────────────────────
(empty if new)
```

### Step 1.2: Verify Constraints
```sql
-- Check UNIQUE constraint
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'project_users';

-- Check Foreign Keys
SELECT constraint_name, table_name, column_name
FROM information_schema.key_column_usage
WHERE table_name = 'project_users';
```

**Expected Output:**
```
Constraints:
- project_users_pkey (PRIMARY KEY)
- project_users_user_id_project_id_key (UNIQUE)

Foreign Keys:
- user_id references users(id)
- project_id references project(project_id)
```

---

## Part 2: Backend API Testing

### Test 2.1: Get Project Users Endpoint
```bash
# Start terminal in new_backend directory
curl -X GET http://localhost:5009/api/project-users \
  -H "Content-Type: application/json" \
  --cookie "jwt=your_session_cookie"
```

**Expected Response (200 OK):**
```json
[
  {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "display_name": "John Doe"
  },
  ...
]
```

### Test 2.2: Create Project Endpoint (Admin Only)
```bash
# Test as admin (session_id in ['1','2','3','7','8'])
curl -X POST http://localhost:5009/api/projects/create \
  -H "Content-Type: application/json" \
  --cookie "jwt=your_session_cookie" \
  -d '{
    "project_name": "Test Project Alpha",
    "color": "#FF5733",
    "user_ids": [1, 2, 3]
  }'
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "project_id": 1,
  "project_name": "Test Project Alpha",
  "color": "#FF5733",
  "message": "Project created successfully"
}
```

### Test 2.3: Get User's Projects Endpoint
```bash
curl -X GET http://localhost:5009/api/projects \
  -H "Content-Type: application/json" \
  --cookie "jwt=your_session_cookie"
```

**Expected Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "Test Project Alpha",
    "color": "#FF5733",
    "created_at": "2026-03-12T10:00:00",
    "role": "User"
  }
]
```

### Test 2.4: Test Authorization (Non-Admin)
```bash
# Test as non-admin user
curl -X POST http://localhost:5009/api/projects/create \
  -H "Content-Type: application/json" \
  --cookie "jwt=non_admin_session" \
  -d '{
    "project_name": "Unauthorized Project",
    "color": "#000000",
    "user_ids": [1]
  }'
```

**Expected Response (403 Forbidden):**
```json
{
  "error": "Only admins can create projects"
}
```

### Test 2.5: Test Ticket Creation Authorization
```bash
# Create ticket with user NOT assigned to project
curl -X POST http://localhost:5009/create_ticket \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Ticket",
    "description": "Test",
    "priority": "Medium",
    "due_date": "2026-04-12",
    "creator_id": 5,
    "project_id": 1,
    "assignee_id": 1
  }'
```

**Expected Response (403 Forbidden) if user_id 5 not in project 1:**
```json
{
  "error": "You are not assigned to this project"
}
```

**Expected Response (201 Created) if user_id 5 IS in project 1:**
```json
{
  "ticket_id": 123,
  "message": "Ticket created successfully"
}
```

---

## Part 3: Frontend Component Testing

### Test 3.1: "Add Project" Button Visibility
**As Admin User:**
1. Login as admin (user with role 'Admin' or 'Superadmin')
2. Navigate to Dashboard
3. Look for "Add Project" button
4. **Expected:** Button is ENABLED (clickable, normal color)

**As Regular User:**
1. Login as non-admin user
2. Navigate to Dashboard
3. Look for "Add Project" button
4. **Expected:** Button is DISABLED (grayed out, not clickable)

### Test 3.2: Modal Opens Correctly
**Steps:**
1. As admin, click "Add Project" button
2. **Expected:** Modal opens with:
   - Title: "Add Project"
   - Project Name input field
   - Color picker
   - Users dropdown/list
   - "Create Project" and "Cancel" buttons
   - Close button (×)

### Test 3.3: Color Picker Works
**Steps:**
1. Click color picker in modal
2. Select a different color (e.g., red #FF0000)
3. **Expected:** Color preview updates next to picker

### Test 3.4: Users Dropdown Population
**Steps:**
1. Open modal
2. Look at users section
3. **Expected:** List shows all users from database with:
   - Checkboxes
   - Username
   - Email
   - Display name (first + last name)

### Test 3.5: User Selection
**Steps:**
1. Open modal
2. Check/uncheck users
3. **Expected:** Checkboxes toggle, selected users highlighted
4. Can select multiple users
5. Clicking user row also toggles checkbox

### Test 3.6: Form Validation
**Test empty project name:**
1. Leave project name empty
2. Select users
3. Click "Create Project"
4. **Expected:** Error message: "Project name is required"

**Test no users selected:**
1. Enter project name
2. Don't select any users
3. Click "Create Project"
4. **Expected:** Error message: "At least one user must be assigned"

### Test 3.7: Successful Project Creation
**Steps:**
1. Fill form:
   - Name: "Test Project"
   - Color: Pick any color
   - Users: Select 2-3 users
2. Click "Create Project"
3. **Expected:**
   - Loading state (button shows "Creating...")
   - Success toast notification appears
   - Modal closes after 1-2 seconds
   - Projects list refreshes

### Test 3.8: Project Appears in Assigned Users' Dashboards
**Steps:**
1. Admin creates project "New Project Alpha"
2. Assigns users: John, Jane, Bob
3. Login as John
4. Go to Dashboard
5. Open project filter dropdown
6. **Expected:** "New Project Alpha" appears in list

**Cross-check:**
1. Login as different user (not assigned)
2. Go to Dashboard
3. Open project filter dropdown
4. **Expected:** "New Project Alpha" does NOT appear

### Test 3.9: Toast Notifications
**Success Toast:**
1. Create project successfully
2. **Expected:** Green toast appears at bottom-right
3. Message: "Project created successfully!"
4. Auto-dismisses after ~3 seconds

**Error Toast:**
1. Try to create with empty name
2. **Expected:** Red/error toast appears
3. Shows error message
4. Modal remains open for corrections

---

## Part 4: Integration Testing

### Integration Test 4.1: Complete Project Creation Workflow
**Scenario:** Admin creates project and assigns users

**Steps:**
1. Admin logs in
2. Clicks "Add Project"
3. Enters:
   - Name: "Marketing Campaign"
   - Color: "#FF6B35"
   - Users: Select Marketing Team (3 users)
4. Clicks "Create Project"
5. Verifies database:
   ```sql
   SELECT p.project_id, p.project_name, p.color, COUNT(pu.user_id) as user_count
   FROM trueday.project p
   LEFT JOIN trueday.project_users pu ON p.project_id = pu.project_id
   WHERE p.project_name = 'Marketing Campaign'
   GROUP BY p.project_id, p.project_name, p.color;
   ```
6. **Expected:**
   - Project exists in project table
   - 3 records in project_users table
   - Each user_id has role='User'

### Integration Test 4.2: User Can Create Ticket in Assigned Project
**Scenario:** User creates ticket in assigned project

**Steps:**
1. Login as John (assigned to "Marketing Campaign" project)
2. Go to Dashboard
3. Click "Create Ticket"
4. Select project: "Marketing Campaign"
5. Fill other required fields
6. Submit
7. **Expected:** Ticket created successfully

**Database Verification:**
```sql
SELECT ticket_id, project_id, creator_id FROM trueday.tickets 
WHERE creator_id = 1 AND project_id = 1 ORDER BY ticket_id DESC LIMIT 1;
```

### Integration Test 4.3: User Cannot Create Ticket in Unassigned Project
**Scenario:** User tries to create ticket in project they're not assigned to

**Steps:**
1. Login as Alice (NOT assigned to "Marketing Campaign")
2. Go to Dashboard
3. Try to create ticket with project "Marketing Campaign"
4. **Expected:** 
   - Frontend: Project not in dropdown (can't select)
   - Backend: 403 error if somehow forced via API

**API Test (curl):**
```bash
# Try to create ticket as unassigned user
curl -X POST http://localhost:5009/create_ticket \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Unauthorized Ticket",
    "description": "Test",
    "priority": "Medium",
    "due_date": "2026-04-12",
    "creator_id": 5,  # Alice's ID (not in project 1)
    "project_id": 1,  # Marketing Campaign
    "assignee_id": 1
  }'
```

**Expected Response:**
```json
{
  "error": "You are not assigned to this project"
}
```

### Integration Test 4.4: Project Filter Shows Only Assigned Projects
**Scenario:** Verify project dropdown filters correctly

**Steps:**
1. Admin creates 3 projects:
   - "Sales Pipeline" - Assigns: John, Jane
   - "Customer Support" - Assigns: Bob, Alice
   - "Internal Tools" - Assigns: John, Bob
2. Login as John
3. Go to Dashboard
4. Click project filter dropdown
5. **Expected:** Only sees:
   - Sales Pipeline
   - Internal Tools
   - (NOT Customer Support)

---

## Part 5: Edge Cases & Error Handling

### Edge Case 5.1: Duplicate Project Name
**Steps:**
1. Create project "Duplicate Test"
2. Try to create another project with same name
3. **Expected:** 
   - Backend error: "Project name already exists" (or duplicate constraint error)
   - Frontend error message shown

### Edge Case 5.2: Same User Selected Multiple Times
**Steps:**
1. Open modal
2. Try to assign same user multiple times
3. **Expected:** 
   - Checkbox prevents selecting same user twice
   - Database constraint (UNIQUE) prevents duplicates

### Edge Case 5.3: Large User List Performance
**Steps:**
1. System has 1000+ users
2. Open modal
3. Click users dropdown
4. **Expected:** 
   - List scrolls smoothly
   - No performance lag
   - Search/filter works (if implemented)

### Edge Case 5.4: Concurrent Project Creation
**Steps:**
1. Admin A creates project A
2. Simultaneously, Admin B creates project B
3. Both click "Create" at same time
4. **Expected:** Both projects created successfully, no conflicts

### Edge Case 5.5: Modal Refresh After Cancel
**Steps:**
1. Open "Add Project" modal
2. Fill some data
3. Click "Cancel"
4. Re-open modal
5. **Expected:** 
   - Form is reset (empty fields)
   - Previous data not retained

---

## Part 6: Browser DevTools Testing

### Test 6.1: Network Requests
**Steps:**
1. Open DevTools (F12)
2. Go to Network tab
3. Create a project
4. Watch network requests

**Expected Requests:**
```
GET /api/project-users            [200]  (fetch users list)
POST /api/projects/create         [201]  (create project)
GET /api/projects                 [200]  (refresh project list)
```

**Check Response Headers:**
```
Content-Type: application/json
Access-Control-Allow-Credentials: true
```

### Test 6.2: Console Errors
**Steps:**
1. Open Console tab
2. Create project
3. **Expected:** 
   - No red errors
   - No warnings about React
   - No network failures

### Test 6.3: Local Storage
**Steps:**
1. Open Application tab
2. Check Local Storage
3. **Expected:**
   - Projects cached in frontend state
   - User info stored from login

---

## Part 7: Performance Testing

### Test 7.1: Load Time with Many Projects
**Setup:**
1. Create 100 projects in database
2. Assign current user to 50 projects

**Steps:**
1. Login and go to Dashboard
2. Measure load time: `loadProjects()`
3. Open project filter dropdown
4. **Expected:**
   - Load time < 2 seconds
   - Dropdown renders smoothly

### Test 7.2: Create Project Performance
**Setup:**
1. System has 500 users
2. Creating project with 100 user assignments

**Steps:**
1. Open Add Project modal
2. Select all 100 users
3. Click "Create Project"
4. Measure time to completion
5. **Expected:**
   - < 3 seconds to complete
   - No timeout errors

---

## Part 8: Security Testing

### Test 8.1: Session Hijacking Prevention
**Steps:**
1. Get valid session cookie from admin user
2. Try to use it as non-admin to create project
3. **Expected:** 401 or 403 error (cookie user verification)

### Test 8.2: SQL Injection Prevention
**Steps:**
1. Try to inject SQL in project name:
   ```
   Project Name: "; DROP TABLE project; --
   ```
2. Click Create
3. **Expected:** 
   - Input sanitized
   - Project created with literal name (not executed as SQL)
   - Database tables intact

### Test 8.3: CORS Protection
**Steps:**
1. Make request from different domain
2. Try to create project
3. **Expected:** 
   - CORS headers checked
   - Request blocked if from unauthorized domain

### Test 8.4: User Data Not Modified
**Pre-requisite SQL:**
```sql
SELECT user_count, modified_at FROM trueday.users 
WHERE id IN (SELECT DISTINCT user_id FROM trueday.project_users);
```

**Steps:**
1. Create projects and assign users
2. Re-run query
3. **Expected:**
   - No user records modified
   - modified_at unchanged
   - Only project_users table changed

---

## Troubleshooting Common Issues

### Issue: "Add Project" button not visible
**Solution:**
- Check user role in database: `SELECT role FROM trueday.users WHERE id = ?`
- Must be 'Admin' or 'Superadmin'
- Check `canAccessRestrictedFeatures` in browser console

### Issue: Users not appearing in dropdown
**Solution:**
- Check: `SELECT COUNT(*) FROM trueday.users`
- Ensure users exist in database
- Check network tab for GET /api/project-users errors

### Issue: Project not appearing after creation
**Solution:**
- Check database: `SELECT * FROM trueday.project WHERE project_name = ?`
- Check: `SELECT * FROM trueday.project_users WHERE project_id = ?`
- Try refreshing page or re-login
- Check browser console for errors

### Issue: "You are not assigned to this project" error
**Solution:**
- Correct behavior if not assigned
- Admin must add user to project via modal
- Verify in database: `SELECT * FROM trueday.project_users WHERE user_id = ? AND project_id = ?`

### Issue: Modal won't close
**Solution:**
- Check browser console for JavaScript errors
- Try pressing Escape key
- Clear browser cache: Ctrl+Shift+Del
- Check if form submission is hung (network tab)

---

## Deployment Checklist

- [ ] Database migrations ran successfully
- [ ] All 5 API endpoints tested and working
- [ ] Frontend modal displays correctly
- [ ] Button disabled for non-admins
- [ ] Color picker works
- [ ] User list populates
- [ ] Form validation works
- [ ] Successful creation and refresh works
- [ ] Authorization checks work
- [ ] No console errors
- [ ] No SQL injection vulnerabilities
- [ ] Session security verified
- [ ] User data not modified
- [ ] Documentation complete
- [ ] Ready for production

---

## Quick Reference: Test Scenarios

| Scenario | User | Expected Result | Pass/Fail |
|----------|------|-----------------|-----------|
| Create project | Admin | ✓ Project created | [ ] |
| Create project | User | ✗ Access denied | [ ] |
| View projects | User | Only assigned | [ ] |
| Create ticket in assigned project | User | ✓ Ticket created | [ ] |
| Create ticket in unassigned project | User | ✗ Access denied | [ ] |
| Duplicate project name | Admin | ✗ Constraint error | [ ] |
| Empty project name | Admin | ✗ Validation error | [ ] |
| No users selected | Admin | ✗ Validation error | [ ] |
| User data modified | System | ✗ No changes | [ ] |
| Large user list | User | ✓ Smooth scrolling | [ ] |

---

## Support & Debugging

**Enable Backend Logging:**
```python
# Already enabled in app.py
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
```

**Check Logs:**
```bash
tail -f new_backend/app.log
```

**Frontend Debugging:**
```javascript
// In browser console
console.log('Current user:', currentUser);
console.log('Can access admin features:', canAccessRestrictedFeatures);
console.log('Projects:', projects);
```

---

**All tests passing? You're ready for production! 🚀**
