# Project Management System - Architecture & Flow

## Database Schema Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE SCHEMA                          │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐
│  trueday.users   │         │trueday.project   │
├──────────────────┤         ├──────────────────┤
│ id (PK)          │         │project_id (PK)   │
│ username         │         │project_name      │
│ email            │         │color             │
│ first_name       │         │created_at        │
│ last_name        │         └──────────────────┘
│ password         │                  ▲
│ role             │                  │
│ ...              │                  │ FK
└──────────────────┘                  │
        ▲                             │
        │                    ┌────────┴──────────────────┐
        │ FK                 │                           │
        │                    │                           │ FK
        │            ┌───────────────────────────┐      │
        └────────────│  project_users (NEW)      │      │
                     ├───────────────────────────┤      │
                     │ project_users_id (PK)     │      │
                     │ user_id (FK) ──────────────      │
                     │ project_id (FK) ──────────────────┘
                     │ role (default 'User')    │
                     │ created_at               │
                     │ UNIQUE(user_id,proj_id)  │
                     └───────────────────────────┘
                                ▲
                                │ Many users per project
                                │ Many projects per user
                                │
                                └─ Links users to projects
```

---

## API Endpoint Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│            FRONTEND ADMIN DASHBOARD                         │
│                                                             │
│  [Add Project Button] ──► showAddProjectModal = true       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│            AddProjectModal Opens                            │
│                                                             │
│  1. Fetch all users ──► GET /api/project-users             │
│  2. User fills form:                                        │
│     - Project name                                         │
│     - Color (HTML5 picker)                                 │
│     - Select users (checkboxes)                            │
│  3. Click "Create Project"                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│      POST /api/projects/create (Admin Only)                │
│                                                             │
│  Validation:                                               │
│  ✓ User is authenticated                                   │
│  ✓ User is admin (session_id in ALLOWED_IDS)              │
│  ✓ Project name not empty                                  │
│  ✓ At least one user selected                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│        Backend Processing                                  │
│                                                             │
│  1. INSERT INTO project (name, color)                      │
│     ↓ Returns project_id                                   │
│                                                             │
│  2. FOR EACH selected user_id:                             │
│     INSERT INTO project_users (user_id, project_id, role)  │
│     ON CONFLICT DO NOTHING (prevents duplicates)           │
│                                                             │
│  3. COMMIT transaction                                     │
│  4. Return success response                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│        Frontend Success Handling                           │
│                                                             │
│  1. Show toast: "Project created successfully!"            │
│  2. Call onProjectCreated callback                         │
│  3. loadProjects() fetches updated list                    │
│  4. Close modal                                            │
│  5. Project appears in dropdowns for assigned users        │
└─────────────────────────────────────────────────────────────┘
```

---

## Ticket Creation Authorization Flow

```
┌─────────────────────────────────────────────────────────────┐
│            USER CREATES TICKET                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│        Select Project from Dropdown                         │
│        (Only shows assigned projects)                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│        Fill Ticket Details & Submit                         │
│        POST /create_ticket                                  │
│        {                                                    │
│          title, description, priority, ...,                │
│          creator_id, project_id                            │
│        }                                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│        Backend Authorization Check (NEW)                    │
│                                                             │
│  IF project_id is set:                                     │
│    SELECT 1 FROM project_users                             │
│    WHERE user_id = creator_id                              │
│    AND project_id = selected_project_id                    │
│                                                             │
│    IF NOT FOUND:                                           │
│      ↓ Return 403 Forbidden                                │
│      "You are not assigned to this project"                │
│                                                             │
│    IF FOUND:                                               │
│      ↓ Continue to next step                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌──────┴──────┐
                    │             │
          ✅ Authorized    ❌ Not Authorized
                    │             │
                    ▼             ▼
          Create Ticket      Return Error
          Insert into        (User not in
          tickets table      project_users)
                    │             │
                    └──────┬──────┘
                           ▼
                    Response to Frontend
```

---

## User Project Assignment Flow

```
┌─────────────────────────────────────────────────────────────┐
│              USER LOGS IN                                  │
│              POST /login                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│         Backend Creates Session                             │
│         session['user_id'] = user.id                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│       Dashboard Mounts → loadProjects()                     │
│       GET /api/projects                                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│        Backend Query (Only assigned projects)               │
│                                                             │
│  SELECT DISTINCT p.project_id, p.project_name,            │
│         p.color, p.created_at, pu.role                     │
│  FROM project p                                             │
│  INNER JOIN project_users pu                               │
│    ON p.project_id = pu.project_id                         │
│  WHERE pu.user_id = [logged_in_user_id]                    │
│  ORDER BY p.project_name                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│     Frontend Receives User's Projects                       │
│     Populates Project Dropdown                              │
│     User can only see/select assigned projects              │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    DashBoard.jsx                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  State:                                                  │
│  ├─ projects: []                                         │
│  ├─ showAddProjectModal: false                           │
│  ├─ canAccessRestrictedFeatures: boolean                 │
│  └─ other dashboard state...                             │
│                                                          │
│  Methods:                                                │
│  ├─ loadProjects()                                       │
│  ├─ handleProjectCreated()                               │
│  └─ other handlers...                                    │
│                                                          │
│  Renders:                                                │
│  ├─ Dashboard Header                                     │
│  │  ├─ [Create Ticket] button                            │
│  │  ├─ [Add Bucket] button                               │
│  │  ├─ [Add Project] button ◄── NEW                      │
│  │  └─ [Deleted Tickets] button                          │
│  │                                                       │
│  ├─ Project Filter Dropdown                              │
│  ├─ Ticket Board                                         │
│  │                                                       │
│  └─ Modals:                                              │
│     ├─ EditTicket                                        │
│     ├─ CreateTicket                                      │
│     ├─ AddStatusModal                                    │
│     └─ AddProjectModal ◄── NEW                           │
│         ├─ Project Name Input                            │
│         ├─ Color Picker                                  │
│         └─ Users Multi-Select                            │
└──────────────────────────────────────────────────────────┘
```

