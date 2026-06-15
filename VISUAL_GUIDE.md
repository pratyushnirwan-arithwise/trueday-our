# Visual Guide: Fetch Projects with Users Feature

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        DASHBOARD LOADS                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  loadProjects()     │
                    │  called on mount    │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  GET /api/projects/ │
                    │  with-users         │
                    └─────────────────────┘
                              │
                              ▼
           ┌──────────────────────────────────┐
           │   PostgreSQL Database Query      │
           │                                  │
           │  SELECT p.*, u.* ...           │
           │  FROM project p                 │
           │  LEFT JOIN project_users pu    │
           │  LEFT JOIN users u              │
           │  GROUP BY p.project_id          │
           │  json_agg(user_data)            │
           └──────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  API Response JSON  │
                    │  {                  │
                    │    total_projects: 2│
                    │    projects: [      │
                    │      {              │
                    │    project_id: 1    │
                    │    project_name: ...|
                    │    users: [...]     │
                    │      }              │
                    │    ]                │
                    │  }                  │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  setProjects(data)  │
                    └─────────────────────┘
                              │
                              ▼
           ┌──────────────────────────────────┐
           │   Console Output:                │
           │   All Projects with User         │
           │   Assignments: {...}             │
           └──────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Dashboard Renders  │
                    │  with Projects      │
                    └─────────────────────┘
```

## Create Project Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              USER CLICKS "ADD PROJECT" BUTTON                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  AddProjectModal    │
                    │  Opens              │
                    └─────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────┐
            │  User Fills Form:                │
            │  - Project Name                  │
            │  - Color Picker                  │
            │  - Select Users (1 to many)      │
            └─────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Click "Create      │
                    │  Project"           │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  POST /api/projects/│
                    │  create             │
                    │  {                  │
                    │  project_name,      │
                    │  color,             │
                    │  user_ids: [...]    │
                    │  }                  │
                    └─────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │    Backend Creates:                      │
        │                                          │
        │    1. INSERT into project table          │
        │       ↓ returns project_id               │
        │                                          │
        │    2. INSERT into project_users table    │
        │       for each user_id                   │
        │       ↓ creates assignment records       │
        │                                          │
        │    3. COMMIT transaction                 │
        └─────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  API Response:      │
                    │  {                  │
                    │    success: true    │
                    │    project_id: N    │
                    │    project_name: ...|
                    │    color: ...       │
                    │  }                  │
                    └─────────────────────┘
                              │
                              ▼
           ┌──────────────────────────────────┐
           │   Console Output:                │
           │   Project created successfully: │
           │   {                              │
           │   project_id: N,                 │
           │   project_name: ...,             │
           │   color: ...,                    │
           │   assigned_users: [...]          │
           │   }                              │
           └──────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Show Toast         │
                    │  Notification       │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  onProjectCreated   │
                    │  Callback Triggered │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  loadProjects()     │
                    │  Called             │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  GET /api/projects/ │
                    │  with-users         │
                    └─────────────────────┘
                              │
                              ▼
           ┌──────────────────────────────────┐
           │   Console Output:                │
           │   All Projects with User         │
           │   Assignments: {...}             │
           │   (includes new project!)        │
           └──────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Modal Closes       │
                    └─────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Dashboard Updated with New Project │
        └─────────────────────────────────────┘
```

## Data Structure Hierarchy

```
API Response
│
└── success: boolean
└── total_projects: number
│
└── projects: Array
    │
    └── [0]: Project Object
    │   │
    │   ├── project_id: 1
    │   ├── project_name: "Website Redesign"
    │   ├── color: "#5e145e"
    │   ├── created_at: "2026-03-12T10:30:00"
    │   ├── user_count: 2
    │   │
    │   └── users: Array
    │       │
    │       ├── [0]: User Assignment
    │       │   ├── user_id: 5
    │       │   ├── username: "john.doe"
    │       │   ├── email: "john@example.com"
    │       │   ├── first_name: "John"
    │       │   ├── last_name: "Doe"
    │       │   ├── display_name: "John Doe"
    │       │   ├── role: "User"
    │       │   └── assigned_at: "2026-03-12T10:30:00"
    │       │
    │       └── [1]: User Assignment
    │           ├── user_id: 6
    │           ├── username: "jane.smith"
    │           ├── email: "jane@example.com"
    │           ├── first_name: "Jane"
    │           ├── last_name: "Smith"
    │           ├── display_name: "Jane Smith"
    │           ├── role: "User"
    │           └── assigned_at: "2026-03-12T10:30:00"
    │
    └── [1]: Project Object
        ├── project_id: 2
        ├── project_name: "Mobile App"
        ├── color: "#3498db"
        ├── created_at: "2026-03-12T11:00:00"
        ├── user_count: 1
        │
        └── users: Array
            └── [0]: User Assignment
                ├── user_id: 5
                ├── username: "john.doe"
                ├── email: "john@example.com"
                ├── first_name: "John"
                ├── last_name: "Doe"
                ├── display_name: "John Doe"
                ├── role: "User"
                └── assigned_at: "2026-03-12T11:00:00"
```

## Database Schema Relationship

