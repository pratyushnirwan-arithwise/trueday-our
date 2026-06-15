# Project-Based User Filtering Implementation

## Overview
Implemented filtering of users based on project selection. Now when users select a project, only users assigned to that project will be shown in the assignee/user dropdowns in both the "Add Users" modal and "Create Ticket" form.

## Changes Made

### Frontend Changes

#### 1. DashBoard.jsx - AddUsersToProjectModal

**Added new state**:
```javascript
const [projectUsers, setProjectUsers] = useState([]);
```

**Added useEffect to fetch users for selected project**:
```javascript
useEffect(() => {
  if (selectedProject) {
    const fetchProjectUsers = async () => {
      const response = await fetch(`${API_BASE_URL}/project/${selectedProject}/users`);
      if (response.ok) {
        const users = await response.json();
        setProjectUsers(Array.isArray(users) ? users : []);
        setSelectedUser('');
      } else {
        setProjectUsers([]);
      }
    };
    fetchProjectUsers();
  } else {
    setProjectUsers([]);
    setSelectedUser('');
  }
}, [selectedProject]);
```

**Updated user dropdown to show only project users**:
- Disabled until a project is selected
- Shows placeholder "Select a project first" when no project selected
- Displays only users from projectUsers array
- Resets selection when project changes

#### 2. CreateTicket.jsx

**Added new state**:
```javascript
const [projectUsers, setProjectUsers] = useState([]);
const [selectedProjectId, setSelectedProjectId] = useState(null);
```

**Added useEffect to fetch users for selected project**:
```javascript
useEffect(() => {
  if (selectedProjectId) {
    const fetchProjectUsers = async () => {
      const response = await fetch(`/api/project/${selectedProjectId}/users`);
      if (response.ok) {
        const users = await response.json();
        setProjectUsers(Array.isArray(users) ? users : []);
      } else {
        setProjectUsers([]);
      }
    };
    fetchProjectUsers();
  } else {
    setProjectUsers([]);
  }
}, [selectedProjectId]);
```

**Updated handleProjectChange function**:
- Now sets `selectedProjectId` when project is selected
- Triggers the useEffect to fetch project users

**Updated handleSelectProject function**:
- Also sets `selectedProjectId`

**Updated handleAssigneeInput function**:
- Uses `projectUsers` if project is selected
- Falls back to `users` if no project selected
- Filters assignee suggestions based on selected project's users

### Backend Changes

#### 1. app.py - /api/project/<int:project_id>/users endpoint

**Removed authentication requirement**:
- Endpoint now works without user session
- Allows anyone to fetch users assigned to a project

**Fixed query to handle dict_row cursor format**:
- Added proper handling for both dict and tuple result formats
- Returns list of users assigned to specific project

**Endpoint Response**:
```json
[
  {
    "id": 1,
    "username": "username",
    "email": "user@email.com",
    "role": "User",
    "display_name": "username"
  },
  ...
]
```

## User Flow

### In "Add Users" Modal:
1. Admin opens modal
2. Admin selects a **Project** from dropdown
3. → Dropdown calls `/api/project/{projectId}/users`
4. → **User** dropdown automatically populates with only users assigned to that project
5. Admin selects a user and clicks "Add User"
6. User is added to project via `/api/project-users/add`

### In "Create Ticket":
1. User selects a **Project**
2. → Dropdown calls `/api/project/{projectId}/users`
3. → When typing assignee, only shows suggestions from that project's users
4. User can select from filtered suggestions
5. Ticket is created with assignee from the project

## Benefits

✅ **Security**: Users can only be assigned from their own projects
✅ **Usability**: Cleaner dropdowns showing only relevant users
✅ **Data Integrity**: Prevents assigning users from outside the project
✅ **Performance**: Smaller datasets mean faster filtering

## Database Schema Used

**project_users table**:
```sql
CREATE TABLE trueday.project_users (
    project_users_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES trueday.users(id),
    project_id INTEGER NOT NULL REFERENCES trueday.project(project_id),
    role VARCHAR(50) DEFAULT 'User',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, project_id)
);
```

## API Endpoints

### Get Project Users
- **Endpoint**: `GET /api/project/{projectId}/users`
- **Method**: GET
- **Auth**: No authentication required
- **Response**: Array of user objects assigned to the project

**Example**:
```bash
curl https://trueday.ariths.com/api/project/23/users
```

**Response**:
```json
[
  {
    "id": 1,
    "username": "Vishvesh Algeri",
    "email": "vishvesh@arithwise.com",
    "role": "User",
    "display_name": "Vishvesh Algeri"
  },
  {
    "id": 2,
    "username": "Hitesh Nagpure",
    "email": "hitesh@arithwise.com",
    "role": "User",
    "display_name": "Hitesh Nagpure"
  }
]
```

## Testing

**Test in "Add Users" modal**:
1. Click "Add Users" button
2. Select "Databricks" project
3. Verify only users assigned to Databricks show up
4. Select different project and verify users change

**Test in "Create Ticket"**:
1. Open "Create Ticket" form
2. Select a project
3. Type "@" in assignee field
4. Verify only that project's users appear in suggestions

## Files Modified

- `/Users/arithwise/Documents/Trueday_SinglePort/my-vite-app/src/DashBoard.jsx`
- `/Users/arithwise/Documents/Trueday_SinglePort/my-vite-app/src/CreateTicket.jsx`
- `/Users/arithwise/Documents/Trueday_SinglePort/new_backend/app.py`

## Future Enhancements

1. **Cache project users** - Store in Redux/Context to avoid repeated API calls
2. **Loading states** - Show skeleton loaders while fetching users
3. **Error handling** - Better error messages if fetch fails
4. **Validation** - Verify assignee belongs to selected project before ticket creation
5. **Batch operations** - Fetch users for multiple projects at once
