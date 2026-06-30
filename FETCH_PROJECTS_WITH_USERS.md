# Fetch All Projects with User Assignments

## Overview
This implementation adds functionality to fetch all projects from the `project` table along with their assigned users from the `project_users` table.

## Backend Implementation

### New API Endpoint

**Endpoint:** `GET /api/projects/with-users`

**Purpose:** Fetch all projects with their assigned users in a single request

**Authentication:** Required (session-based)

**Response Format:**
```json
{
  "success": true,
  "total_projects": 2,
  "projects": [
    {
      "project_id": 1,
      "project_name": "Project Name",
      "color": "#5e145e",
      "created_at": "2026-03-12T10:30:00",
      "users": [
        {
          "user_id": 5,
          "username": "john.doe",
          "email": "john@example.com",
          "first_name": "John",
          "last_name": "Doe",
          "display_name": "John Doe",
          "role": "User",
          "assigned_at": "2026-03-12T10:30:00"
        },
        {
          "user_id": 6,
          "username": "jane.smith",
          "email": "jane@example.com",
          "first_name": "Jane",
          "last_name": "Smith",
          "display_name": "Jane Smith",
          "role": "User",
          "assigned_at": "2026-03-12T10:30:00"
        }
      ],
      "user_count": 2
    }
  ]
}
```

### Database Query
The endpoint uses a SQL query that:
1. Joins `project` table with `project_users` table
2. LEFT JOINs with `users` table to get user details
3. Groups results by project
4. Uses `json_agg` to aggregate user information
5. Returns all projects ordered alphabetically

```sql
SELECT 
    p.project_id,
    p.project_name,
    p.color,
    p.created_at,
    json_agg(
        json_build_object(
            'user_id', u.id,
            'username', u.username,
            'email', u.email,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'display_name', COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.username),
            'role', pu.role,
            'assigned_at', pu.created_at
        )
    ) FILTER (WHERE u.id IS NOT NULL) AS users
FROM trueday.project p
LEFT JOIN trueday.project_users pu ON p.project_id = pu.project_id
LEFT JOIN trueday.users u ON pu.user_id = u.id
GROUP BY p.project_id, p.project_name, p.color, p.created_at
ORDER BY p.project_name ASC
```

## Frontend Implementation

### Changes to DashBoard Component

#### 1. Updated `loadProjects` Function
The function now:
- Calls the new `/api/projects/with-users` endpoint
- Logs all project data with user assignments to console
- Falls back to the simple `/api/projects` endpoint if the new one fails
- Stores complete project information in state

```javascript
const loadProjects = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/projects/with-users`);
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.status}`);
    }
    const data = await response.json();
    
    console.log('All Projects with User Assignments:', {
      total_projects: data.total_projects,
      projects: data.projects
    });
    
    setProjects(data.projects);
  } catch (error) {
    console.error('Error loading projects:', error);
    // Fallback to simple projects endpoint
  }
};
```

#### 2. Enhanced `AddProjectModal` Component
After successful project creation:
- Logs the newly created project information
- Includes project_id, project_name, color, and assigned_users
- Calls the onProjectCreated callback to refresh the projects list

```javascript
console.log('Project created successfully:', {
  project_id: data.project_id,
  project_name: data.project_name,
  color: data.color,
  assigned_users: selectedUsers
});
```

## How to Use

### 1. Create a New Project
1. Click "Add Project" button in the dashboard
2. Fill in project details:
   - **Project Name:** Name of the project
   - **Color:** Select a color for the project
   - **Assign Users:** Select users to assign to the project
3. Click "Create Project"

### 2. View All Projects with Users
After creating a project or loading the dashboard:
- Open browser Developer Console (F12 or Cmd+Option+I)
- Look for console logs showing all projects with their assigned users:
  ```
  All Projects with User Assignments: {
    total_projects: 2,
    projects: [...]
  }
  ```

### 3. Access Project Data Programmatically
In the DashBoard component, the `projects` state now contains:
- Project ID
- Project Name
- Color
- Created Date
- Array of assigned users with full details
- User count

## Database Schema

### project table
```sql
CREATE TABLE trueday.project (
    project_id SERIAL PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    color VARCHAR(7),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### project_users table
```sql
CREATE TABLE trueday.project_users (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    role VARCHAR(50) DEFAULT 'User',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, project_id),
    FOREIGN KEY (user_id) REFERENCES trueday.users(id),
    FOREIGN KEY (project_id) REFERENCES trueday.project(project_id)
)
```

## Testing

### Manual Testing Steps

1. **Create a Project:**
   ```
   - Go to Dashboard
   - Click "Add Project"
   - Enter project name: "Test Project"
   - Select color: #5e145e
   - Assign 2-3 users
   - Click "Create Project"
   ```

2. **Verify Console Output:**
   ```
   Open DevTools (F12)
   Look for console log:
   "Project created successfully: {...}"
   "All Projects with User Assignments: {...}"
   ```

3. **Verify Database:**
   ```sql
   SELECT * FROM trueday.project WHERE project_name = 'Test Project';
   SELECT * FROM trueday.project_users WHERE project_id = <project_id>;
   ```

## API Endpoints Summary

| Endpoint | Method | Purpose | Returns |
|----------|--------|---------|---------|
| `/api/projects` | GET | Get projects for current user | Array of projects |
| `/api/projects/all` | GET | Get all projects (admin) | Array of all projects |
| `/api/projects/create` | POST | Create new project | Created project details |
| `/api/projects/with-users` | GET | Get all projects with users | Projects with user assignments |
| `/api/project/<id>/users` | GET | Get users for specific project | Array of users in project |
| `/api/project-users` | GET | Get all available users | Array of all users |

## Browser Console Output Examples

### When loading projects:
```javascript
All Projects with User Assignments: {
  total_projects: 2,
  projects: [
    {
      project_id: 1,
      project_name: "Website Redesign",
      color: "#5e145e",
      created_at: "2026-03-12T10:30:00",
      users: [
        {
          user_id: 5,
          username: "john.doe",
          email: "john@example.com",
          first_name: "John",
          last_name: "Doe",
          display_name: "John Doe",
          role: "User",
          assigned_at: "2026-03-12T10:30:00"
        }
      ],
      user_count: 1
    }
  ]
}
```

### When creating a project:
```javascript
Project created successfully: {
  project_id: 2,
  project_name: "Mobile App",
  color: "#3498db",
  assigned_users: [5, 6, 7]
}
```

## Implementation Files Modified

1. **Backend:** `/new_backend/app.py`
   - Added new endpoint: `GET /api/projects/with-users`
   - Query uses PostgreSQL `json_agg` and `json_build_object`

2. **Frontend:** `/my-vite-app/src/DashBoard.jsx`
   - Enhanced `loadProjects()` function
   - Added logging in `AddProjectModal` component
   - Improved data fetching with fallback mechanism

## Notes

- All timestamps are in ISO 8601 format
- User display names are automatically generated from first_name and last_name, with fallback to username
- The endpoint returns only projects, excluding deleted projects (if a deleted status exists)
- Null users are filtered out using `FILTER (WHERE u.id IS NOT NULL)` in the JSON aggregation