---

## Data Flow Sequence Diagram

```
Admin                Frontend             Backend             Database
  │                    │                    │                    │
  ├─ Click "Add Project"─►                 │                    │
  │                    │                    │                    │
  │         ◄─── Modal Opens ──────────────┤                    │
  │                    │                    │                    │
  │                    ├─ Fetch Users ─────►│                    │
  │                    │                    │                    │
  │                    │                    ├─ Query Users Table ►
  │                    │                    │◄──── User List ────┤
  │                    │◄─── User List ─────┤                    │
  │                    │                    │                    │
  ├─ Fill Form ───────►│                    │                    │
  │ (name, color,      │                    │                    │
  │  users)            │                    │                    │
  │                    │                    │                    │
  ├─ Click "Create" ──►│                    │                    │
  │                    │                    │                    │
  │                    ├─ POST Create ─────►│                    │
  │                    │   /projects/create │                    │
  │                    │                    │                    │
  │                    │                    ├─ Check Admin ──────┐
  │                    │                    │◄─ Admin Check ─────┤
  │                    │                    │                    │
  │                    │                    ├─ INSERT Project ──►│
  │                    │                    │◄─ project_id ─────┤
  │                    │                    │                    │
  │                    │                    ├─ INSERT Each User ►
  │                    │                    │   into project_users
  │                    │                    │◄─ Assignments OK ──┤
  │                    │                    │                    │
  │                    │◄─── Success ───────┤                    │
  │◄─── Toast Shown ───│                    │                    │
  │                    │                    │                    │
  │                    ├─ loadProjects() ──►│                    │
  │                    │                    │                    │
  │                    │                    ├─ Query Assigned ──►
  │                    │                    │   Projects
  │                    │                    │◄─ Project List ───┤
  │                    │◄─── Projects ──────┤                    │
  │                    │                    │                    │
  │◄─── Modal Closes ──│                    │                    │
  │                    │                    │                    │
  ├─ Sees New Project ─┤                    │                    │
  │   in Dropdown      │                    │                    │
```

---

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│              SECURITY IMPLEMENTATION                        │
└─────────────────────────────────────────────────────────────┘

Layer 1: Authentication
├─ Session validation: User must be logged in
├─ Session cookie: HTTPOnly, Secure flags set
└─ Check: session['user_id'] exists

Layer 2: Authorization (Admin Only)
├─ Endpoint: /api/projects/create
├─ Check: session['id'] in ALLOWED_SESSION_IDS
├─ Allowed IDs: ['1', '2', '3', '7', '8']
└─ Error: 403 Forbidden if not admin

Layer 3: Project Access Control
├─ Endpoint: /create_ticket
├─ Check: User in project_users table
├─ Query: SELECT * FROM project_users 
│         WHERE user_id = ? AND project_id = ?
└─ Error: 403 "You are not assigned to this project"

Layer 4: Data Integrity
├─ Foreign Keys: CASCADE on delete
├─ Unique Constraints: (user_id, project_id)
└─ Prevents: Duplicate assignments, orphaned records

Layer 5: User Data Protection
├─ No DELETE operations on users table
├─ No UPDATE operations on user data
├─ Only SELECT to read user information
└─ Ariths system data: READ-ONLY
```

---

## Error Handling Flow

```
Error Scenario              Response Status     Error Message
─────────────────           ────────────────    ─────────────────────────
User not authenticated      401                 "User not authenticated"

Non-admin tries to
create project             403                 "Only admins can create 
                                               projects"

Project name empty          400                 "Project name is required"

No users selected           400                 "At least one user must
                                               be assigned"

User not in project         403                 "You are not assigned to
when creating ticket                           this project"

Duplicate user in           (silently ignored   ON CONFLICT DO NOTHING
project                     via DB constraint)

Database error             500                  "Error message from DB"
```

---

## Performance Considerations

```
Optimization               Implementation
──────────────            ──────────────────────────────────
Reduced queries           ✓ Projects cached in frontend state
                          ✓ INNER JOIN for efficient data fetch

Prevented N+1             ✓ Query includes user info directly
queries                   ✓ No separate loops for user data

Connection pooling        ✓ get_db_connection() manages pool

Indexes needed            ○ Consider adding index on:
(optional)               - project_users(user_id)
                         - project_users(project_id)
                         - project_users(user_id, project_id)

Cache invalidation        ✓ loadProjects() called after creation
                         ✓ UI automatically updates
```

---

## Deployment Checklist

```
Backend Deployment
─────────────────
□ Update requirements.txt if needed
□ Run: python new_backend/app.py
□ Check logs for successful table creation
□ Verify project_users table exists
□ Test endpoints with curl/Postman

Frontend Deployment
──────────────────
□ npm install (no new dependencies)
□ npm run build
□ Verify DashBoard.jsx compiles
□ No TypeScript errors

Testing
─────────────
□ Test as admin user
□ Create test project
□ Assign users
□ Check project appears in user dashboards
□ Try creating ticket in assigned project
□ Try creating ticket in unassigned project (should fail)
```

---

This architecture ensures:
- ✅ Security: Users can only access assigned projects
- ✅ Flexibility: Admins can manage projects
- ✅ Scalability: Efficient queries with proper indexing
- ✅ Data Integrity: Foreign keys and constraints
- ✅ User Safety: Ariths data never modified
