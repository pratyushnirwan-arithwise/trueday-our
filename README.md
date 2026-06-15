# TrueDay - Project Management & Ticket Tracking System

TrueDay is a comprehensive project management and ticket tracking system built with React frontend and Flask backend using a single port architecture. The application provides features for ticket management, team collaboration, progress tracking, and reporting.

## 📁 Project Structure

```
Trueday_SinglePort/
├── my-vite-app/          # Frontend (React + Vite)
├── new_backend/          # Backend (Flask + PostgreSQL) - Single Port Architecture
├── venv/                 # Python Virtual Environment
├── documents/            # Project Documentation
└── README.md            # This file
```

## 🚀 Single Port Architecture

The application uses a single port architecture where the Flask backend serves both the API endpoints and the built React frontend. The backend is configured to serve static files from the React build directory, eliminating the need for separate frontend and backend servers in production.

### Backend Setup

The backend requires Python virtual environment activation before starting:

```bash
# Navigate to backend directory
cd new_backend

# Activate virtual environment (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server (serves both API and frontend)
python app.py
```

### Access the Application
- **Single Port**: http://localhost:5009 (serves both frontend and API)

## 🏗️ Architecture Overview

### Frontend (`my-vite-app/`)

**Technology Stack:**
- **React 18** - UI Framework
- **Vite** - Build Tool & Dev Server
- **React Router DOM** - Client-side Routing
- **Axios** - HTTP Client
- **Framer Motion** - Animations
- **React Beautiful DnD** - Drag & Drop
- **React Toastify** - Notifications

**Key Features:**
- Responsive Dashboard
- Ticket Management System
- Real-time Progress Tracking
- Team Collaboration Tools
- Reports & Analytics
- User Authentication & Authorization

**Directory Structure:**
```
my-vite-app/src/
├── components/           # Reusable UI Components
│   ├── Sidebar.jsx      # Navigation Sidebar
│   ├── Login.jsx        # Authentication Component
│   ├── TicketEditModal.jsx
│   └── test/            # Test Components
├── contexts/            # React Context Providers
│   └── UserContext.jsx  # User State Management
├── services/            # API Services
│   └── api.js          # API Configuration
├── utils/               # Utility Functions
│   ├── secureAuth.js    # Authentication Utils
│   └── crossDomainAuth.js
├── api/                 # API Integration
│   └── auth.js         # Authentication API
├── Pages/               # Page Components
│   └── components/      # Page-specific Components
├── DashBoard.jsx        # Main Dashboard
├── CreateTicket.jsx     # Ticket Creation
├── Tickets.jsx          # Ticket Management
├── Reports.jsx          # Analytics & Reports
├── Calendar.jsx         # Calendar View
├── Profile.jsx          # User Profile
└── App.jsx             # Main App Component
```

### Backend (`new_backend/`)

**Technology Stack:**
- **Flask** - Web Framework
- **PostgreSQL** - Database
- **Flask-CORS** - Cross-Origin Resource Sharing
- **Flask-Bcrypt** - Password Hashing
- **Flask-Mail** - Email Services
- **APScheduler** - Task Scheduling
- **Psycopg2** - PostgreSQL Adapter

**Key Features:**
- RESTful API Endpoints
- User Authentication & Authorization
- Ticket CRUD Operations
- File Upload & Management
- Email Notifications
- Background Task Scheduling
- Database Management

**Directory Structure:**
```
new_backend/
├── app.py              # Main Flask Application (Single Port Server)
├── requirements.txt    # Python Dependencies
├── app.log            # Application Logs
├── attachments/       # File Attachments Storage (189 files)
├── uploads/           # Uploaded Files (8 files)
├── flask_session/     # Session Storage
└── venv/              # Virtual Environment
```

**Single Port Implementation:**
The Flask application is configured to serve static files from the React build directory (`../my-vite-app/dist`), making it a true single port application. The backend handles both API requests and serves the frontend application.

## 🔧 Configuration

### Backend Configuration