```
┌──────────────────────────────────────────┐
│           trueday.project                │
├──────────────────────────────────────────┤
│ project_id (PK)    │ SERIAL              │
│ project_name       │ VARCHAR(255)        │
│ color              │ VARCHAR(7)          │
│ created_at         │ TIMESTAMP           │
└──────────────────────────────────────────┘
           │
           │ ONE-TO-MANY
           │
           ▼
┌──────────────────────────────────────────┐
│      trueday.project_users (JOIN TABLE)  │
├──────────────────────────────────────────┤
│ id (PK)            │ SERIAL              │
│ user_id (FK)       │ → users.id          │
│ project_id (FK)    │ → project.project_id│
│ role               │ VARCHAR(50)         │
│ created_at         │ TIMESTAMP           │
└──────────────────────────────────────────┘
           │
           │ MANY-TO-ONE
           │
           ▼
┌──────────────────────────────────────────┐
│           trueday.users                  │
├──────────────────────────────────────────┤
│ id (PK)            │ SERIAL              │
│ username           │ VARCHAR(255) UNIQUE │
│ email              │ VARCHAR(255) UNIQUE │
│ first_name         │ VARCHAR(100)        │
│ last_name          │ VARCHAR(100)        │
│ ... (other fields) │                     │
└──────────────────────────────────────────┘
```

## Component Interaction

```
┌─────────────────────────────────────────────────────┐
│         DashBoard Component (React)                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  State:                                            │
│  - projects: Array<Project>                        │
│  - showAddProjectModal: boolean                    │
│                                                     │
│  Functions:                                        │
│  - loadProjects()                                  │
│    └─ GET /api/projects/with-users               │
│    └─ setProjects(data.projects)                  │
│    └─ console.log(All Projects...)                │
│                                                     │
│  Renders:                                          │
│  - AddProjectModal (when showAddProjectModal=true)│
│    └─ onProjectCreated={() => loadProjects()}     │
│                                                     │
│  ▼                                                  │
│  ┌──────────────────────────────────────┐          │
│  │  AddProjectModal Component (React)   │          │
│  ├──────────────────────────────────────┤          │
│  │                                      │          │
│  │  State:                              │          │
│  │  - projectName: string               │          │
│  │  - color: string (#hex)              │          │
│  │  - selectedUsers: Array<number>      │          │
│  │                                      │          │
│  │  Functions:                          │          │
│  │  - handleSubmit()                    │          │
│  │    └─ POST /api/projects/create     │          │
│  │    └─ console.log(Project created..)|          │
│  │    └─ setShowToast(true)             │          │
│  │    └─ onProjectCreated() [callback]  │          │
│  │    └─ onClose()                      │          │
│  │                                      │          │
│  │  Form Fields:                        │          │
│  │  - Project Name input                │          │
│  │  - Color picker                      │          │
│  │  - User checkboxes (multi-select)    │          │
│  │                                      │          │
│  │  Buttons:                            │          │
│  │  - Create Project (submit)           │          │
│  │  - Cancel                            │          │
│  └──────────────────────────────────────┘          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Console Log Timeline

```
Timeline of Console Logs During Project Creation:

T=0.0s   Page Loads
         ↓
T=0.1s   Dashboard mounts, loadProjects() called
         ↓
T=0.5s   GET /api/projects/with-users response received
         ↓
T=0.6s   ✅ Console: "All Projects with User Assignments: {...}"
         
T=5.0s   User clicks "Add Project" button
         ↓
T=5.5s   AddProjectModal opens
         
T=20.0s  User submits form
         ↓
T=20.2s  POST /api/projects/create request sent
         ↓
T=20.5s  Backend creates project record
         ↓
T=20.6s  Backend creates project_users records
         ↓
T=20.7s  POST response received with project_id
         ↓
T=20.8s  ✅ Console: "Project created successfully: {...}"
         ↓
T=21.0s  Toast notification shown
         ↓
T=21.1s  onProjectCreated callback triggers
         ↓
T=21.2s  loadProjects() called again
         ↓
T=21.3s  GET /api/projects/with-users request sent
         ↓
T=21.8s  GET response received (includes new project!)
         ↓
T=21.9s  ✅ Console: "All Projects with User Assignments: {...}"
         
T=22.5s  Modal closes automatically (after 1.5s toast)
         ↓
T=22.6s  Dashboard updates with new project visible
```

## API Call Sequence

```
Request 1: Fetch Projects with Users
─────────────────────────────────────
GET /api/projects/with-users
  Accept: application/json
  Authorization: (session cookie)

Response:
  ✓ 200 OK
  Content-Type: application/json
  {
    "success": true,
    "total_projects": 2,
    "projects": [...]
  }


Request 2: Create Project
─────────────────────────
POST /api/projects/create
  Content-Type: application/json
  Authorization: (session cookie)
  
  Body:
  {
    "project_name": "New Project",
    "color": "#5e145e",
    "user_ids": [5, 6, 7]
  }

Response:
  ✓ 201 Created
  Content-Type: application/json
  {
    "success": true,
    "project_id": 3,
    "project_name": "New Project",
    "color": "#5e145e",
    "message": "Project created successfully"
  }


Request 3: Fetch Projects Again (Refresh)
──────────────────────────────────────────
GET /api/projects/with-users
  Accept: application/json
  Authorization: (session cookie)

Response:
  ✓ 200 OK
  Content-Type: application/json
  {
    "success": true,
    "total_projects": 3,  ← Includes new project!
    "projects": [...]
  }
```

## Feature Capabilities

```
What You Can Do:
═══════════════════════════════════════════════════════

✓ View all projects in your organization
  └─ Complete project metadata
  └─ All assigned users per project
  └─ User details (name, email, role, etc.)
  └─ Assignment dates and timestamps

✓ Create new projects with user assignments
  └─ Assign multiple users at creation time
  └─ Choose custom color for project
  └─ Automatic data persistence

✓ Monitor data via console logs
  └─ See all projects with users on load
  └─ See new project details on creation
  └─ Track project updates in real-time

✓ Access structured data in React state
  └─ projects[].project_id
  └─ projects[].project_name
  └─ projects[].color
  └─ projects[].users (with full details)
  └─ projects[].user_count

✓ Build features on top
  └─ Project filtering by user
  └─ Project member management
  └─ Project statistics
  └─ User-to-project assignments
  └─ Project activity tracking
```
