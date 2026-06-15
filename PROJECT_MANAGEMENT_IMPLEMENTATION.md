# Project Management Implementation Guide

## Overview
This document outlines the complete implementation of project management functionality for the Trueday application. The system allows admins to create projects, assign users to projects, and restricts ticket creation/viewing based on project membership.

---

## Database Schema

### 1. Project Table
```sql
CREATE TABLE IF NOT EXISTS trueday.project (
    project_id SERIAL PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL UNIQUE,
    color VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Project Users Table (NEW)
```sql
CREATE TABLE IF NOT EXISTS trueday.project_users (
    project_users_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES trueday.users(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES trueday.project(project_id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'User',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, project_id)
);
```

**Key Features:**
- Links users to projects with a many-to-many relationship
- CASCADE deletes ensure data integrity
- UNIQUE constraint prevents duplicate assignments
- Role field allows future role-based permissions (currently defaults to 'User')
- created_at tracks when user was assigned

---

## Backend API Endpoints

### Authentication & Authorization
All project endpoints require:
- Valid session (user_id in session)
- Admin-only endpoints check `session['id']` against `ALLOWED_SESSION_IDS = ['1', '2', '3', '7', '8']`

### Endpoints

#### 1. Get User's Assigned Projects
**Endpoint:** `GET /api/projects`
```
Response:
[
    {
        "id": 1,
        "name": "Project Alpha",
        "color": "#5e145e",
        "created_at": "2026-03-12T10:00:00",
        "role": "User"
    }
]
```
- Called on app load to populate project dropdowns
- Only returns projects assigned to the logged-in user

#### 2. Get All Projects (Admin Only)
**Endpoint:** `GET /api/projects/all`
```
Response: Same as above, but all projects
Authorization: Admin only (403 if not admin)
```

#### 3. Create Project (Admin Only)
**Endpoint:** `POST /api/projects/create`
```
Request:
{
    "project_name": "New Project",
    "color": "#5e145e",
    "user_ids": [1, 2, 3]
}

Response:
{
    "success": true,
    "project_id": 5,
    "project_name": "New Project",
    "color": "#5e145e",
    "message": "Project created successfully"
}
```
- Creates project in `trueday.project` table
- Assigns specified users via `trueday.project_users` table
- Validates project name is unique
- Authorization: Admin only (403 if not admin)

#### 4. Get All Users (for Project Assignment)
**Endpoint:** `GET /api/project-users`
```
Response:
[
    {
        "id": 1,
        "username": "john_doe",
        "email": "john@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "display_name": "John Doe"
    }
]
```
- Fetches all users from the Ariths system
- Does NOT modify user data
- Used to populate user selection in AddProjectModal

#### 5. Get Users in a Project
**Endpoint:** `GET /api/project/<project_id>/users`
```
Response:
[
    {
        "id": 1,
        "username": "john_doe",
        "email": "john@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "role": "User",
        "display_name": "John Doe"
    }
]
```

---

## Frontend Components

### 1. AddProjectModal Component
**Location:** `my-vite-app/src/DashBoard.jsx` (lines 109-223)

**Features:**
- Project name input field
- Color picker (HTML5 color input)
- Users multi-select dropdown
- Checkbox-based user selection for better UX
- Form validation
- Toast notifications
- Integrates with backend API

**Props:**
- `onClose`: Callback to close modal
- `onProjectCreated`: Callback after successful creation

**State Management:**
- `projectName`: Project name input
- `color`: Selected color
- `selectedUsers`: Array of user IDs
- `allUsers`: List of available users (fetched on mount)
- `error`: Error messages
- `isSubmitting`: Loading state
- `showToast`: Toast notification visibility

### 2. Button in Dashboard Header
**Location:** `my-vite-app/src/DashBoard.jsx` (lines 1714-1720)

```jsx
<button
  className="add-status-btn dashboard-action-btn"
  onClick={() => setShowAddProjectModal(true)}
  disabled={!canAccessRestrictedFeatures}
  title={!canAccessRestrictedFeatures ? 'This feature is restricted to Admin users only' : 'Add a new project'}
  style={{ textAlign: 'center' }}
>
  Add Project
</button>
```

**Features:**
- Same styling as "Add Bucket" button
- Disabled for non-admin users
- Tooltip shows why it's disabled
- Placed after "Add Bucket" button, before "Deleted Tickets"

### 3. Modal Rendering
**Location:** `my-vite-app/src/DashBoard.jsx` (lines 1948-1960)

```jsx
{showAddProjectModal && (
  <AddProjectModal 
    onClose={() => setShowAddProjectModal(false)}
    onProjectCreated={() => {
      loadProjects();
    }}
  />
)}
```

---

## Security & Authorization

### 1. Project Assignment Protection
When creating a ticket, the system verifies:
```python
if project_id:
    # Check if user belongs to the project
    cursor.execute("""
        SELECT 1 FROM trueday.project_users 
        WHERE user_id = %s AND project_id = %s
    """, (creator_id, project_id))
    if not cursor.fetchone():
        return {"error": "You are not assigned to this project"}, 403
```

### 2. Admin-Only Features
Features restricted to admins (session_id in ['1', '2', '3', '7', '8']):
- Create projects
- Assign users to projects
- View all projects
- Delete projects (future implementation)

### 3. User Data Privacy
- ✅ No user data is modified or deleted from Ariths system
- ✅ Users are only referenced via their IDs in project_users table
- ✅ User information is read-only for project assignment

### 4. Project Visibility
Users can only see/filter:
- Projects they are assigned to
- Only their assigned projects appear in the dashboard project dropdown

---

## User Flow

### 1. Admin Creates a Project
1. Click "Add Project" button in Dashboard
2. Fill in:
   - Project name (required)
   - Color picker (optional, defaults to #5e145e)
   - Select users to assign
3. Click "Create Project"
4. Success notification appears
5. Projects list refreshes
6. Users see new project in their project filter

### 2. User Creates a Ticket
1. Click "Create Ticket"
2. Select project from dropdown (only assigned projects shown)
3. Fill in ticket details
4. System verifies user belongs to selected project
5. If not assigned: Shows error "You are not assigned to this project"
6. If assigned: Ticket is created successfully

### 3. User Views Tickets
1. Dashboard loads user's assigned projects
2. Project filter shows only assigned projects
3. When filtering by project, only tickets from that project are displayed
4. Tickets are automatically restricted to user's projects on the backend

---

## Database Queries

### Fetch User's Projects
```sql
SELECT DISTINCT p.project_id, p.project_name, p.color, p.created_at, pu.role
FROM trueday.project p
INNER JOIN trueday.project_users pu ON p.project_id = pu.project_id
WHERE pu.user_id = %s
ORDER BY p.project_name ASC
```

### Verify User-Project Assignment
```sql
SELECT 1 FROM trueday.project_users 
WHERE user_id = %s AND project_id = %s
```

### Get Users in a Project
```sql
SELECT u.id, u.username, u.email, u.first_name, u.last_name, pu.role
FROM trueday.users u
INNER JOIN trueday.project_users pu ON u.id = pu.user_id
WHERE pu.project_id = %s
ORDER BY u.username ASC
```

### Assign User to Project
```sql
INSERT INTO trueday.project_users (user_id, project_id, role, created_at)
VALUES (%s, %s, 'User', CURRENT_TIMESTAMP)
ON CONFLICT (user_id, project_id) DO NOTHING
```

---

## Files Modified

### Backend
1. **new_backend/app.py**
   - Added `project_users` table creation (migration)
   - Added 5 new API endpoints
   - Updated `create_ticket` with project authorization check

### Frontend
1. **my-vite-app/src/DashBoard.jsx**
   - Added `AddProjectModal` component
   - Added `showAddProjectModal` state
   - Added "Add Project" button
   - Added modal rendering with project refresh callback
   - Added color picker import (standard HTML5, no additional dependencies)

---

## Testing Checklist

### Backend Testing
- [ ] Run database migration to create `project_users` table
- [ ] Test `/api/projects/create` as admin
- [ ] Test `/api/projects/create` as non-admin (should return 403)
- [ ] Test `/api/projects` returns only user's assigned projects
- [ ] Test ticket creation with project authorization
- [ ] Test ticket creation fails when user not assigned to project
- [ ] Verify no user data is modified/deleted

### Frontend Testing
- [ ] "Add Project" button only enabled for admins
- [ ] Modal opens/closes correctly
- [ ] Users dropdown populates correctly
- [ ] Color picker works
- [ ] Form validation works
- [ ] Success/error notifications display
- [ ] Projects list refreshes after creation
- [ ] Project filter dropdown shows new project

### Integration Testing
- [ ] Admin creates project
- [ ] Project appears in assigned users' dashboards
- [ ] Project does NOT appear in unassigned users' dashboards
- [ ] Assigned user can create ticket in project
- [ ] Unassigned user cannot create ticket in project
- [ ] Ticket filtering by project works correctly

---

## Future Enhancements

1. **Role-Based Permissions**
   - Use `project_users.role` field for admin/editor/viewer roles
   - Implement role-based ticket access controls

2. **Project Editing**
   - Edit project name, color
   - Add/remove users from projects
   - Delete projects (with cascade behavior)

3. **Project Analytics**
   - Project-specific dashboards
   - Project team performance metrics
   - Project ticket statistics

4. **Bulk Operations**
   - Bulk assign users to projects
   - Bulk create projects

5. **Audit Logging**
   - Log project creation/modifications
   - Log user assignments
   - Track project changes

---

## Troubleshooting

### Issue: "Add Project" button is disabled
**Solution:** Check if user role is 'Admin' or 'Superadmin' in database

### Issue: Users not appearing in dropdown
**Solution:** Check if users exist in `trueday.users` table

### Issue: Project not appearing after creation
**Solution:** 
- Refresh the page
- Check if user is assigned in `project_users` table
- Verify project was created in `project` table

### Issue: "You are not assigned to this project" error
**Solution:** Admin must add user to project via AddProjectModal before user can create tickets in that project

---

## API Error Responses

### 401 Unauthorized
```json
{"error": "User not authenticated"}
```

### 403 Forbidden
```json
{"error": "Only admins can create projects"}
{"error": "You are not assigned to this project"}
{"error": "Access denied"}
```

### 400 Bad Request
```json
{"error": "Project name is required"}
{"error": "At least one user must be assigned"}
```

### 500 Server Error
```json
{"error": "Error message describing the issue"}
```

---

## Support & Contact
For issues or questions about this implementation, refer to the backend logs at `new_backend/app.log` and frontend console for debugging information.