1. **Database Setup**
   - Update PostgreSQL connection details in `app.py`
   - Create database tables (run migrations if available)

2. **Email Configuration**
   - Configure SMTP settings in `app.py`:
     ```python
     app.config['MAIL_SERVER'] = 'smtp.office365.com'
     app.config['MAIL_PORT'] = 587
     app.config['MAIL_USE_TLS'] = True
     app.config['MAIL_USERNAME'] = 'your-email@domain.com'
     app.config['MAIL_PASSWORD'] = 'your-app-password'
     ```

3. **CORS Configuration**
   - Backend is configured to accept requests from `http://localhost:3000`

### Frontend Configuration

**API Configuration:**
- API endpoints are configured in `src/config.js` with 37 different endpoints
- Vite configuration includes proxy settings for development
- Electron support for desktop application packaging

**Build Configuration:**
- Optimized build settings with chunk splitting for better performance
- Asset organization with separate directories for images, fonts, and CSS
- Memory-efficient build process using esbuild

## 🔌 API Endpoints

### Authentication
- `POST /register` - User Registration
- `POST /login` - User Login
- `GET /users` - Get Users

### Tickets
- `GET /api/tickets` - Get All Tickets
- `POST /create_ticket` - Create New Ticket
- `PUT /tickets/<id>` - Update Ticket
- `POST /edit-ticket` - Edit Ticket
- `POST /permanently_delete_ticket` - Delete Ticket

### Attachments & Messages
- `POST /upload_attachment` - Upload File
- `GET /get_ticket_attachments` - Get Ticket Attachments
- `POST /add_ticket_message` - Add Message
- `GET /get_ticket_messages` - Get Ticket Messages
- `POST /delete_attachment` - Delete Attachment

### Reports & Analytics
- `GET /api/metricscards` - Get Metrics Cards
- `GET /api/team-performance` - Team Performance Data
- `GET /api/progress-pulse` - Progress Tracking Data

### Contact & Support
- `POST /contact/submit` - Submit Contact Form
- `GET /contact/submissions` - Get Contact Submissions

## 🗄️ Database Schema

The application uses PostgreSQL with the following main entities:
- **Users** - User accounts and authentication
- **Tickets** - Project tickets and tasks
- **Attachments** - File attachments for tickets
- **Messages** - Ticket comments and communications
- **Sessions** - User session management

## 🔐 Security Features

- **Password Hashing** - Using Flask-Bcrypt
- **CORS Protection** - Configured for specific origins
- **Session Management** - Secure session handling
- **File Upload Security** - Secure filename handling
- **Cross-Domain Authentication** - JWT token handling

## 📊 Features

### Dashboard
- Real-time ticket overview
- Progress tracking
- Team performance metrics
- Quick actions and shortcuts

### Ticket Management
- Create, edit, and delete tickets
- File attachments support
- Status tracking and updates
- Priority management
- Assignment and collaboration

### Reports & Analytics
- Team performance metrics
- Ticket status distribution
- Workload analysis
- Progress tracking charts

### User Management
- User registration and authentication
- Profile management
- Role-based access control

## 🚀 Deployment

### Production Build

1. **Build Frontend**
   ```bash
   cd my-vite-app
   npm run build
   ```

2. **Configure Backend**
   - Update database connection for production
   - Configure email settings
   - Set up proper logging

3. **Deploy**
   - Deploy backend to your preferred hosting service
   - Serve frontend build files
   - Configure reverse proxy if needed

## 🐛 Troubleshooting

### Common Issues

1. **Backend Connection Issues**
   - Check if PostgreSQL is running
   - Verify database connection credentials
   - Ensure virtual environment is activated

2. **Frontend Build Issues**
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Check Node.js version compatibility
   - Verify all dependencies are installed

3. **CORS Issues**
   - Ensure backend CORS is configured for frontend URL
   - Check proxy settings in vite.config.js

---

**Note:** This README provides a comprehensive overview of the TrueDay single port architecture project. The application serves both frontend and backend from a single Flask server, simplifying deployment and reducing infrastructure complexity.
