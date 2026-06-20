from flask import Flask, jsonify, request, make_response, session, redirect, send_from_directory, Response
import os
import queue
import psycopg
from psycopg.rows import dict_row
from psycopg2.extras import RealDictCursor
from psycopg import sql

from flask_cors import CORS
from datetime import datetime, timedelta, time, date
from werkzeug.utils import secure_filename
import os
import time
import re
from flask_bcrypt import Bcrypt
from flask_mail import Mail, Message
import logging
from functools import wraps
import json
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
from pytz import timezone
import pytz
from threading import Thread

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Get the absolute path to the React build directory
REACT_BUILD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'my-vite-app', 'dist'))

app = Flask(__name__, static_folder=REACT_BUILD_DIR, static_url_path='')

from werkzeug.middleware.proxy_fix import ProxyFix

# NOTE: keep the single Flask app instance created above so the
# static_folder (REACT_BUILD_DIR) and static_url_path are preserved.
# Do NOT re-instantiate `app` here (that was overwriting the configured
# instance and caused static serving / catch-all routes to fail with 404).

# MUST be first
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Then extensions
CORS(app, supports_credentials=True)

app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True').lower() == 'true'
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER')

 
# app.config['MAIL_DEFAULT_SENDER'] = 'ariths@arithwise.com'
 
# Initialize Flask-Mail
mail = Mail(app)

# Configure session
# ⚠️ FIXED: Use a stable secret key so sessions survive Flask restarts.
# os.urandom(24) was generating a new key on every restart, wiping all sessions.
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'trueday-stable-secret-key-2025-do-not-change')
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
# ⚠️ FIXED: Extended from 15 minutes to 24 hours so sessions persist across refreshes
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)
app.config['SESSION_REFRESH_EACH_REQUEST'] = True  # sliding expiration

# Initialize Bcrypt
bcrypt = Bcrypt(app)

# Refresh jwt cookie idle timeout to 1 minute on every response
@app.after_request
def refresh_jwt_idle_timeout(response):
    try:
        token = request.cookies.get('jwt')
        if token:
            # Set expiry to 60 seconds from now (idle timeout)
            new_expires = datetime.utcnow() + timedelta(minutes=15)
            # Derive secure flag (defaults to False for local/dev; True when behind HTTPS proxy)
            secure_flag = (request.headers.get('X-Forwarded-Proto', 'http') == 'https')
            response.set_cookie(
                'jwt',
                token,
                max_age=900,
                expires=new_expires,
                httponly=True,
                domain=".ariths.com", 
                secure=secure_flag
            )
    except Exception as e:
        try:
            logger.debug(f"JWT idle-time refresh skipped: {e}")
        except Exception:
            pass
    return response

# Database configuration
DB_HOST = os.getenv('DB_HOST')
DB_PORT = os.getenv('DB_PORT')
DB_NAME = os.getenv('DB_NAME')
DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')

# Add allowed file types
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Workflow validation function
def validate_workflow_transition(current_status, new_status):
    """Validate if the status transition follows the workflow rules"""
    status_flow = {
        'NEW': ['IN PROGRESS'],
        'IN PROGRESS': ['BLOCKED', 'QA', 'COMPLETED'],
        'BLOCKED': ['IN PROGRESS'],
        'QA': ['IN PROGRESS', 'COMPLETED']
    }
    
    current_status_upper = current_status.upper() if current_status else None
    new_status_upper = new_status.upper() if new_status else None
    
    # If no status change, allow it
    if current_status_upper == new_status_upper:
        return {'valid': True}
    
    # Check if the transition is allowed
    allowed_transitions = status_flow.get(current_status_upper, [])
    if not allowed_transitions:
        return {'valid': False, 'message': f'Invalid current status: {current_status}'}
    
    if new_status_upper not in allowed_transitions:
        allowed_statuses = ', '.join(allowed_transitions)
        return {
            'valid': False, 
            'message': f'Invalid status transition. From "{current_status}" you can only move to: {allowed_statuses}'
        }
    
    return {'valid': True}

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Ensure attachments folder exists
ATTACHMENTS_FOLDER = os.path.join(os.getcwd(), 'attachments')
if not os.path.exists(ATTACHMENTS_FOLDER):
    os.makedirs(ATTACHMENTS_FOLDER)

def get_db_connection():
    try:
        logger.debug(f"Attempting to connect to database: {DB_NAME} on {DB_HOST}:{DB_PORT}")
        conn = psycopg.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            
            row_factory=dict_row
        )
        logger.info("Database connection successful!")
        return conn
    except Exception as e:
        logger.error(f"Error connecting to the database: {e}")
        raise

# Global list of active SSE client queues
sse_clients = []

def announce_notification(user_id):
    def delay_announce():
        try:
            import time
            time.sleep(1.0)  # Wait for database transaction to commit
            logger.debug(f"Announcing notification for user_id={user_id} to active SSE clients")
            for client_queue, client_user_id in list(sse_clients):
                if str(client_user_id) == str(user_id):
                    try:
                        client_queue.put_nowait("refresh")
                    except Exception:
                        pass
        except Exception as e:
            logger.error(f"Error in delay_announce: {e}")
    try:
        from threading import Thread
        Thread(target=delay_announce).start()
    except Exception as e:
        logger.error(f"Error starting announce thread: {e}")

def create_notification(cursor, user_id, title, message, notification_type, related_entity_id=None, priority='Medium'):
    if not user_id:
        return
    try:
        cursor.execute("""
            INSERT INTO trueday.notifications (
                user_id, title, message, notification_type, priority, status, created_at, related_entity_type, related_entity_id
            ) VALUES (%s, %s, %s, %s, %s, 'unread', NOW(), 'ticket', %s)
        """, (user_id, title, message, notification_type, priority, related_entity_id))
        logger.info(f"Notification created for user {user_id}: {title}")
        announce_notification(user_id)
    except Exception as e:
        logger.error(f"Error creating notification for user_id={user_id}: {e}")
        print(f"!! NOTIFICATION ERROR for user_id={user_id}: {e}")

# # Test route to check if the app is running
@app.route('/test', methods=['GET'])
def test_endpoint():
    return jsonify({"status": "Backend is running", "timestamp": datetime.now().isoformat()}), 200

@app.route('/api/debug/sse_clients', methods=['GET'])
def debug_sse_clients():
    clients_info = []
    for q, uid in sse_clients:
        clients_info.append({
            'user_id': uid,
            'queue_size': q.qsize()
        })
    return jsonify({
        'active_clients': clients_info,
        'count': len(sse_clients)
    }), 200

# ---------------------------------------------------------------
# DEV ONLY — auto-login bypass for local testing
# Usage: GET /dev/auto-login?user_id=<id>
# Blocked if app.debug is False (i.e. never works in production)
# ---------------------------------------------------------------
#@app.route('/dev/auto-login', methods=['GET'])
#def dev_auto_login():
#    if not app.debug:
#        return jsonify({'error': 'Not available in production'}), 403
#
#    user_id = request.args.get('user_id', type=int)
#    if not user_id:
#        # No user_id given — list available users to pick from
#        try:
#            conn = get_db_connection()
#            cur = conn.cursor()
#            cur.execute("SELECT id, username, email, role FROM trueday.users ORDER BY id LIMIT 20;")
#            users = [dict(row) for row in cur.fetchall()]
#            cur.close()
#            conn.close()
#            return jsonify({
#                'message': 'Pass ?user_id=<id> to auto-login. Available users:',
#                'users': users
#            }), 200
#        except Exception as e:
#            return jsonify({'error': str(e)}), 500
#
#    try:
#        conn = get_db_connection()
#        cur = conn.cursor()
#        cur.execute("SELECT id, username, email, role FROM trueday.users WHERE id = %s", (user_id,))
#        user = cur.fetchone()
#        cur.close()
#        conn.close()
#
#        if not user:
#            return jsonify({'error': f'No user with id={user_id}'}), 404
#
#        session.permanent = True
#        session['user_id'] = user['id']
#        session['name']    = user['username']
#        session['email']   = user['email']
#        session['role']    = user['role']
#
#        return jsonify({
#            'message': f"Dev session set — logged in as '{user['username']}' (id={user['id']}, role={user['role']})",
#            'user': dict(user)
#        }), 200
#
#    except Exception as e:
#        return jsonify({'error': str(e)}), 500
#
# @app.route('/', defaults={'path': ''})
# @app.route('/<path:path>')
# def serve(path):
#     if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
#         return send_from_directory(app.static_folder, path)
#     else:
#         return send_from_directory(app.static_folder, 'index.html')

# Authentication decorator
def authenticate(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        logger.debug("Authentication decorator called")
        token = request.headers.get('Authorization')
        if not token:
            logger.warning("No authorization token provided")
            return jsonify({"error": "Unauthorized"}), 401

        # Simulate token decoding (replace with actual logic)
        user_id = decode_token(token)  # Replace with your JWT decoding logic
        if not user_id:
            logger.warning("Invalid authorization token")
            return jsonify({"error": "Invalid token"}), 401

        logger.info(f"User {user_id} authenticated successfully")
        # Pass the user_id to the wrapped function
        return f(user_id, *args, **kwargs)
    return decorated_function

# JWT token generation function
def generate_jwt_token(user_id, username, email=None):
    """Generate JWT token for cross-domain authentication"""
    try:
        payload = {
            'user_id': user_id,
            'username': username,
            'email': email,
            'iat': datetime.utcnow(),
            'exp': datetime.utcnow() + timedelta(hours=24),  # 24 hour expiration
            'iss': 'trueday.ariths.com',  # Issuer
            'aud': 'trueday.ariths.com'    # Audience
        }
        
        token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
        logger.debug(f"Generated JWT token for user_id: {user_id}")
        return token
        
    except Exception as e:
        logger.error(f"Error generating JWT token: {e}")
        return None

# JWT token validation function
def decode_token(token):
    """Decode and validate JWT token"""
    try:
        if not token:
            return None
            
        # Remove 'Bearer ' prefix if present
        if token.startswith('Bearer '):
            token = token[7:]
            
        # Decode JWT token
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        user_id = payload.get('user_id')
        
        if not user_id:
            logger.warning("No user_id found in token")
            return None
            
        logger.debug(f"Successfully decoded token for user_id: {user_id}")
        return user_id
        
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {e}")
        return None
    except Exception as e:
        logger.error(f"Error decoding token: {e}")
        return None

# Secure session validation function
def validate_session_access(requested_session_id, jwt_token):
    """
    Validate that the requested session_id matches the user_id in the JWT token.
    This prevents users from accessing other users' sessions by tampering with URL parameters.
    """
    try:
        # Decode JWT token to get the actual user_id
        actual_user_id = decode_token(jwt_token)
        
        if not actual_user_id:
            logger.warning("Invalid JWT token in session validation")
            return False
            
        # Convert both to strings for comparison
        requested_id = str(requested_session_id)
        actual_id = str(actual_user_id)
        
        # Check if the requested session_id matches the user_id in the token
        if requested_id != actual_id:
            logger.warning(f"Session access denied: requested_id={requested_id}, actual_id={actual_id}")
            return False
            
        logger.debug(f"Session access validated for user_id: {actual_id}")
        return True
        
    except Exception as e:
        logger.error(f"Error validating session access: {e}")
        return False

# Secure session decorator
def secure_session_required(f):
    """
    Decorator that validates session access by checking JWT token against sessionid parameter.
    This prevents URL parameter tampering attacks.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Get sessionid from query parameters
            sessionid = request.args.get('sessionid')
            if not sessionid:
                logger.warning("No sessionid provided in request")
                return jsonify({"error": "Session ID required"}), 400
            
            # Get JWT token from Authorization header or cookie
            jwt_token = request.headers.get('Authorization')
            if not jwt_token:
                # Try to get from cookie as fallback
                jwt_token = request.cookies.get('jwt')
            
            if not jwt_token:
                logger.warning("No JWT token provided for session validation")
                return jsonify({"error": "Authentication required"}), 401
            
            # Validate session access
            if not validate_session_access(sessionid, jwt_token):
                logger.warning(f"Session access denied for sessionid: {sessionid}")
                return jsonify({"error": "Access denied"}), 403
            
            # If validation passes, call the original function
            return f(*args, **kwargs)
            
        except Exception as e:
            logger.error(f"Error in secure session validation: {e}")
            return jsonify({"error": "Session validation failed"}), 500
    
    return decorated_function

# Secure URL generation function
def generate_secure_url(user_id, path, access_type="User"):
    """
    Generate a secure URL with encrypted session parameters to prevent tampering.
    """
    try:
        import base64
        import hmac
        import hashlib
        
        # Create a secure token that includes user_id, timestamp, and signature
        timestamp = str(int(time.time()))
        data = f"{user_id}:{timestamp}:{access_type}"
        
        # Create HMAC signature
        signature = hmac.new(
            SECRET_KEY.encode(),
            data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        # Encode the secure token
        secure_token = base64.b64encode(f"{data}:{signature}".encode()).decode()
        
        # Generate the secure URL
        secure_url = f"https://trueday.ariths.com/?token={secure_token}#{path}"
        
        logger.debug(f"Generated secure URL for user_id: {user_id}")
        return secure_url
        
    except Exception as e:
        logger.error(f"Error generating secure URL: {e}")
        return None

# Secure token validation function
def validate_secure_token(token):
    """
    Validate a secure token and extract user information.
    """
    try:
        import base64
        import hmac
        import hashlib
        
        # Decode the token
        decoded_data = base64.b64decode(token.encode()).decode()
        data, signature = decoded_data.rsplit(':', 1)
        
        # Verify the signature
        expected_signature = hmac.new(
            SECRET_KEY.encode(),
            data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
            logger.warning("Invalid token signature")
            return None
        
        # Extract user information
        user_id, timestamp, access_type = data.split(':')
        
        # Check if token is not too old (e.g., 1 hour)
        current_time = int(time.time())
        token_time = int(timestamp)
        if current_time - token_time > 3600:  # 1 hour
            logger.warning("Token has expired")
            return None
        
        logger.debug(f"Validated secure token for user_id: {user_id}")
        return {
            'user_id': user_id,
            'access_type': access_type,
            'timestamp': timestamp
        }
        
    except Exception as e:
        logger.error(f"Error validating secure token: {e}")
        return None

# # Test email endpoint
# @app.route('/test_email', methods=['GET'])
# def test_email():
#     """Test endpoint to verify email functionality"""
#     try:
#         print("🧪 Testing email functionality...")
#         msg = Message(
#             subject="Test Email from Trueday",
#             recipients=['ariths@arithwise.com'],
#             body="This is a test email to verify email functionality is working."
#         )
#         mail.send(msg)
#         print("✅ Test email sent successfully!")
#         return jsonify({"message": "Test email sent successfully"}), 200
#     except Exception as e:
#         print(f"❌ Error sending test email: {e}")
#         import traceback
#         traceback.print_exc()
#         return jsonify({"error": str(e)}), 500





# Route to fetch users
@app.route('/users', methods=['GET'])
def get_users():
    logger.info("GET /users endpoint accessed")
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        logger.debug("Executing SQL query to fetch users")
        cursor.execute("SELECT * FROM trueday.users;")
        rows = cursor.fetchall()

        users = []
        for row in rows:
            users.append({
                "id": row[0],
                "username": row[1],
                "email": row[2]
            })

        cursor.close()
        conn.close()
        logger.info(f"Successfully fetched {len(users)} users")

        return jsonify({"users": users}), 200

    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        return jsonify({"error": str(e)}), 500

# Notify a user that they were assigned as approver/collaborator
@app.route('/api/notify-assignment', methods=['POST'])
def notify_assignment():
    try:
        data = request.get_json() or {}
        ticket_id = data.get('ticket_id')
        user_id = data.get('user_id')
        role = (data.get('role') or '').lower()  # 'approver' | 'collaborator'
        if not ticket_id or not user_id or role not in ('approver', 'collaborator'):
            return jsonify({'error': 'ticket_id, user_id and valid role are required'}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        # Get ticket title and creator
        cur.execute("""
            SELECT t.title, u.username AS creator_name
            FROM trueday.tickets t
            LEFT JOIN trueday.users u ON u.id = t.creator_id
            WHERE t.ticket_id = %s
        """, (ticket_id,))
        row = cur.fetchone()
        title = row[0] if row else f'Ticket {ticket_id}'
        creator_name = row[1] if row and row[1] else 'Someone'

        # Get recipient
        cur.execute("SELECT username, email FROM trueday.users WHERE id = %s", (user_id,))
        urow = cur.fetchone()
        cur.close(); conn.close()
        if not urow or not urow[1]:
            return jsonify({'error': 'User email not found'}), 404

        recipient_name = urow[0] or 'there'
        recipient_email = urow[1]

        try:
            subject = f"[TD] {role.capitalize()} Assignment: Ticket #{ticket_id}"
            html = f"""
<div style="font-family:Segoe UI, sans-serif; font-size:14px; color:#333; line-height:1.6; max-width:640px; border:1px solid #e5e7eb; border-radius:10px; padding:20px; background:#fafafa;">
  <h2 style="margin:0 0 10px 0; color:#111827;">You were added as {role} on a ticket</h2>
  <p>Hi {recipient_name},</p>
  <p><strong>{creator_name}</strong> added you as <strong>{role}</strong> on ticket <strong>#{ticket_id}</strong>: <em>{title}</em>.</p>
  <p>You can review the ticket and take the next action.</p>
  <p style="margin-top:16px;">
    <a href="https://trueday.ariths.com/#/edit-ticket/{ticket_id}" style="background:#4f46e5; color:#fff; text-decoration:none; padding:10px 14px; border-radius:8px;">Open Ticket</a>
  </p>
  <hr style="border:none; border-top:1px solid #e5e7eb; margin:20px 0;" />
  <div style="font-size:12px; color:#6b7280;">This is an automated notification from Trueday.</div>
 </div>
"""
            msg = Message(subject=subject, recipients=[recipient_email], html=html)
            mail.send(msg)
        except Exception as mail_err:
            logger.error(f"Error sending assignment email: {mail_err}")
            return jsonify({'error': 'Failed to send email'}), 500

        return jsonify({'message': 'Notification sent'}), 200
    except Exception as e:
        logger.error(f"notify-assignment error: {e}")
        return jsonify({'error': str(e)}), 500

# Registration route
@app.route('/register', methods=['POST'])
def register():
    logger.info("POST /register endpoint accessed")
    try:
        data = request.get_json()
        logger.debug(f"Registration data received: {data}")
        username = data.get("username")
        email = data.get("email")
        password = data.get("password")

        if not username or not email or not password:
            logger.warning("Missing required fields in registration request")
            return jsonify({"error": "Missing required fields"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        logger.debug("Executing SQL query to insert new user")
        cursor.execute("""
            INSERT INTO trueday.users (username, email, password)
            VALUES (%s, %s, %s)
            RETURNING id;
        """, (username, email, password))
        
        _row = cursor.fetchone()
        if isinstance(_row, dict):
            user_id = _row.get('id') if _row.get('id') is not None else (next(iter(_row.values())) if _row else None)
        else:
            user_id = _row[0] if _row else None
        conn.commit()
        cursor.close()
        conn.close()
        logger.info(f"User {username} registered successfully with ID: {user_id}")

        return jsonify({
            "message": "User registered successfully",
            "user": {
                "id": user_id,
                "username": username,
                "email": email
            }
        }), 201

    except Exception as e:
        logger.error(f"Registration error: {e}")
        return jsonify({"error": str(e)}), 500

# Login route
@app.route('/login', methods=['GET', 'POST', 'OPTIONS'])
def login():
    logger.info(f"{request.method} /login endpoint accessed")
    
    if request.method == 'OPTIONS':
        logger.debug("Handling OPTIONS request for login")
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    if request.method == 'GET':
        logger.debug("Handling GET request for login")
        # Redirect to the frontend login page
        return redirect('https://trueday.ariths.com')

    try:
        data = request.get_json()
        logger.debug(f"Login attempt for email: {data.get('email')}")
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            logger.warning("Missing email or password in login request")
            return jsonify({'error': 'Email and password are required'}), 400

        conn = get_db_connection()
        cur = conn.cursor()  # ✅ psycopg v3

        logger.debug("Executing SQL query to fetch user")
        # ⚠️ FIXED: was using undefined 'cursor' instead of 'cur' — caused NameError on every login
        cur.execute("SELECT * FROM trueday.users WHERE email = %s", (email,))
        user = cur.fetchone()
        cur.close()
        conn.close()

        if not user:
            logger.warning(f"Login failed: No user found with email {email}")
            return jsonify({'error': 'Invalid email or password'}), 401

        # Check password directly (since it's not hashed in the database)
        if user['password'] != password:
            logger.warning(f"Login failed: Invalid password for user {email}")
            return jsonify({'error': 'Invalid email or password'}), 401

        # Create session — make it permanent so it lasts for PERMANENT_SESSION_LIFETIME (24h)
        session.permanent = True
        session['user_id'] = user['id']
        session['email'] = user['email']
        session['name'] = user['username']
        session['role'] = user['role']
        logger.info(f"User {email} logged in successfully")

        response = jsonify({
            'message': 'Login successful',
            'user': {
                'user_id': user['id'],
                'name': user['username'],
                'email': user['email'],
                'role': user['role']
            }
        })
        
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({'error': 'An error occurred during login'}), 500


@app.route('/tickets/<int:ticket_id>', methods=['PUT', 'OPTIONS'])
def update_ticket(ticket_id):
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173', 'https://trueday.ariths.com')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'PUT,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    try:
        data = request.json  # Get the JSON payload from the request
        creator_id = data.get('creator_id')  # Extract creator_id from request
        
        # If creator_id is not provided, try to get it from the current ticket
        if not creator_id:
            conn_temp = get_db_connection()
            cursor_temp = conn_temp.cursor()
            cursor_temp.execute("SELECT creator_id FROM trueday.tickets WHERE ticket_id = %s", (ticket_id,))
            creator_row = cursor_temp.fetchone()
            if creator_row:
                if isinstance(creator_row, dict):
                    creator_id = creator_row.get('creator_id')
                else:
                    try:
                        creator_id = creator_row[0]
                    except Exception:
                        creator_id = None
            else:
                creator_id = None
            cursor_temp.close()
            conn_temp.close()
        
        # Validate title - check if it's empty or contains only whitespace
        title = data.get('title')
        if not title or not title.strip():
            return jsonify({"error": "Title cannot be empty or contain only spaces, tabs, or line breaks. Please enter a valid title."}), 400

        # Validate due date - check if it's more than 365 days from creation date
        try:
            from datetime import datetime, timedelta
            due_date = data.get('due_date')
            if due_date and due_date.strip():
                # Get the ticket's creation date from the database
                conn_validation = get_db_connection()
                cursor_validation = conn_validation.cursor()
                cursor_validation.execute("SELECT created_at FROM trueday.tickets WHERE ticket_id = %s", (ticket_id,))
                ticket_data = cursor_validation.fetchone()
                cursor_validation.close()
                conn_validation.close()
                
                if ticket_data:
                    # ticket_data may be dict-row or tuple-like
                    if isinstance(ticket_data, dict):
                        creation_date_str = ticket_data.get('created_at')
                    else:
                        try:
                            creation_date_str = ticket_data[0]
                        except Exception:
                            creation_date_str = None  # defensive
                    if creation_date_str:
                        # Handle both date and timestamp formats
                        if isinstance(creation_date_str, str):
                            creation_date = datetime.strptime(creation_date_str, "%Y-%m-%d")
                        else:
                            creation_date = creation_date_str.date()
                        
                        due_date_obj = datetime.strptime(due_date, "%Y-%m-%d")
                        
                        # Convert both to date objects for consistent comparison
                        creation_date_for_diff = creation_date.date() if isinstance(creation_date, datetime) else creation_date
                        due_date_for_diff = due_date_obj.date()
                        
                        days_difference = (due_date_for_diff - creation_date_for_diff).days
                        
                        if days_difference > 365:
                            return jsonify({"error": "Due date cannot be more than 365 days from the creation date."}), 400
        except (ValueError, TypeError) as e:
            return jsonify({"error": "Invalid date format. Please use YYYY-MM-DD format."}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if the ticket exists and get current values
        cursor.execute("""
            SELECT ticket_id, assignee_id, title, description, priority, status, due_date, project_id, collaborator_id, approver_id, creator_id
            FROM trueday.tickets
            WHERE ticket_id = %s
        """, (ticket_id,))
        current_ticket = cursor.fetchone()
        if not current_ticket:
            return jsonify({"error": f"Ticket with ID {ticket_id} not found"}), 404

        # helper to read columns whether row is mapping-like or sequence-like
        def _col(row, key, idx):
            if row is None:
                return None
            try:
                if isinstance(row, dict):
                    # prefer explicit key
                    if key in row:
                        return row.get(key)
                    # fallback to first/idx-th value
                    vals = list(row.values())
                    return vals[idx] if idx < len(vals) else None
            except Exception:
                pass
            try:
                return row[idx]
            except Exception:
                return None

        # Validate workflow transition
        current_status = _col(current_ticket, 'status', 5)  # status is at index 5
        new_status = data.get('status')
        if new_status and current_status:
            workflow_validation = validate_workflow_transition(current_status, new_status)
            if not workflow_validation['valid']:
                return jsonify({"error": workflow_validation['message']}), 400
        
        # Validate approver permissions for COMPLETED status
        if new_status and new_status.upper() == 'COMPLETED':
            ticket_approver_id = _col(current_ticket, 'approver_id', 9)  # approver_id is at index 9
            current_user_id = data.get('user_id') or session.get('user_id')
            if ticket_approver_id and (not current_user_id or str(current_user_id) != str(ticket_approver_id)):
                return jsonify({"error": f"Only the assigned approver can mark this ticket as completed"}), 403

        # Update the ticket in the database
        start_date = data.get('start_date')
        if start_date:
            try:
                start_date_val = datetime.strptime(start_date, "%Y-%m-%d")
            except ValueError:
                start_date_val = None
        else:
            start_date_val = None

        label_id = data.get('label_id')
        if label_id == "" or label_id == "null":
            label_id = None
        else:
            try:
                label_id = int(label_id) if label_id is not None else None
            except ValueError:
                label_id = None

        if start_date_val:
            cursor.execute("""
                UPDATE trueday.tickets
                SET title = %s, description = %s, priority = %s, status = %s, due_date = %s, 
                    assignee_id = %s, collaborator_id = %s, approver_id = %s, project_id = %s,
                    created_at = %s, label_id = %s
                WHERE ticket_id = %s
            """, (
                title.strip(),
                data.get('description', ''),
                data.get('priority', 'Medium'),
                data.get('status', 'New'),
                data.get('due_date'),
                data.get('assignee_id'),
                data.get('collaborator_id'),
                data.get('approver_id'),
                data.get('project_id'),
                start_date_val,
                label_id,
                ticket_id
            ))
        else:
            cursor.execute("""
                UPDATE trueday.tickets
                SET title = %s, description = %s, priority = %s, status = %s, due_date = %s, 
                    assignee_id = %s, collaborator_id = %s, approver_id = %s, project_id = %s,
                    label_id = %s
                WHERE ticket_id = %s
            """, (
                title.strip(),
                data.get('description', ''),
                data.get('priority', 'Medium'),
                data.get('status', 'New'),
                data.get('due_date'),
                data.get('assignee_id'),
                data.get('collaborator_id'),
                data.get('approver_id'),
                data.get('project_id'),
                label_id,
                ticket_id
            ))

        # Get current user information from request body or session
        current_user_id = data.get('user_id') or session.get('user_id')
        current_username = data.get('username') or session.get('name', 'Unknown User')
        
        # Debug logging
        logger.info(f"DEBUG: Ticket update for ticket {ticket_id}")
        logger.info(f"DEBUG: User info from request: user_id={data.get('user_id')}, username={data.get('username')}")
        logger.info(f"DEBUG: User info from session: user_id={session.get('user_id')}, name={session.get('name')}")
        logger.info(f"DEBUG: Final user info: current_user_id={current_user_id}, current_username={current_username}")
        
        # Trigger notifications for updates
        old_assignee_id = _col(current_ticket, 'assignee_id', 1)
        new_assignee_id = data.get('assignee_id')
        assignee_changed = str(old_assignee_id) != str(new_assignee_id)
        
        old_status = _col(current_ticket, 'status', 5)
        new_status = data.get('status')
        status_changed = str(old_status) != str(new_status)
        
        creator_id = _col(current_ticket, 'creator_id', 10)
        ticket_title = _col(current_ticket, 'title', 2) or title.strip()
        
        # 1. Assignment notification
        if assignee_changed and new_assignee_id and str(new_assignee_id) != str(current_user_id):
            create_notification(
                cursor,
                new_assignee_id,
                "New Ticket Assigned",
                f'{current_username} assigned you the ticket: \'{ticket_title}\'',
                "assignment",
                ticket_id,
                data.get('priority', 'Medium')
            )
            
        # 2. Status change notifications
        if status_changed:
            msg = f'{current_username} moved ticket \'{ticket_title}\' from {old_status} to {new_status}'
            notify_assignee_id = new_assignee_id or old_assignee_id
            approver_id_val = _col(current_ticket, 'approver_id', 9)
            collaborator_id_val = _col(current_ticket, 'collaborator_id', 8)
            notified_ids = {str(current_user_id)}
            print(f"DEBUG BLOCK1 NOTIF: assignee={notify_assignee_id}, creator={creator_id}, approver={approver_id_val}, collaborator={collaborator_id_val}, current_user={current_user_id}")

            # Notify assignee
            if notify_assignee_id and str(notify_assignee_id) not in notified_ids:
                create_notification(
                    cursor,
                    notify_assignee_id,
                    "Ticket Moved",
                    msg,
                    "status_change",
                    ticket_id,
                    data.get('priority', 'Medium')
                )
                notified_ids.add(str(notify_assignee_id))
            # Notify creator
            if creator_id and str(creator_id) not in notified_ids:
                create_notification(
                    cursor,
                    creator_id,
                    "Ticket Moved",
                    msg,
                    "status_change",
                    ticket_id,
                    data.get('priority', 'Medium')
                )
                notified_ids.add(str(creator_id))
            # Notify approver
            if approver_id_val and str(approver_id_val) not in notified_ids:
                create_notification(
                    cursor,
                    approver_id_val,
                    "Ticket Moved",
                    msg,
                    "status_change",
                    ticket_id,
                    data.get('priority', 'Medium')
                )
                notified_ids.add(str(approver_id_val))
            # Notify collaborator
            if collaborator_id_val and str(collaborator_id_val) not in notified_ids:
                create_notification(
                    cursor,
                    collaborator_id_val,
                    "Ticket Moved",
                    msg,
                    "status_change",
                    ticket_id,
                    data.get('priority', 'Medium')
                )
                notified_ids.add(str(collaborator_id_val))
        
        # Record status change in history if needed
        status_changed = str(_col(current_ticket, 'status', 5)) != str(data.get('status'))
        if status_changed:
            old_status = _col(current_ticket, 'status', 5)
            new_status = data.get('status')
            
            def record_status_history():
                try:
                    conn_history = get_db_connection()
                    cursor_history = conn_history.cursor()
                    
                    cursor_history.execute("""
                        INSERT INTO trueday.ticket_history (
                            ticket_id, changed_by, change_type, old_value, new_value, changed_at
                        ) VALUES (%s, %s, %s, %s, %s, NOW())
                    """, (
                        ticket_id,
                        current_username,
                        'status',
                        old_status,
                        new_status
                    ))
                    
                    conn_history.commit()
                    cursor_history.close()
                    conn_history.close()
                    print(f"DEBUG: Status change recorded in history - Old: {old_status}, New: {new_status}, User: {current_username}")
                except Exception as e:
                    logger.error(f"Error recording status history: {e}")
            
            # Start history recording in background thread
            Thread(target=record_status_history).start()

        # Record assignee change in background if needed
        assignee_changed = str(_col(current_ticket, 'assignee_id', 1)) != str(data.get('assignee_id'))
        if assignee_changed:
            old_assignee_id = _col(current_ticket, 'assignee_id', 1)
            new_assignee_id = data.get('assignee_id')
            
            def record_assignee_history():
                try:
                    conn_history = get_db_connection()
                    cursor_history = conn_history.cursor()
                    
                    cursor_history.execute("SELECT username FROM trueday.users WHERE id = %s", (old_assignee_id,))
                    old_assignee_row = cursor_history.fetchone()
                    if isinstance(old_assignee_row, dict):
                        old_assignee = old_assignee_row.get('username') or 'Unassigned'
                    else:
                        old_assignee = old_assignee_row[0] if old_assignee_row else 'Unassigned'

                    cursor_history.execute("SELECT username FROM trueday.users WHERE id = %s", (new_assignee_id,))
                    new_assignee_row = cursor_history.fetchone()
                    if isinstance(new_assignee_row, dict):
                        new_assignee = new_assignee_row.get('username') or 'Unassigned'
                    else:
                        new_assignee = new_assignee_row[0] if new_assignee_row else 'Unassigned'

                    cursor_history.execute("""
                        INSERT INTO trueday.ticket_history (
                            ticket_id, changed_by, change_type, old_value, new_value, change_details, changed_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
                        RETURNING id, changed_at
                    """, (
                        ticket_id,
                        new_assignee,  # store username instead of numeric id for readability
                        'assignee',
                        old_assignee,
                        new_assignee,
                        None
                    ))
                    
                    conn_history.commit()
                    cursor_history.close()
                    conn_history.close()
                except Exception as e:
                    logger.error(f"Error recording assignee history: {e}")
            
            # Start history recording in background thread
            Thread(target=record_assignee_history).start()

        # Record collaborator change in background if needed
        collaborator_changed = str(_col(current_ticket, 'collaborator_id', 8)) != str(data.get('collaborator_id'))
        if collaborator_changed:
            old_collaborator_id = _col(current_ticket, 'collaborator_id', 8)
            new_collaborator_id = data.get('collaborator_id')

            def record_collaborator_history():
                try:
                    conn_history = get_db_connection()
                    cursor_history = conn_history.cursor()

                    # Resolve usernames for readability
                    old_name = None
                    new_name = None
                    if old_collaborator_id:
                        cursor_history.execute("SELECT username FROM trueday.users WHERE id = %s", (old_collaborator_id,))
                        row = cursor_history.fetchone()
                        if isinstance(row, dict):
                            old_name = row.get('username') or 'None'
                        else:
                            old_name = row[0] if row else 'None'
                    else:
                        old_name = 'None'

                    if new_collaborator_id:
                        cursor_history.execute("SELECT username FROM trueday.users WHERE id = %s", (new_collaborator_id,))
                        row = cursor_history.fetchone()
                        if isinstance(row, dict):
                            new_name = row.get('username') or 'None'
                        else:
                            new_name = row[0] if row else 'None'
                    else:
                        new_name = 'None'

                    cursor_history.execute("""
                        INSERT INTO trueday.ticket_history (
                            ticket_id, changed_by, change_type, old_value, new_value, change_details, changed_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
                    """, (
                        ticket_id,
                        current_username,
                        'collaborator',
                        old_name,
                        new_name,
                        None
                    ))

                    conn_history.commit()
                    cursor_history.close()
                    conn_history.close()
                except Exception as e:
                    logger.error(f"Error recording collaborator history: {e}")

            Thread(target=record_collaborator_history).start()

        # Record approver change in background if needed
        approver_changed = str(_col(current_ticket, 'approver_id', 9)) != str(data.get('approver_id'))
        if approver_changed:
            old_approver_id = _col(current_ticket, 'approver_id', 9)
            new_approver_id = data.get('approver_id')

            def record_approver_history():
                try:
                    conn_history = get_db_connection()
                    cursor_history = conn_history.cursor()

                    # Resolve usernames for readability
                    old_name = None
                    new_name = None
                    if old_approver_id:
                        cursor_history.execute("SELECT username FROM trueday.users WHERE id = %s", (old_approver_id,))
                        row = cursor_history.fetchone()
                        if isinstance(row, dict):
                            old_name = row.get('username') or 'None'
                        else:
                            old_name = row[0] if row else 'None'
                    else:
                        old_name = 'None'

                    if new_approver_id:
                        cursor_history.execute("SELECT username FROM trueday.users WHERE id = %s", (new_approver_id,))
                        row = cursor_history.fetchone()
                        if isinstance(row, dict):
                            new_name = row.get('username') or 'None'
                        else:
                            new_name = row[0] if row else 'None'
                    else:
                        new_name = 'None'

                    cursor_history.execute("""
                        INSERT INTO trueday.ticket_history (
                            ticket_id, changed_by, change_type, old_value, new_value, change_details, changed_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
                    """, (
                        ticket_id,
                        current_username,
                        'approver',
                        old_name,
                        new_name,
                        None
                    ))

                    conn_history.commit()
                    cursor_history.close()
                    conn_history.close()
                except Exception as e:
                    logger.error(f"Error recording approver history: {e}")

            Thread(target=record_approver_history).start()

        # Record project change in background if needed
        project_changed = str(_col(current_ticket, 'project_id', 7)) != str(data.get('project_id'))
        if project_changed:
            old_project_id = _col(current_ticket, 'project_id', 7)
            new_project_id = data.get('project_id')

            def record_project_history():
                try:
                    conn_history = get_db_connection()
                    cursor_history = conn_history.cursor()

                    def resolve_project_name(pid):
                        if not pid:
                            return 'None'
                        cursor_history.execute("SELECT project_name FROM trueday.project WHERE project_id = %s", (pid,))
                        row = cursor_history.fetchone()
                        if isinstance(row, dict):
                            return row.get('project_name') if row.get('project_name') is not None else str(pid)
                        else:
                            return row[0] if row else str(pid)

                    old_name = resolve_project_name(old_project_id)
                    new_name = resolve_project_name(new_project_id)

                    cursor_history.execute("""
                        INSERT INTO trueday.ticket_history (
                            ticket_id, changed_by, change_type, old_value, new_value, change_details, changed_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
                    """, (
                        ticket_id,
                        current_username,
                        'project',
                        old_name,
                        new_name,
                        None
                    ))

                    conn_history.commit()
                    cursor_history.close()
                    conn_history.close()
                except Exception as e:
                    logger.error(f"Error recording project history: {e}")

            Thread(target=record_project_history).start()

        # Record priority change in background if needed
        priority_changed = str(_col(current_ticket, 'priority', 4)) != str(data.get('priority'))
        if priority_changed:
            old_priority = _col(current_ticket, 'priority', 4)
            new_priority = data.get('priority')

            def record_priority_history():
                try:
                    conn_history = get_db_connection()
                    cursor_history = conn_history.cursor()
                    cursor_history.execute("""
                        INSERT INTO trueday.ticket_history (
                            ticket_id, changed_by, change_type, old_value, new_value, changed_at
                        ) VALUES (%s, %s, %s, %s, %s, NOW())
                    """, (
                        ticket_id,
                        current_username,
                        'priority',
                        old_priority,
                        new_priority
                    ))
                    conn_history.commit()
                    cursor_history.close()
                    conn_history.close()
                except Exception as e:
                    logger.error(f"Error recording priority history: {e}")

            Thread(target=record_priority_history).start()

        # Record due date change in background if needed
        def normalize_date_str(value):
            if value is None:
                return 'None'
            try:
                from datetime import datetime
                if isinstance(value, str):
                    # Try various formats; default to YYYY-MM-DD
                    try:
                        return datetime.strptime(value, "%Y-%m-%d").date().isoformat()
                    except ValueError:
                        # If includes time
                        return datetime.fromisoformat(value).date().isoformat()
                else:
                    # datetime/date
                    return value.date().isoformat() if hasattr(value, 'date') else str(value)
            except Exception:
                return str(value)

        due_date_changed = normalize_date_str(_col(current_ticket, 'due_date', 6)) != normalize_date_str(data.get('due_date'))
        if due_date_changed:
            old_due = normalize_date_str(_col(current_ticket, 'due_date', 6))
            new_due = normalize_date_str(data.get('due_date'))

            def record_due_date_history():
                try:
                    conn_history = get_db_connection()
                    cursor_history = conn_history.cursor()
                    cursor_history.execute("""
                        INSERT INTO trueday.ticket_history (
                            ticket_id, changed_by, change_type, old_value, new_value, changed_at
                        ) VALUES (%s, %s, %s, %s, %s, NOW())
                    """, (
                        ticket_id,
                        current_username,
                        'due_date',
                        old_due,
                        new_due
                    ))
                    conn_history.commit()
                    cursor_history.close()
                    conn_history.close()
                except Exception as e:
                    logger.error(f"Error recording due date history: {e}")

            Thread(target=record_due_date_history).start()

        conn.commit()
        cursor.close()
        conn.close()

        # Send email notifications in background thread to avoid blocking
        def send_update_emails():
            try:
                conn2 = get_db_connection()
                cur2 = conn2.cursor()

                # Get creator's name
                if creator_id:
                    cur2.execute("SELECT username FROM trueday.users WHERE id = %s", (creator_id,))
                    creator_row = cur2.fetchone()
                    if isinstance(creator_row, dict):
                        creator_name = creator_row.get('username') or 'Someone'
                    else:
                        creator_name = creator_row[0] if creator_row else 'Someone'
                else:
                    creator_name = 'Someone'

                # Send email to assignee
                cur2.execute("SELECT email FROM trueday.users WHERE id = %s", (data.get('assignee_id'),))
                assignee_email_row = cur2.fetchone()
                assignee_email = None
                if assignee_email_row:
                    if isinstance(assignee_email_row, dict):
                        assignee_email = assignee_email_row.get('email')
                    else:
                        assignee_email = assignee_email_row[0] if assignee_email_row else None
                if assignee_email:
                    msg = Message(
                        subject=f"[TD] Ticket Updated: {title.strip()}",
                        recipients=[assignee_email],
                      html = f"""
<div style="font-family:Segoe UI, sans-serif; font-size:14px; color:#333; line-height:1.6; max-width:600px; border:1px solid #e0e0e0; border-radius:8px; padding:20px; background-color:#fafafa;">
  <p>Hi,</p>

  <p><strong>{creator_name}</strong> updated the ticket <strong>{ticket_id}</strong>.</p>

  <div style="margin-top:20px; text-align:center;">
    <a href=\"{generate_secure_url(data.get('assignee_id'), f'/edit-ticket/{ticket_id}')}\"
       style="display:inline-block; padding:10px 20px; background-color:#FFA500; color:#fff; font-weight:bold; text-decoration:none; border-radius:5px; border:2px solid #FFA500;">
       🔗 View Ticket
    </a>
  </div>

  <br><br>

 <p style="color: #555; font-size:13px;">
    Best regards,<br />
   <img src="https://ariths.com/td/trueday_logo.png"style="vertical-align:middle; height:5px; width:15px; margin-right:5px;"  />
<br />
    <strong>Trueday</strong>
  </p>
</div>
"""

                    )
                    mail.send(msg)

                # Send email to collaborator (if present)
                collaborator_id = data.get('collaborator_id')
                if collaborator_id:
                    cur2.execute("SELECT username, email FROM trueday.users WHERE id = %s", (collaborator_id,))
                    collaborator_row = cur2.fetchone()
                    collaborator_name = None
                    collaborator_email = None
                    if collaborator_row:
                        if isinstance(collaborator_row, dict):
                            collaborator_name = collaborator_row.get('username')
                            collaborator_email = collaborator_row.get('email')
                        else:
                            collaborator_name = collaborator_row[0] if len(collaborator_row) > 0 else None
                            collaborator_email = collaborator_row[1] if len(collaborator_row) > 1 else None
                    if collaborator_email:
                        collaborator_name = collaborator_name or "there"

                        collaborator_msg = Message(
                            subject=f"[TD] Collaborator Assignment: Ticket {ticket_id}",
                            recipients=[collaborator_email],
                           html = f"""
<div style="font-family:Segoe UI, sans-serif; font-size:14px; color:#333; line-height:1.6; max-width:600px; border:1px solid #e0e0e0; border-radius:8px; padding:20px; background-color:#fafafa;">
  <p>Hi <strong style="color:#0057b8;">{collaborator_name}</strong>,</p>

  <p>
    You have been added as a collaborator on ticket 
    <strong>{ticket_id}</strong>.
  </p>

  <div style="margin-top:20px; text-align:center;">
    <a href=\"{generate_secure_url(data.get('assignee_id'), f'/edit-ticket/{ticket_id}')}\" 
       style="display:inline-block; padding:10px 20px; background-color:#FFA500; color:#fff; font-weight:bold; text-decoration:none; border-radius:5px; border:2px solid #FFA500;">
       🔗 View Ticket
    </a>
  </div>

  <br><br>

   <p style="color: #555; font-size:13px;">
    Best regards,<br />
    <strong>Trueday</strong>
  </p>
</div>
"""

                        )
                        mail.send(collaborator_msg)

                cur2.close()
                conn2.close()
            except Exception as mail_err:
                logger.error(f"Error sending update email: {mail_err}")

        # Start email sending in background thread
        Thread(target=send_update_emails).start()

        return jsonify({"message": "Ticket updated successfully"}), 200

    except Exception as e:
        print(f"Error updating ticket: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500




@app.route('/api/team-performance', methods=['GET'])
def get_team_performance():
    try:
        conn = get_db_connection()
        cur = conn.cursor()  # ✅ no cursor_factory needed

        
        # Query to get ticket counts by user and status
        query = """
            SELECT 
                u.username,
                t.status,
                COUNT(t.ticket_id) as count
            FROM trueday.users u
            LEFT JOIN trueday.tickets t ON u.id = t.assignee_id
            WHERE t.status IS NOT NULL
            GROUP BY u.username, t.status
            ORDER BY u.username, 
                CASE t.status
                    WHEN 'QA' THEN 1
                    WHEN 'New' THEN 2
                    WHEN 'In Progress' THEN 3
                    WHEN 'Resolved' THEN 4
                    WHEN 'On Hold' THEN 5
                    ELSE 6
                END;
        """
        
        print("Executing team performance query...")
        cur.execute(query)
        results = cur.fetchall()
        print(f"Query results: {results}")
        
        if not results:
            return jsonify({
                'labels': [],
                'datasets': []
            })
        
        # Get unique usernames and statuses
        usernames = sorted(set(row['username'] for row in results))
        statuses = ['QA', 'New', 'In Progress', 'Resolved', 'On Hold']
        
        # Initialize datasets for each status
        datasets = []
        colors = {
            'QA': 'rgba(139, 92, 246, 0.8)',      # Purple
            'New': 'rgba(99, 102, 241, 0.8)',     # Indigo
            'In Progress': 'rgba(245, 158, 11, 0.8)',  # Orange
            'Resolved': 'rgba(34, 197, 94, 0.8)',     # Green
            'On Hold': 'rgba(234, 179, 8, 0.8)'       # Yellow
        }
        
        # Create dataset for each status
        for status in statuses:
            data = []
            for username in usernames:
                # Find count for this username and status
                count = next((row['count'] for row in results 
                            if row['username'] == username and row['status'] == status), 0)
                data.append(count)
            
            datasets.append({
                'label': status,
                'data': data,
                'backgroundColor': colors[status],
                'borderColor': colors[status].replace('0.8', '1'),
                'borderWidth': 1
            })
        
        chart_data = {
            'labels': usernames,
            'datasets': datasets
        }
        
        print(f"Sending chart data: {chart_data}")
        return jsonify(chart_data)
        
    except Exception as e:
        print(f"Error in get_team_performance: {str(e)}")
        return jsonify({'error': str(e)}), 500
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

def get_project_ids_list():
    project_ids_str = request.args.get('project_ids')
    if project_ids_str and project_ids_str != 'all':
        try:
            return [int(x) for x in project_ids_str.split(',') if x.strip().isdigit()]
        except ValueError:
            return None
    return None

@app.route('/api/metricscards')
def get_metrics_cards(): 
    try:
        # Get filters from query params
        employee_id = request.args.get('employee')
        priority = request.args.get('priority')
        status = request.args.get('status')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        conn = get_db_connection()
        cur = conn.cursor()  # ✅ no cursor_factory needed


        # Build base query
        query = """
            SELECT 
                COUNT(*) AS "totalTasks",
                COUNT(*) FILTER (WHERE status = 'COMPLETED') AS "completedTasks",
                COUNT(*) FILTER (WHERE status IN ('NEW', 'IN PROGRESS')) AS "pendingTasks",
                COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'COMPLETED') AS "overdueTasks"
            FROM trueday.tickets t
            LEFT JOIN trueday.users u ON t.assignee_id = u.id
            WHERE 1=1
        """
        params = []
        if employee_id and employee_id != 'all':
            query += " AND (u.id = %s OR (u.id IS NULL AND %s NOT IN (SELECT id FROM trueday.users)))"
            params.extend([employee_id, employee_id])
        if priority and priority != 'all':
            query += " AND t.priority = %s"
            params.append(priority.capitalize())
        if status and status != 'all':
            query += " AND UPPER(t.status) = %s"
            params.append(status.upper())
        if start_date and end_date:
            query += " AND t.created_at BETWEEN %s AND %s"
            params.extend([start_date, end_date])

        p_ids = get_project_ids_list()
        if p_ids:
            query += " AND t.project_id = ANY(%s)"
            params.append(p_ids)

        cur.execute(query, params)
        metrics = cur.fetchone()
        # Convert numeric values to integers
        result = {
            'totalTasks': int(metrics['totalTasks']),
            'completedTasks': int(metrics['completedTasks']),
            'pendingTasks': int(metrics['pendingTasks']),
            'overdueTasks': int(metrics['overdueTasks']) if metrics['overdueTasks'] is not None else 0
        }
        return jsonify(result)
    except Exception as e:
        print('Error fetching metrics:', str(e))
        return jsonify({'error': 'Database query failed'}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# Contact submission route
@app.route('/contact/submit', methods=['OPTIONS', 'POST'])
def contact_submit():
    print("Received contact submission request:", request.method)
    if request.method == 'OPTIONS':
        return '', 200

    try:
        data = request.get_json()
        print("Contact form data received:", data)
        
        name = data.get('name')
        email = data.get('email')
        subject = data.get('subject')
        message = data.get('message')

        if not all([name, email, subject, message]):
            return jsonify({"error": "All fields are required"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # Create contact_submissions table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS contact_submissions (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL,
                subject VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

        # Insert the submission
        cursor.execute("""
            INSERT INTO contact_submissions (name, email, subject, message)
            VALUES (%s, %s, %s, %s)
            RETURNING id;
        """, (name, email, subject, message))
        
        _row = cursor.fetchone()
        if isinstance(_row, dict):
            submission_id = _row.get('id') if _row.get('id') is not None else (next(iter(_row.values())) if _row else None)
        else:
            submission_id = _row[0] if _row else None
        conn.commit()
        cursor.close()
        conn.close()

        print("Contact submission successful, ID:", submission_id)
        return jsonify({
            "message": "Message sent successfully",
            "submission_id": submission_id
        }), 201

    except Exception as e:
        print("Error in contact submission:", str(e))
        return jsonify({"error": str(e)}), 500
    
    


# Route to get all contact submissions
@app.route('/contact/submissions', methods=['GET'])
def get_contact_submissions():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, name, email, subject, message, created_at
            FROM contact_submissions
            ORDER BY created_at DESC
        """)
        
        submissions = []
        for row in cursor.fetchall():
            submissions.append({
                "id": row[0],
                "name": row[1],
                "email": row[2],
                "subject": row[3],
                "message": row[4],
                "created_at": row[5].strftime("%Y-%m-%d %H:%M:%S")
            })

        cursor.close()
        conn.close()

        return jsonify({"submissions": submissions}), 200

    except Exception as e:
        print(f"Error fetching contact submissions: {e}")
        return jsonify({"error": str(e)}), 500

# Get all progress entries
@app.route('/api/progress-pulse', methods=['GET'])
def get_progress_entries():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, date, ticket_number, created_by, priority, 
                   eta, todays_work, next_day_plan, remarks
            FROM progress_pulse
            ORDER BY date DESC, id DESC
        """)
        
        entries = []
        for row in cursor.fetchall():
            entries.append({
                "id": row[0],
                "date": row[1].strftime('%Y-%m-%d'),
                "ticketNo": row[2],
                "createdBy": row[3],
                "priority": row[4],
                "eta": row[5].strftime('%Y-%m-%d') if row[5] else None,
                "todaysWork": row[6],
                "nextDay": row[7],
                "remarks": row[8]
            })

        cursor.close()
        conn.close()
        return jsonify(entries)

    except Exception as e:
        print(f"Error fetching entries: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/tickets', methods=['GET'])
def get_tickets():
    try:
        # Get query params
        project_id = request.args.get('project_id')
        status = request.args.get('status')
        tag = request.args.get('tag')
        assignee_id = request.args.get('assignee_id')
        approver_id = request.args.get('approver_id')  # Add approver_id parameter
        approver_name = request.args.get('approver_name')  # Add approver_name parameter
        search = request.args.get('search')

        conn = get_db_connection()
        cur = conn.cursor()  # ✅ no cursor_factory needed


        # Build base query
        query = '''
        SELECT
                t.ticket_id,
                t.title,
                t.description,
                t.priority,
                t.assignee_id,
                t.creator_id,
                t.approver_id,
                t.collaborator_id,
                t.due_date,
                t.tag,
                t.project_id,
                l.label_name,
                l.color,
                p.project_name,
                CASE
                    WHEN UPPER(t.status) = 'DELETED' THEN 'DELETED'
                    WHEN UPPER(t.status) = 'NEW' THEN 'NEW'
                    WHEN UPPER(t.status) = 'IN PROGRESS' THEN 'IN PROGRESS'
                    WHEN UPPER(t.status) = 'BLOCKED' THEN 'BLOCKED'
                    WHEN UPPER(t.status) = 'QA' THEN 'QA'
                    WHEN UPPER(t.status) = 'UAT' THEN 'UAT'
                    WHEN UPPER(t.status) = 'COMPLETED' THEN 'COMPLETED'
                    ELSE UPPER(t.status)
                END as status,
                t.created_at,
                t.deleted_at,
                u.username as assignee_name,
                c.username as creator_name,
                appr.username as approver_name,
                collab.username as collaborator_name
            FROM trueday.tickets t
            LEFT JOIN trueday.users u ON t.assignee_id = u.id
            LEFT JOIN trueday.users c ON t.creator_id = c.id
            LEFT JOIN trueday.users appr ON t.approver_id = appr.id
            LEFT JOIN trueday.users collab ON t.collaborator_id = collab.id
            LEFT JOIN trueday.project p ON t.project_id = p.project_id
			LEFT JOIN trueday.labels l ON t.label_id = l.label_id
            WHERE 1=1
        '''
        params = []
        if project_id:
            query += ' AND t.project_id = %s'
            params.append(project_id)
        if status and status.lower() != 'all':
            query += ' AND UPPER(t.status) = %s'
            params.append(status.upper())
        if tag:
            query += ' AND t.tag = %s'
            params.append(tag)
        if assignee_id:
            # Include tickets where the user is either assignee OR collaborator
            query += ' AND (t.assignee_id = %s OR t.collaborator_id = %s)'
            params.extend([assignee_id, assignee_id])
        if approver_id:  # Add approver_id filter
            query += ' AND t.approver_id = %s'
            params.append(approver_id)
        if approver_name:  # Add approver_name filter
            query += ' AND appr.username = %s'
            params.append(approver_name)
        if search:
            query += ' AND (LOWER(t.title) LIKE %s OR LOWER(t.description) LIKE %s OR CAST(t.ticket_id AS TEXT) LIKE %s)'
            params.extend([f'%{search.lower()}%', f'%{search.lower()}%', f'%{search}%'])
        query += ' ORDER BY t.created_at DESC'

        cur.execute(query, params)
        tickets = cur.fetchall()
        # Convert datetime objects to strings
        for ticket in tickets:
            if ticket['created_at']:
                ticket['created_at'] = ticket['created_at'].isoformat()
            if ticket['due_date']:
                ticket['due_date'] = ticket['due_date'].isoformat()
            if ticket.get('deleted_at'):
                ticket['deleted_at'] = ticket['deleted_at'].isoformat()
            if ticket['assignee_name'] is None:
                ticket['assignee_name'] = 'Unassigned'
            if ticket['creator_name'] is None:
                ticket['creator_name'] = 'Unknown'
            if ticket.get('approver_name') is None:  # Handle approver_name
                ticket['approver_name'] = 'Unassigned'
        cur.close()
        conn.close()
        return jsonify(tickets)
    except Exception as e:
        print(f"Error in get_tickets: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# Add new progress entry
# Add new progress entry
@app.route('/api/progress-pulse', methods=['POST'])
def add_progress_entry():
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()

        # Insert new entry
        cursor.execute("""
            INSERT INTO progress_pulse (
                date, ticket_number, created_by, priority,
                eta, todays_work, next_day_plan, remarks, user_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            data['date'],
            data['ticketNo'],
            data['createdBy'],
            data['priority'],
            data['eta'],
            data['todaysWork'],
            data['nextDay'],
            data['remarks'],
            1  # Default user_id, replace with actual user_id from session
        ))

        _row = cursor.fetchone()
        if isinstance(_row, dict):
            new_entry_id = _row.get('id') if _row.get('id') is not None else (next(iter(_row.values())) if _row else None)
        else:
            new_entry_id = _row[0] if _row else None
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "Entry added successfully", "id": new_entry_id}), 201

    except Exception as e:
        print(f"Error adding entry: {e}")
        return jsonify({"error": str(e)}), 500 

    
@app.route('/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    logger.info(f"get_user called for user_id: {user_id}")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Sync user role from ariths_accesses foreign table
    try:
        cursor.execute("""
            UPDATE trueday.users u
            SET role = a.access_type
            FROM trueday.ariths_accesses a
            WHERE u.id = %s AND a.user_id = %s AND a.tool_id = 2 AND u.role IS DISTINCT FROM a.access_type;
        """, (user_id, user_id))
        conn.commit()
    except Exception as sync_err:
        logger.warning(f"Failed to sync user role via FDW: {sync_err}")

    cursor.execute("""
        SELECT id, username, email, role, phone, location, department, join_date
        FROM trueday.users
        WHERE id = %s
    """, (user_id,))
    user = cursor.fetchone()
    # close DB handles promptly
    try:
        cursor.close()
    except Exception:
        pass
    try:
        conn.close()
    except Exception:
        pass

    # helper to get column whether row is mapping-like or sequence-like
    def _col(row, key, idx):
        if row is None:
            return None
        # Try mapping-style access first
        try:
            if hasattr(row, 'get'):
                val = row.get(key)
                # If mapping returns something other than None, use it (even falsy allowed)
                if val is not None:
                    return val
        except Exception:
            pass
        # Fallback to sequence indexing
        try:
            return row[idx]
        except Exception:
            return None

    if user:
        username = _col(user, 'username', 1) or ''
        email = _col(user, 'email', 2) or ''
        role = _col(user, 'role', 3)
        phone = _col(user, 'phone', 4)
        location = _col(user, 'location', 5)
        department = _col(user, 'department', 6)
        join_date = _col(user, 'join_date', 7)

        # Fetch assigned project IDs and roles from project_users table
        assigned_projects = []
        project_roles = {}
        try:
            conn2 = get_db_connection()
            cursor2 = conn2.cursor()
            cursor2.execute(
                "SELECT project_id, role FROM trueday.project_users WHERE user_id = %s",
                (user_id,)
            )
            project_rows = cursor2.fetchall()
            for row in project_rows:
                # Handle both dict and tuple rows
                if isinstance(row, dict):
                    p_id = row.get('project_id')
                    p_role = row.get('role', 'User')
                else:
                    p_id = row[0]
                    p_role = row[1] if len(row) > 1 else 'User'
                
                assigned_projects.append(str(p_id))
                project_roles[str(p_id)] = p_role
            cursor2.close()
            conn2.close()
        except Exception as e:
            print(f"Error fetching assigned projects for user {user_id}: {e}")

        logger.info(f"User found for ID {user_id}: {username} (username)")
        return jsonify({
            "id": _col(user, 'id', 0),
            "username": username,
            "email": email,
            "role": role,
            "phone": phone,
            "location": location,
            "department": department,
            "joinDate": join_date.strftime('%Y-%m-%d') if hasattr(join_date, 'strftime') else (str(join_date) if join_date else None),
            "assigned_projects": assigned_projects,
            "project_roles": project_roles
        })
    else:
        logger.warning(f"No user found for ID: {user_id}")
        return jsonify({"error": "User not found"}), 404
    
  
    
@app.route('/api/task-status-distribution', methods=['GET'])
def get_task_status_distribution():
    try:
        # Extract filters from query parameters
        employee_id = request.args.get('employee')
        priority = request.args.get('priority')
        status_filter = request.args.get('status')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        conn = get_db_connection()
        cur = conn.cursor()  # ✅ no cursor_factory needed


        # Build base query with case-insensitive status join
        query = """
            SELECT 
                COALESCE(UPPER(s.status_name), 'NOT SET') as status,
                COUNT(*) as count
            FROM trueday.tickets t
            LEFT JOIN trueday.users u ON t.assignee_id = u.id
            LEFT JOIN trueday.statuses s ON UPPER(t.status) = UPPER(s.status_name)
            WHERE 1=1
        """
        params = []

        # Apply filters
        if employee_id and employee_id != 'all':
            query += " AND (u.id = %s OR (u.id IS NULL AND %s NOT IN (SELECT id FROM trueday.users)))"
            params.extend([employee_id, employee_id])

        if priority and priority != 'all':
            query += " AND t.priority = %s"
            params.append(priority.capitalize())

        if status_filter and status_filter != 'all':
            query += " AND UPPER(s.status_name) = %s"
            params.append(status_filter.upper())

        if start_date and end_date:
            query += " AND t.created_at BETWEEN %s AND %s"
            params.extend([start_date, end_date])

        p_ids = get_project_ids_list()
        if p_ids:
            query += " AND t.project_id = ANY(%s)"
            params.append(p_ids)

        # Group and order by UPPER(s.status_name)
        query += """
            GROUP BY UPPER(s.status_name)
            ORDER BY 
                CASE UPPER(s.status_name)
                    WHEN 'NEW' THEN 1
                    WHEN 'IN PROGRESS' THEN 2
                    WHEN 'QA' THEN 3
                    WHEN 'RESOLVED' THEN 4
                    WHEN 'ON HOLD' THEN 5
                    ELSE 6
                END;
        """

        cur.execute(query, params)
        results = cur.fetchall()

        # Get all possible statuses from the database (uppercase)
        cur.execute("SELECT UPPER(status_name) as status_name FROM trueday.statuses ORDER BY status_id")
        status_rows = cur.fetchall()
        status_order = [row['status_name'] for row in status_rows]
        status_order.append('NOT SET')  # For null/unset statuses

        # Initialize counts
        status_counts = {status: 0 for status in status_order}

        # Update counts from query results
        for row in results:
            status = row['status']
            status_counts[status] = row['count']

        chart_data = {
            'labels': status_order,
            'datasets': [{
                'label': 'Tasks by Status',
                'data': [status_counts[status] for status in status_order],
                'backgroundColor': [
                    'rgba(139, 92, 246, 0.8)',   # QA
                    'rgba(99, 102, 241, 0.8)',   # New
                    'rgba(245, 158, 11, 0.8)',   # In Progress
                    'rgba(34, 197, 94, 0.8)',    # Resolved
                    'rgba(234, 179, 8, 0.8)',    # On Hold
                    'rgba(156, 163, 175, 0.8)'   # Not Set
                ],
                'borderColor': [
                    'rgb(139, 92, 246)',
                    'rgb(99, 102, 241)',
                    'rgb(245, 158, 11)',
                    'rgb(34, 197, 94)',
                    'rgb(234, 179, 8)',
                    'rgb(156, 163, 175)'
                ],
                'borderWidth': 2
            }]
        }

        cur.close()
        conn.close()

        return jsonify(chart_data)

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conn' in locals():
            conn.close() 
@app.route('/api/status-distribution', methods=['GET'])
def get_status_distribution():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)  # ✅ fixed: use imported RealDictCursor directly

        query = """
            SELECT 
                status,
                COUNT(*) as count
            FROM trueday.tickets
            GROUP BY status
            ORDER BY 
                CASE status
                    WHEN 'new' THEN 1
                    WHEN 'in_progress' THEN 2
                    WHEN 'on_hold' THEN 3
                    WHEN 'resolved' THEN 4
                    ELSE 5
                END
        """
        cur.execute(query)
        results = cur.fetchall()

        # Initialize chart data
        status_data = {
            'labels': ['New', 'In Progress', 'On Hold', 'Resolved'],
            'datasets': [{
                'label': 'Tasks by Status',
                'data': [0, 0, 0, 0],
                'backgroundColor': [
                    'rgba(53, 162, 235, 0.8)',
                    'rgba(255, 159, 64, 0.8)',
                    'rgba(255, 205, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                ],
                'borderColor': [
                    'rgb(53, 162, 235)',
                    'rgb(255, 159, 64)',
                    'rgb(255, 205, 86)',
                    'rgb(75, 192, 192)',
                ],
                'borderWidth': 1
            }]
        }

        # Map statuses to chart indices
        status_map = {
            'new': 0,
            'in_progress': 1,
            'on_hold': 2,
            'resolved': 3
        }

        for row in results:
            status_lower = row['status'].lower()
            if status_lower in status_map:
                status_data['datasets'][0]['data'][status_map[status_lower]] = row['count']

        cur.close()
        conn.close()

        return jsonify(status_data)

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': str(e)}), 500 
    
           
        
@app.route('/api/priority-distribution', methods=['GET'])
def get_priority_distribution():
    try:
        employee_id = request.args.get('employee')
        priority_filter = request.args.get('priority')
        status_filter = request.args.get('status')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        conn = get_db_connection()
        cur = conn.cursor()  #  no cursor_factory needed

        # Query to get task count by priority
        query = """
            SELECT 
                COALESCE(t.priority, 'Not Set') as priority,
                COUNT(*) as count
            FROM trueday.tickets t
            LEFT JOIN trueday.users u ON t.assignee_id = u.id
            LEFT JOIN trueday.statuses s ON UPPER(t.status) = UPPER(s.status_name)
            WHERE 1=1
        """
        params = []

        # Apply filters
        if employee_id and employee_id != 'all':
            query += " AND (u.id = %s OR (u.id IS NULL AND %s NOT IN (SELECT id FROM trueday.users)))"
            params.extend([employee_id, employee_id])

        if priority_filter and priority_filter != 'all':
            query += " AND t.priority = %s"
            params.append(priority_filter.capitalize())

        if status_filter and status_filter != 'all':
            query += " AND UPPER(s.status_name) = %s"
            params.append(status_filter.upper())

        if start_date and end_date:
            query += " AND t.created_at BETWEEN %s AND %s"
            params.extend([start_date, end_date])

        p_ids = get_project_ids_list()
        if p_ids:
            query += " AND t.project_id = ANY(%s)"
            params.append(p_ids)

        query += """
            GROUP BY t.priority
            ORDER BY 
                CASE t.priority
                    WHEN 'High' THEN 1
                    WHEN 'Medium' THEN 2
                    WHEN 'Low' THEN 3
                    ELSE 4
                END;
        """
        
        cur.execute(query, params)
        results = cur.fetchall()
        
        # Format data for chart
        chart_data = {
            'labels': [],
            'datasets': [{
                'data': [],
                'backgroundColor': [
                    'rgba(239, 68, 68, 0.8)',   # Red for High
                    'rgba(245, 158, 11, 0.8)',  # Orange for Medium
                    'rgba(34, 197, 94, 0.8)',   # Green for Low
                ]
            }]
        }
        
        # Fill in the data
        for row in results:
            chart_data['labels'].append(row['priority'])
            chart_data['datasets'][0]['data'].append(row['count'])
        
        cur.close()
        conn.close()
        
        return jsonify(chart_data)
        
    except Exception as e:
        print(f"Error in get_priority_distribution: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/workload-distribution', methods=['GET'])
def get_workload_distribution():
    try:
        conn = get_db_connection()
        cur = conn.cursor()  #  no cursor_factory needed

        
        # Query to get active tickets count and details per user
        query = """
            SELECT 
                u.username,
                COUNT(t.ticket_id) as active_tickets,
                COUNT(t.ticket_id) FILTER (WHERE t.status = 'Open') as open_tickets,
                COUNT(t.ticket_id) FILTER (WHERE t.status = 'In Progress') as in_progress_tickets,
                COUNT(t.ticket_id) FILTER (WHERE t.status = 'On Hold') as on_hold_tickets
            FROM trueday.users u
            LEFT JOIN trueday.tickets t ON u.id = t.assignee_id 
                AND t.status IN ('Open', 'In Progress', 'On Hold')
            GROUP BY u.id, u.username
            ORDER BY active_tickets DESC;
        """
        
        print("Executing workload distribution query...")
        cur.execute(query)
        results = cur.fetchall()
        print(f"Query results: {results}")
        
        if not results:
            return jsonify({
                'labels': [],
                'datasets': [{
                    'label': 'Active Tickets',
                    'data': [],
                    'backgroundColor': 'rgba(139, 92, 246, 0.8)',
                    'borderColor': 'rgb(139, 92, 246)',
                    'borderWidth': 1
                }]
            })
        
        # Format data for chart with detailed breakdown
        chart_data = {
            'labels': [row['username'] for row in results],
            'datasets': [
                {
                    'label': 'Open Tickets',
                    'data': [row['open_tickets'] for row in results],
                    'backgroundColor': 'rgba(59, 130, 246, 0.8)',  # Blue
                    'borderColor': 'rgb(59, 130, 246)',
                    'borderWidth': 1
                },
                {
                    'label': 'In Progress',
                    'data': [row['in_progress_tickets'] for row in results],
                    'backgroundColor': 'rgba(245, 158, 11, 0.8)',  # Orange
                    'borderColor': 'rgb(245, 158, 11)',
                    'borderWidth': 1
                },
                {
                    'label': 'On Hold',
                    'data': [row['on_hold_tickets'] for row in results],
                    'backgroundColor': 'rgba(234, 179, 8, 0.8)',  # Yellow
                    'borderColor': 'rgb(234, 179, 8)',
                    'borderWidth': 1
                }
            ]
        }
        
        print(f"Sending chart data: {chart_data}")
        return jsonify(chart_data)
        
    except Exception as e:
        print(f"Error in get_workload_distribution: {str(e)}")
        return jsonify({'error': str(e)}), 500
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

    
@app.route('/api/metrics', methods=['POST'])
def get_metrics():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        data = request.json
        start_date = data.get('startDate')
        end_date = data.get('endDate')
        employee = data.get('employee')
        priority = data.get('priority')
        status = data.get('status')
        
        # Basic metrics query
        query = """
            SELECT 
                COUNT(*) as total_tasks,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
                AVG(CASE WHEN completed_at IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (completed_at - created_at))/3600 
                    END)::numeric(10,2) as avg_completion_time
            FROM trueday.tasks
            WHERE 1=1
        """
        params = []
        
        # Add filters
        if start_date:
            query += " AND created_at >= %s"
            params.append(start_date)
        if end_date:
            query += " AND created_at <= %s"
            params.append(end_date)
        if employee:
            query += " AND assignee = %s"
            params.append(employee)
        if priority:
            query += " AND priority = %s"
            params.append(priority)
        if status:
            query += " AND status = %s"
            params.append(status)
            
        cur.execute(query, params)
        metrics = cur.fetchone()
        
        response_data = {
            'totalTasks': metrics['total_tasks'],
            'completedTasks': metrics['completed_tasks'],
            'pendingTasks': metrics['pending_tasks'],
            'avgCompletionTime': metrics['avg_completion_time']
        }
        
        cur.close()
        conn.close()
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': str(e)}), 500    

@app.route('/api/users', methods=['GET'])
def get_employee_name():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Fetch all users
        cur.execute("""
            SELECT id, username
            FROM trueday.users
            ORDER BY username;
        """)
        user_rows = cur.fetchall()

        # Fetch all project memberships separately (avoids psycopg3 ARRAY type casting issues)
        cur.execute("""
            SELECT user_id, project_id
            FROM trueday.project_users;
        """)
        membership_rows = cur.fetchall()

        cur.close()
        conn.close()

        # Build a map: user_id -> [project_ids]
        project_map = {}
        for m in membership_rows:
            uid = m['user_id']
            pid = m['project_id']
            if uid not in project_map:
                project_map[uid] = []
            project_map[uid].append(pid)

        users = [
            {
                'id': row['id'],
                'username': row['username'],
                'project_ids': project_map.get(row['id'], [])
            }
            for row in user_rows
        ]
        return jsonify(users)

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': str(e)}), 500



@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user_by_id(user_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, username, email, role FROM trueday.users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        
        if not row:
            cur.close()
            conn.close()
            return jsonify({'error': 'User not found'}), 404
            
        # Safely handle both dict and tuple rows
        user_id_val = row.get('id') if isinstance(row, dict) else row[0]
        username = row.get('username') if isinstance(row, dict) else row[1]
        email = row.get('email') if isinstance(row, dict) else row[2]
        role = row.get('role') if isinstance(row, dict) else row[3]

        # Fetch assigned project IDs
        assigned_projects = []
        cur.execute("SELECT project_id FROM trueday.project_users WHERE user_id = %s", (user_id,))
        project_rows = cur.fetchall()
        for p_row in project_rows:
            p_id = p_row.get('project_id') if isinstance(p_row, dict) else p_row[0]
            assigned_projects.append(p_id)
            
        cur.close()
        conn.close()
        
        return jsonify({
            'id': user_id_val, 
            'username': username,
            'email': email,
            'role': role,
            'assigned_projects': assigned_projects
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/project/<int:project_id>/users', methods=['GET'])
def get_project_members(project_id):
    """Return all users assigned to a given project."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT u.id, u.username
            FROM trueday.users u
            JOIN trueday.project_users pu ON pu.user_id = u.id
            WHERE pu.project_id = %s
            ORDER BY u.username;
        """, (project_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        users = [{'id': row['id'], 'username': row['username']} for row in rows]
        return jsonify(users)
    except Exception as e:
        print(f"Error in get_project_users: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/create_ticket', methods=['POST'])
def create_ticket():
    try:
        data = request.get_json()

        # Extract fields from JSON
        title = data.get("title")
        description = data.get("description")
        priority = data.get("priority", "Medium")
        assignee_id = data.get("assignee_id")
        due_date = data.get("due_date")
        status = data.get("status", "Open")
        tag = data.get("tag", "task")
        creator_id = data.get("creator_id")
        project_name = data.get("project_name")
        label_id = data.get("label_id")
        collaborator_id = data.get("collaborator_id")
        approver_id = data.get("approver_id")

        # -------------------
        # Validate title
        # -------------------
        if not title or not title.strip():
            return jsonify({"error": "Title cannot be empty or contain only whitespace."}), 400
        
        invalid_chars = re.compile(r'["\'`\\\/]')
        if invalid_chars.search(title.strip()):
            return jsonify({"error": "Title cannot contain quotes, slashes, or backslashes."}), 400
        
        only_special_chars = re.compile(r'^[^a-zA-Z0-9\s]+$')
        if only_special_chars.match(title.strip()):
            return jsonify({"error": "Title must contain at least one letter or number."}), 400

        # -------------------
        # Validate due date
        # -------------------
        start_date = data.get("start_date")
        if start_date and due_date:
            try:
                creation_date = datetime.strptime(start_date, "%Y-%m-%d")
                due_date_obj = datetime.strptime(due_date, "%Y-%m-%d")
                if (due_date_obj - creation_date).days > 365:
                    return jsonify({"error": "Due date cannot be more than 365 days from creation date."}), 400
            except ValueError:
                return jsonify({"error": "Invalid date format. Use YYYY-MM-DD."}), 400

        # -------------------
        # Required fields check
        # -------------------
        if not all([title, description, due_date, creator_id]):
            return jsonify({"error": "Title, description, due date, and creator_id are required."}), 400

        # -------------------
        # Handle project
        # -------------------
        project_id = None
        if project_name:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('SELECT project_id FROM trueday.project WHERE project_name = %s', (project_name,))
            row = cursor.fetchone()
            if row:
                # support dict-like rows or tuple rows
                project_id = row.get('project_id') if isinstance(row, dict) else row[0]
            else:
                cursor.execute('INSERT INTO trueday.project (project_name) VALUES (%s) RETURNING project_id', (project_name,))
                new_row = cursor.fetchone()
                project_id = new_row.get('project_id') if isinstance(new_row, dict) else new_row[0]
                conn.commit()
            cursor.close()
            conn.close()

        # -------------------
        # Verify user belongs to project (if project_id is set)
        # -------------------
        if project_id:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT 1 FROM trueday.project_users 
                WHERE user_id = %s AND project_id = %s
            """, (creator_id, project_id))
            if not cursor.fetchone():
                cursor.close()
                conn.close()
                return jsonify({
                    "error": f"You (user_id: {creator_id}) are not assigned to this project (project_id: {project_id})",
                    "debug": {
                        "creator_id": creator_id,
                        "project_id": project_id,
                        "project_name": project_name
                    }
                }), 403
            
            # Also verify assignee belongs to project (if assignee_id is set)
            if assignee_id:
                cursor.execute("""
                    SELECT 1 FROM trueday.project_users 
                    WHERE user_id = %s AND project_id = %s
                """, (assignee_id, project_id))
                if not cursor.fetchone():
                    cursor.close()
                    conn.close()
                    return jsonify({
                        "error": f"Assignee (user_id: {assignee_id}) is not assigned to this project",
                        "debug": {
                            "assignee_id": assignee_id,
                            "project_id": project_id
                        }
                    }), 403
            
            cursor.close()
            conn.close()

        # -------------------
        # Create ticket
        # -------------------
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get assignee and creator usernames
        cursor.execute("SELECT username FROM trueday.users WHERE id = %s", (assignee_id,))
        assignee_row = cursor.fetchone()
        if assignee_row:
            assignee_username = assignee_row.get('username') if isinstance(assignee_row, dict) else assignee_row[0]
        else:
            assignee_username = "Unknown User"

        cursor.execute("SELECT username FROM trueday.users WHERE id = %s", (creator_id,))
        creator_row = cursor.fetchone()
        if creator_row:
            creator_username = creator_row.get('username') if isinstance(creator_row, dict) else creator_row[0]
        else:
            creator_username = "Unknown User"

        # Insert ticket
        cursor.execute("""
            INSERT INTO trueday.tickets (
                title, description, priority, assignee_id,
                due_date, status, tag, creator_id, project_id, label_id,
                collaborator_id, approver_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING ticket_id;
        """, (title.strip(), description, priority, assignee_id, due_date, status, tag, creator_id, project_id, label_id, collaborator_id, approver_id))
        ticket_row = cursor.fetchone()
        ticket_id = ticket_row.get('ticket_id') if isinstance(ticket_row, dict) else ticket_row[0]

        # Create assignment notification
        if assignee_id and str(assignee_id) != str(creator_id):
            create_notification(
                cursor,
                assignee_id,
                "New Ticket Assigned",
                f'{creator_username} assigned you the ticket: \'{title.strip()}\'',
                "assignment",
                ticket_id,
                priority
            )

        # Record creation in ticket_history
        cursor.execute("""
            INSERT INTO trueday.ticket_history (
                ticket_id, changed_by, change_type, old_value, new_value, change_details, changed_at
            ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """, (
            ticket_id,
            creator_username,
            'created',
            None,
            None,
            json.dumps({'creator_username': creator_username})
        ))

        conn.commit()

        # -------------------
        # Send email in background
        # -------------------
        def send_assignment_email():
            if assignee_id:
                try:
                    conn2 = get_db_connection()
                    cursor2 = conn2.cursor()
                    cursor2.execute("SELECT email FROM trueday.users WHERE id = %s", (assignee_id,))
                    assignee_email_row = cursor2.fetchone()
                    cursor2.close()
                    conn2.close()
                    if assignee_email_row and assignee_email_row[0]:
                        msg = Message(
                            subject=f"[TD] New Ticket Assigned: {title.strip()}",
                            recipients=[assignee_email_row[0]],
                            body=f"You have been assigned ticket #{ticket_id}: {title.strip()}"
                        )
                        mail.send(msg)
                except Exception as mail_err:
                    print(f"Error sending assignment email: {mail_err}")

        Thread(target=send_assignment_email).start()

        return jsonify({
            "message": "Ticket created successfully",
            "ticket": {
                "ticket_id": ticket_id,
                "title": title,
                "description": description,
                "priority": priority,
                "assignee_id": assignee_id,
                "due_date": due_date,
                "status": status,
                "tag": tag,
                "project_id": project_id,
                "project_name": project_name,
                "label_id": label_id
            }
        }), 201

    except Exception as e:
        print(f"Error creating ticket: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/api/reports', methods=['POST'])
def get_filtered_reports():
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()

        # Extract filters from the request
        start_date = data.get('startDate')
        end_date = data.get('endDate')
        employee_id = data.get('employeeId')
        priority = data.get('priority')
        status = data.get('status')
        report_type = data.get('reportType')

        # Build the SQL query dynamically based on filters
        query = """
            SELECT 
                t.id AS ticket_id,
                t.title,
                t.priority,
                t.status,
                t.created_at,
                t.due_date,
                u.username AS assignee_name
            FROM 
                trueday.tickets t
            LEFT JOIN 
                trueday.users u
            ON 
                t.assignee_id = u.id
            WHERE 1=1
        """
        params = []

        if start_date and end_date:
            query += " AND t.created_at BETWEEN %s AND %s"
            params.extend([start_date, end_date])

        if employee_id and employee_id != 'all':
            query += " AND t.assignee_id = %s"
            params.append(employee_id)

        if priority and priority != 'all':
            query += " AND t.priority = %s"
            params.append(priority)

        if status and status != 'all':
            query += " AND t.status = %s"
            params.append(status)

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()

        # Map rows to a list of dictionaries
        reports = [
            {
                "ticket_id": row[0],
                "title": row[1],
                "priority": row[2],
                "status": row[3],
                "created_at": row[4].strftime('%Y-%m-%d') if row[4] else None,
                "due_date": row[5].strftime('%Y-%m-%d') if row[5] else None,
                "assignee_name": row[6]
            }
            for row in rows
        ]

        conn.close()
        return jsonify(reports)

    except Exception as e:
        print(f"Error fetching filtered reports: {e}")
        return jsonify({"error": "Failed to fetch reports"}), 500            

@app.route('/api/responses', methods=['POST'])
def submit_responses():
    conn = None
    cur = None
    try:
        # Validate JSON data
        if not request.is_json:
            return jsonify({'error': 'Request must be JSON'}), 400
            
        data = request.get_json()
        responses = data.get('responses', [])
        
        if not responses:
            return jsonify({'error': 'No responses provided'}), 400
            
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Validate all responses before inserting any
        validation_errors = []
        for i, response in enumerate(responses):
            # Check required fields
            required_fields = ['ticket_id', 'user_id', 'question_id']
            missing_fields = [field for field in required_fields if field not in response]
            
            if missing_fields:
                validation_errors.append({
                    'index': i,
                    'error': f'Missing required fields: {", ".join(missing_fields)}',
                    'response': response
                })
                continue
                
            # Validate field types
            try:
                ticket_id = int(response['ticket_id'])
                user_id = int(response['user_id'])
                question_id = int(response['question_id'])
            except (ValueError, TypeError):
                validation_errors.append({
                    'index': i,
                    'error': 'ticket_id, user_id, and question_id must be integers',
                    'response': response
                })
        
        if validation_errors:
            return jsonify({
                'error': 'Validation failed',
                'details': validation_errors,
                'status': 'error'
            }), 400
            
        # Insert all valid responses
        inserted_ids = []
        for response in responses:
            cur.execute("""
                INSERT INTO responses 
                (ticket_id, user_id, question_id, selected_option, text_response)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING response_id;
            """, (
                int(response['ticket_id']),
                int(response['user_id']),
                int(response['question_id']),
                response.get('selected_option'),
                response.get('text_response')
            ))
            
            _r = cur.fetchone()
            if isinstance(_r, dict):
                response_id = _r.get('response_id') if _r.get('response_id') is not None else (next(iter(_r.values())) if _r else None)
            else:
                response_id = _r[0] if _r else None
            inserted_ids.append(response_id)
            print(f"Inserted response ID: {response_id}")
        
        conn.commit()
        return jsonify({
            'message': f'Successfully saved {len(inserted_ids)} responses',
            'inserted_ids': inserted_ids,
            'status': 'success'
        }), 201
        
    except Exception as e:
        print(f"Error saving responses: {str(e)}")
        if conn:
            conn.rollback()
        return jsonify({
            'error': 'Failed to save responses',
            'details': str(e),
            'status': 'error'
        }), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

@app.route('/api/responses/<int:ticket_id>', methods=['GET'])
def get_responses(ticket_id):
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT 
                r.response_id,
                r.ticket_id,
                r.user_id,
                r.question_id,
                r.selected_option,
                r.text_response,
                r.created_at,
                u.username as user_name,
                q.question
            FROM responses r
            JOIN trueday.users u ON r.user_id = u.id
            JOIN questions q ON r.question_id = q.q_id
            WHERE r.ticket_id = %s
            ORDER BY r.created_at DESC
        """, (ticket_id,))
        
        responses = cur.fetchall()
        
        # Format the response
        formatted_responses = [{
            'response_id': r[0],
            'ticket_id': r[1],
            'user_id': r[2],
            'question_id': r[3],
            'selected_option': r[4],
            'text_response': r[5],
            'created_at': r[6].isoformat() if r[6] else None,
            'user_name': r[7],
            'question_text': r[8]
        } for r in responses]
        
        return jsonify(formatted_responses), 200
        
    except Exception as e:
        print(f"Error fetching responses: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# @app.route('/api/responses', methods=['GET'])
# def get_all_responses():
#     try:
#         conn = get_db_connection()
#         cur = conn.cursor()
#         cur.execute("""
#             SELECT 
#                 r.response_id,
#                 r.ticket_id,
#                 r.user_id,
#                 r.question_id,
#                 r.selected_option,
#                 r.text_response,
#                 r.created_at,
#                 u.username,
#                 q.question
#             FROM responses r
#             JOIN trueday.users u ON r.user_id = u.id
#             JOIN questions q ON r.question_id = q.q_id
#             ORDER BY r.created_at DESC
#         """)
#         responses = cur.fetchall()
#         formatted = [{
#             'response_id': r[0],
#             'ticket_id': r[1],
#             'user_id': r[2],
#             'question_id': r[3],
#             'selected_option': r[4],
#             'text_response': r[5],
#             'created_at': r[6].isoformat() if r[6] else None,
#             'username': r[7],
#             'question_text': r[8]
#         } for r in responses]
#         cur.close()
#         conn.close()
#         return jsonify(formatted)
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500   

@app.route('/api/responses', methods=['GET'])
def get_all_responses():
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # SQL query (ONLY uses t.status, no JOIN with statuses)
        cur.execute("""
            SELECT 
                r.response_id,
                r.ticket_id,
                r.user_id,
                r.question_id,
                r.selected_option,
                r.text_response,
                r.created_at,
                u.username,
                t.title AS ticket_title,
                q.question AS question_text,
                t.status  -- Only the status column from tickets
            FROM responses r
            JOIN users u ON r.user_id = u.id
            JOIN tickets t ON r.ticket_id = t.ticket_id
            JOIN questions q ON r.question_id = q.q_id
            ORDER BY r.created_at DESC
        """)
        
        responses = cur.fetchall()
        
        # Format response (status comes directly from tickets)
        formatted_responses = [
            {
            'response_id': r[0],
            'ticket_id': r[1],
            'user_id': r[2],
            'question_id': r[3],
            'selected_option': r[4],
            'text_response': r[5],
                'created_at': r[6].isoformat() if isinstance(r[6], datetime) else None,
            'username': r[7],
                'ticket_title': r[8],
                'question_text': r[9],
                'status': r[10]  # Directly from tickets.status
            }
            for r in responses
        ]
        
        return jsonify(formatted_responses), 200
        
    except Exception as e:
        print(f"Error fetching responses: {str(e)}")
        return jsonify({'error': str(e)}), 500            
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()         

# Route to get a single ticket by ID
@app.route('/tickets/<int:ticket_id>', methods=['GET'])
def get_single_ticket(ticket_id):
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    try:
        conn = get_db_connection()
        cur = conn.cursor()  #  no cursor_factory needed

        
        # Get the ticket with assignee and project information
        cur.execute("""
            SELECT 
                t.ticket_id,
                t.title,
                t.description,
                t.priority,
                t.assignee_id,
                t.creator_id,
                t.due_date,
                CASE 
                    WHEN t.status = 'Open' THEN 'new'
                    WHEN t.status = 'In Progress' THEN 'In Progress'
                    WHEN t.status = 'On Hold' THEN 'On Hold'
                    WHEN t.status = 'QA' THEN 'QA'
                    WHEN t.status = 'Resolved' THEN 'Resolved'
                    ELSE t.status
                END as status,
                t.created_at,
                u.username as assignee_name,
                c.username as creator_name,
                t.collaborator_id,
                collab.username as collaborator_name,
                t.approver_id,
                appr.username as approver_name,
                t.project_id,
                p.project_name
            FROM trueday.tickets t 
            LEFT JOIN trueday.users u ON t.assignee_id = u.id 
            LEFT JOIN trueday.users c ON t.creator_id = c.id
            LEFT JOIN trueday.users collab ON t.collaborator_id = collab.id
            LEFT JOIN trueday.users appr ON t.approver_id = appr.id
            LEFT JOIN trueday.project p ON t.project_id = p.project_id
            WHERE t.ticket_id = %s
        """, (ticket_id,))
        
        ticket = cur.fetchone()
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        # Convert datetime objects to strings
        if ticket.get('created_at'):
            ticket['created_at'] = ticket['created_at'].isoformat()
        if ticket.get('due_date'):
            ticket['due_date'] = ticket['due_date'].isoformat()
        # Ensure consistent keys for frontend
        if 'project_name' in ticket and ticket['project_name'] is not None:
            ticket['project_name'] = ticket['project_name']
        
        cur.close()
        conn.close()
        
        return jsonify(ticket)
    except Exception as e:
        print(f"Error in get_single_ticket: {str(e)}")  # Add error logging
        return jsonify({'error': str(e)}), 500


    
# Route to permanently delete a ticket
@app.route('/api/permanently_delete_ticket/<int:ticket_id>', methods=['DELETE'])
def permanently_delete_ticket(ticket_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
       
        # First check if the ticket exists
        cursor.execute("SELECT ticket_id FROM trueday.tickets WHERE ticket_id = %s", (ticket_id,))
        if not cursor.fetchone():
            return jsonify({"error": "Ticket not found"}), 404
           
        # Dynamically discover foreign key constraints that reference trueday.tickets
        try:
            fk_query = """
                SELECT conrelid::regclass::text AS referencing_table,
                       array_agg(att2.attname ORDER BY i) AS referencing_columns
                FROM (
                  SELECT pc.oid, pc.conrelid, pc.confrelid, pc.conkey, generate_subscripts(pc.conkey,1) AS i
                  FROM pg_constraint pc
                ) c
                JOIN pg_attribute att2 ON att2.attrelid = c.conrelid AND att2.attnum = c.conkey[c.i]
                JOIN pg_constraint pc ON pc.oid = c.oid
                WHERE pc.contype = 'f' AND pc.confrelid = 'trueday.tickets'::regclass
                GROUP BY conrelid;
            """
            cursor.execute(fk_query)
            fk_rows = cursor.fetchall()
        except Exception as e:
            print(f"Warning: failed to query FK references: {e}")
            fk_rows = []

        # fk_rows may be tuple rows or dict rows depending on cursor.row_factory
        referencing_tables = []
        for r in fk_rows:
            try:
                if isinstance(r, dict):
                    table_name = r.get('referencing_table')
                    cols = r.get('referencing_columns')
                else:
                    table_name = r[0]
                    cols = r[1]
                referencing_tables.append((table_name, cols))
            except Exception:
                continue

        # Always attempt some well-known dependent deletes as a fallback
        fallback_tables = [
            ('trueday.attachments', ['ticket_id']),
            ('trueday.messages', ['ticket_id']),
            ('trueday.ticket_history', ['ticket_id']),
            ('trueday.worklogs', ['ticket_id']),
            ('trueday.responses', ['ticket_id']),
            ('progress_pulse', ['ticket_number'])
        ]

        # Combine discovered and fallback (avoid duplicates)
        all_targets = {t[0]: t[1] for t in fallback_tables}
        for tname, cols in referencing_tables:
            if tname:
                all_targets.setdefault(tname, cols or ['ticket_id'])

        # Attempt deletions on discovered targets
        for table, cols in all_targets.items():
            for col in cols:
                # Only attempt reasonable column names
                if col not in ('ticket_id', 'ticket_number', 'ticketid'):
                    # still try but be cautious
                    pass
                try:
                    # Support schema-qualified table names
                    parts = table.split('.')
                    if len(parts) == 2:
                        cursor.execute(sql.SQL("DELETE FROM {}.{} WHERE {} = %s").format(
                            sql.Identifier(parts[0]), sql.Identifier(parts[1]), sql.Identifier(col)
                        ), (ticket_id,))
                    else:
                        cursor.execute(sql.SQL("DELETE FROM {} WHERE {} = %s").format(
                            sql.Identifier(table), sql.Identifier(col)
                        ), (ticket_id,))
                except Exception as e:
                    print(f"Warning: failed to delete from {table}.{col}: {e}")

        # Finally delete the ticket itself
        try:
            cursor.execute("DELETE FROM trueday.tickets WHERE ticket_id = %s", (ticket_id,))
        except Exception as e:
            # If deletion fails, rollback and return error
            conn.rollback()
            cursor.close()
            conn.close()
            print(f"Error deleting ticket {ticket_id}: {e}")
            return jsonify({"error": f"Failed to delete ticket: {str(e)}"}), 500

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "Ticket deleted permanently"}), 200
    except Exception as e:
        print(f"Error in permanently_delete_ticket: {e}")
        return jsonify({"error": str(e)}), 500    
    
# Route to get messages for a ticket
@app.route('/get_ticket_messages/<int:ticket_id>', methods=['GET', 'OPTIONS'])
def get_ticket_messages(ticket_id):
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    try:
        print(f"Fetching messages for ticket ID: {ticket_id}")
        conn = get_db_connection()
        cursor = conn.cursor()
 
        # Check if ticket exists
        cursor.execute("SELECT ticket_id FROM trueday.tickets WHERE ticket_id = %s", (ticket_id,))
        if not cursor.fetchone():
            return jsonify({"error": f"Ticket with ID {ticket_id} not found"}), 404
 
        # Get messages with user information and threading
        cursor.execute("""
            SELECT 
                m.id, 
                m.message_text, 
                m.created_at, 
                m.user_id, 
                u.username,
                m.parent_id
            FROM trueday.messages m
            JOIN trueday.users u ON m.user_id = u.id
            WHERE m.ticket_id = %s
            ORDER BY m.created_at DESC
        """, (ticket_id,))
       
        messages = cursor.fetchall()
       
        print(f"Found {len(messages)} messages for ticket {ticket_id}")
       
        # Build a safe message list that works with dict-row (dict_row) and tuple-row results
        message_list = []
        for msg in messages:
            try:
                if isinstance(msg, dict):
                    created_at_val = msg.get('created_at')
                    if isinstance(created_at_val, datetime):
                        ts = created_at_val.isoformat()
                    else:
                        ts = str(created_at_val) if created_at_val else None

                    message_list.append({
                        "id": msg.get('id'),
                        "message": msg.get('message_text'),
                        "timestamp": ts,
                        "user_id": msg.get('user_id'),
                        "username": msg.get('username'),
                        "parent_id": msg.get('parent_id')
                    })
                else:
                    # tuple/list-like row
                    created_at_val = msg[2] if len(msg) > 2 else None
                    ts = created_at_val.isoformat() if isinstance(created_at_val, datetime) else (str(created_at_val) if created_at_val else None)
                    message_list.append({
                        "id": msg[0] if len(msg) > 0 else None,
                        "message": msg[1] if len(msg) > 1 else None,
                        "timestamp": ts,
                        "user_id": msg[3] if len(msg) > 3 else None,
                        "username": msg[4] if len(msg) > 4 else None,
                        "parent_id": msg[5] if len(msg) > 5 else None
                    })
            except Exception as e:
                print(f"⚠️ Skipping message row due to parsing error: {e}")
                continue

        cursor.close()
        conn.close()

        return jsonify(message_list), 200
    except Exception as e:
        print(f"Error fetching messages: {e}")
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()
        return jsonify({"error": str(e)}), 500

@app.route('/upload_attachment', methods=['POST', 'OPTIONS'])
def upload_attachment():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
           
        file = request.files['file']
        ticket_id = request.form.get('ticket_id')
        user_id = request.form.get('user_id')
       
        # Clean up string 'undefined' or 'null' passed from frontend FormData
        if ticket_id in ('undefined', 'null', ''):
            ticket_id = None
        if user_id in ('undefined', 'null', ''):
            user_id = None

        if not all([file, ticket_id]):
            return jsonify({"error": "Missing required fields"}), 400
           
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400
           
        if not allowed_file(file.filename):
            return jsonify({"error": f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"}), 400
           
        # Secure the filename and create a unique name
        filename = secure_filename(file.filename)
        unique_filename = f"{ticket_id}_{int(time.time())}_{filename}"
        file_path = os.path.join(ATTACHMENTS_FOLDER, unique_filename)
        
        # Ensure attachments folder exists then save the file
        try:
            os.makedirs(ATTACHMENTS_FOLDER, exist_ok=True)
        except Exception as e:
            print(f"⚠️ Could not create attachments folder: {e}")
        # Save the file
        try:
            file.save(file_path)
        except Exception as e:
            print(f"Error saving uploaded file to disk: {e}")
            return jsonify({"error": "Failed to save uploaded file"}), 500
        # Diagnostic: log saved file info
        try:
            print(f"📎 Uploaded file saved to: {file_path}")
            print(f"📎 file.exists: {os.path.exists(file_path)}, size on disk: {os.path.getsize(file_path)}")
            print(f"📎 ticket_id={ticket_id}, user_id={user_id}, filename={filename}, unique_filename={unique_filename}, content_type={file.content_type}")
        except Exception as _:
            pass
        
        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Save to database (store only the unique filename in file_path)
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO trueday.attachments
            (ticket_id, file_name, file_path, file_type, file_size, uploaded_by)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, uploaded_at;
        """, (ticket_id, filename, unique_filename, file.content_type, file_size, user_id))

        created_row = cursor.fetchone()
        print(f"📦 attachments INSERT returned: {created_row}")
        # Support psycopg dict_row or tuple-like rows
        if created_row is None:
            print("⚠️ attachments INSERT returned no row")
            attachment_id = None
            uploaded_at = None
        elif isinstance(created_row, dict):
            attachment_id = created_row.get('id') or (list(created_row.values())[0] if len(created_row) > 0 else None)
            uploaded_at = created_row.get('uploaded_at') or (list(created_row.values())[1] if len(created_row) > 1 else None)
        else:
            # tuple/list-like
            try:
                attachment_id = created_row[0]
            except Exception:
                attachment_id = None
            try:
                uploaded_at = created_row[1] if len(created_row) > 1 else None
            except Exception:
                uploaded_at = None
        
        # Resolve uploader username for history
        cursor.execute("SELECT username FROM trueday.users WHERE id = %s", (user_id,))
        uploader_row = cursor.fetchone()
        if uploader_row is None:
            uploader_name = 'Unknown User'
        elif isinstance(uploader_row, dict):
            uploader_name = uploader_row.get('username') or 'Unknown User'
        else:
            uploader_name = uploader_row[0] if len(uploader_row) > 0 else 'Unknown User'

        # Record attachment add in ticket history
        try:
            cursor.execute("""
                INSERT INTO trueday.ticket_history (
                    ticket_id, changed_by, change_type, old_value, new_value, change_details, changed_at
                ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
            """, (
                ticket_id,
                uploader_name,
                'attachment_add',
                None,
                filename,
                json.dumps({"attachment_id": attachment_id, "file_path": unique_filename})
            ))
        except Exception as e:
            print(f"⚠️ Failed to record attachment add history: {e}")

        # Trigger attachment notifications
        try:
            cursor.execute("SELECT assignee_id, creator_id, title FROM trueday.tickets WHERE ticket_id = %s", (ticket_id,))
            t_row = cursor.fetchone()
            if t_row:
                t_assignee_id = t_row.get('assignee_id') if isinstance(t_row, dict) else t_row[0]
                t_creator_id = t_row.get('creator_id') if isinstance(t_row, dict) else t_row[1]
                t_title = t_row.get('title') if isinstance(t_row, dict) else t_row[2]
                
                # Notify assignee
                if t_assignee_id and str(t_assignee_id) != str(user_id):
                    create_notification(
                        cursor,
                        t_assignee_id,
                        f'New Attachment on \'{t_title}\'',
                        f'{uploader_name} attached \'{filename}\'',
                        'attachment',
                        ticket_id
                    )
                # Notify creator
                if t_creator_id and str(t_creator_id) != str(user_id) and str(t_creator_id) != str(t_assignee_id):
                    create_notification(
                        cursor,
                        t_creator_id,
                        f'New Attachment on \'{t_title}\'',
                        f'{uploader_name} attached \'{filename}\'',
                        'attachment',
                        ticket_id
                    )
        except Exception as notify_err:
            print(f"⚠️ Error triggering attachment notifications: {notify_err}")

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({
            "id": attachment_id,
            "ticket_id": ticket_id,
            "file_name": filename,
            "file_path": unique_filename,
            "file_type": file.content_type,
            "file_size": file_size,
            "uploaded_by": user_id,
            "uploaded_at": (uploaded_at.isoformat() if hasattr(uploaded_at, 'isoformat') else (str(uploaded_at) if uploaded_at is not None else None))
        }), 201
       
    except Exception as e:
        print("Error uploading file:", str(e))
        return jsonify({"error": str(e)}), 500
    
# Function to clean message text for email
def clean_message_for_email(message_text):
    """Clean message text for email display"""
    import html
    if not message_text:
        return ""
    
    # Decode HTML entities
    cleaned = html.unescape(message_text)
    
    # Remove HTML tags if present
    import re
    cleaned = re.sub(r'<[^>]+>', '', cleaned)
    
    # Replace common HTML entities
    cleaned = cleaned.replace('&nbsp;', ' ')
    cleaned = cleaned.replace('&amp;', '&')
    cleaned = cleaned.replace('&lt;', '<')
    cleaned = cleaned.replace('&gt;', '>')
    cleaned = cleaned.replace('&quot;', '"')
    
    return cleaned.strip()

# Function to extract usernames from message text
def extract_tagged_usernames(message_text):
    """Extract usernames that are tagged with @ symbol from message text"""
    import re
    print(f"🔍 Extracting usernames from message: {message_text}")
    print(f"📝 Message type: {type(message_text)}")
    print(f"📝 Message length: {len(message_text) if message_text else 0}")
    
    if not message_text:
        print("❌ Message text is empty or None")
        return []
    
    # Extract text content from HTML if present
    if '<' in message_text and '>' in message_text:
        print(f"🔍 Message contains HTML tags, extracting text content...")
        html_pattern = r'<[^>]+>'
        text_content = re.sub(html_pattern, '', message_text)
        print(f"🔍 Text content after HTML removal: {text_content}")
    else:
        text_content = message_text
    
    # Pattern to match exactly 2 words after @ (firstname lastname)
    # This will match @firstname lastname and stop at word boundaries
    pattern = r'@([a-zA-Z]+\s+[a-zA-Z]+)(?=\s|$|\.|,|;|:|!|\?|<\/)'
    print(f"🔍 Using pattern: {pattern}")
    print(f"🔍 Text content: '{text_content}'")
    matches = re.findall(pattern, text_content)
    print(f"🔍 Raw regex matches: {matches}")
    
    # Clean up matches - remove extra whitespace and filter out empty matches
    cleaned_matches = []
    for match in matches:
        # Remove trailing spaces from the username
        cleaned = match.strip()
        if cleaned and len(cleaned) > 0:
            cleaned_matches.append(cleaned)
    
    unique_matches = list(set(cleaned_matches))  # Remove duplicates
    
    print(f"📝 Found usernames with improved regex: {unique_matches}")
    print(f"🔍 Raw matches: {matches}")
    print(f"🔍 Cleaned matches: {cleaned_matches}")
    
    return unique_matches
    


# Function to send tagging notification emails
def send_tagging_notifications(tagged_usernames, ticket_id, commenter_username, message_text):
    """Send email notifications to tagged users"""
    print(f"🔍 Starting tagging notification process...")
    print(f"📝 Tagged usernames: {tagged_usernames}")
    print(f"🎫 Ticket ID: {ticket_id}")
    print(f"👤 Commenter: {commenter_username}")
    print(f"💬 Full Message: {message_text}")
    print(f"💬 Message length: {len(message_text)}")
    print(f"💬 Message type: {type(message_text)}")
    print(f"📧 Mail configuration: server={app.config['MAIL_SERVER']}, port={app.config['MAIL_PORT']}, username={app.config['MAIL_USERNAME']}")
    print(f"🔍 Function called with args: tagged_usernames={tagged_usernames}, ticket_id={ticket_id}, commenter_username={commenter_username}")
    
    # Clean the message for email display
    cleaned_message = clean_message_for_email(message_text)
    print(f"🧹 Cleaned Message: {cleaned_message}")
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get ticket information
        cursor.execute("SELECT title FROM trueday.tickets WHERE ticket_id = %s", (ticket_id,))
        ticket_row = cursor.fetchone()
        if not ticket_row:
            print(f"❌ Ticket {ticket_id} not found in database")
            cursor.close()
            conn.close()
            return
        ticket_title = ticket_row[0]
        print(f"📋 Ticket title: {ticket_title}")
        
        # Get commenter information
        cursor.execute("SELECT username FROM trueday.users WHERE username = %s", (commenter_username,))
        commenter_row = cursor.fetchone()
        commenter_name = commenter_row[0] if commenter_row else commenter_username
        print(f"👤 Commenter name: {commenter_name}")
        
        # Send email to each tagged user
        print(f"🔍 Total tagged usernames to process: {len(tagged_usernames)}")
        
        # Debug: List all users in database to see what's available
        cursor.execute("SELECT username, email FROM trueday.users LIMIT 10")
        all_users = cursor.fetchall()
        print(f"🔍 Sample users in database: {all_users}")
        
        # Also check for the specific tagged user
        for username in tagged_usernames:
            print(f"🔍 Looking for user: '{username}' in database...")
            cursor.execute("SELECT username, email FROM trueday.users WHERE username ILIKE %s", (f"%{username}%",))
            matching_users = cursor.fetchall()
            print(f"🔍 Users matching '{username}': {matching_users}")
        
        for username in tagged_usernames:
            print(f"🔍 Looking up user: {username}")
            print(f"🔍 Username type: {type(username)}, length: {len(username)}")
            
            # Try multiple lookup strategies
            user_row = None
            lookup_strategy = "exact_username"
            
            # Strategy 1: Exact username match
            cursor.execute("SELECT username, email FROM trueday.users WHERE username = %s", (username,))
            user_row = cursor.fetchone()
            if user_row:
                print(f"✅ Found user {username} by exact username match")
                print(f"📧 User email: {user_row[1]}")
            
            # Strategy 2: Partial username match (if exact didn't work)
            if not user_row:
                print(f"🔍 Trying partial username match for: {username}")
                cursor.execute("SELECT username, email FROM trueday.users WHERE username ILIKE %s", (f"%{username}%",))
                user_row = cursor.fetchone()
                if user_row:
                    print(f"✅ Found user {username} by partial username match")
                    print(f"📧 User email: {user_row[1]}")
                    lookup_strategy = "partial_username"
            
            # Strategy 3: Try without schema prefix
            if not user_row:
                cursor.execute("SELECT username, email FROM users WHERE username = %s", (username,))
                user_row = cursor.fetchone()
                if user_row:
                    print(f"✅ Found user {username} in users table (without schema)")
                    lookup_strategy = "no_schema"
            
            if not user_row:
                print(f"❌ User {username} not found in any table with any strategy")
                continue
            
            if user_row and user_row[1]:  # user_row[1] is email
                user_email = user_row[1]
                actual_username = user_row[0]
                print(f"📧 Found email for {username} (actual username: {actual_username}): {user_email}")
                print(f"🔍 Lookup strategy used: {lookup_strategy}")
                
                # Create beautiful HTML email message like collaborator notifications
                subject = f"[TD] You were tagged in ticket #{ticket_id}"
                html = f"""
<div style="font-family:Segoe UI, sans-serif; font-size:14px; color:#333; line-height:1.6; max-width:640px; border:1px solid #e5e7eb; border-radius:10px; padding:20px; background:#fafafa;">
  <h2 style="margin:0 0 10px 0; color:#111827;">You were tagged in a ticket</h2>
  <p>Hi {actual_username},</p>
  <p><strong>{commenter_name}</strong> tagged you in ticket <strong>#{ticket_id}</strong>.</p>
  <p>You can view the ticket and respond to the comment.</p>
  <p style="margin-top:16px;">
    <a href="https://trueday.ariths.com/#/edit-ticket/{ticket_id}" style="background:#4f46e5; color:#fff; text-decoration:none; padding:10px 14px; border-radius:8px;">Open Ticket</a>
  </p>
  <hr style="border:none; border-top:1px solid #e5e7eb; margin:20px 0;" />
  <div style="font-size:12px; color:#6b7280;">This is an automated notification from Trueday.</div>
 </div>
"""
                
                print(f"📤 Attempting to send email to {user_email}...")
                
                try:
                    print(f"📧 Creating email message for {user_email}...")
                    # Create a new Flask app context for the background thread
                    with app.app_context():
                        msg = Message(
                            subject=subject,
                            recipients=[user_email],
                            html=html
                        )
                        print(f"📧 Email message created, attempting to send...")
                        mail.send(msg)
                        print(f"📧 Email sent successfully!")
                    print(f"✅ Tagging notification sent successfully to {username} ({user_email})")
                except Exception as email_error:
                    print(f"❌ Failed to send email to {user_email}: {email_error}")
                    print(f"❌ Email error type: {type(email_error)}")
                    import traceback
                    traceback.print_exc()
            else:
                print(f"❌ No email found for username: {username}")
        
        cursor.close()
        conn.close()
        print(f"🎉 Tagging notification process completed")
    except Exception as e:
        print(f"❌ Error sending tagging notifications: {e}")
        import traceback
        traceback.print_exc()
        logger.error(f"Error sending tagging notifications: {e}")



# Route to add a message to a ticket
@app.route('/add_ticket_message', methods=['POST'])
def add_ticket_message():
    print(f"🎯 /add_ticket_message endpoint called at {datetime.now()}")
    print(f"🎯 Request method: {request.method}")

    try:
        data = request.get_json(silent=True) or {}
        print(f"🎯 Raw request data: {data}")

        ticket_id = data.get('ticket_id')
        message = data.get('message')
        user_id = data.get('user_id')
        timestamp = data.get('timestamp')
        parent_id = data.get('parent_id')  # For threaded replies

        print(f"🎯 Received message data: ticket_id={ticket_id}, user_id={user_id}, parent_id={parent_id}")

        if not all([ticket_id, message, user_id]):
            print(f"❌ Missing required fields: ticket_id={ticket_id}, message_present={bool(message)}, user_id={user_id}")
            return jsonify({"error": "Ticket ID, message, and user ID are required"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # Helper to extract values safely from dict-like or tuple-like rows
        def get_col(row, key_or_index):
            if row is None:
                return None
            if isinstance(row, dict):
                # if key provided as str, use it; if numeric index, get by value order
                if isinstance(key_or_index, str):
                    return row.get(key_or_index)
                try:
                    return list(row.values())[key_or_index]
                except Exception:
                    return None
            # tuple/list-like
            try:
                return row[key_or_index]
            except Exception:
                # if index out of range or row is a single scalar
                if key_or_index == 0:
                    return row
                return None

        # Check if ticket exists
        cursor.execute("SELECT ticket_id FROM trueday.tickets WHERE ticket_id = %s", (ticket_id,))
        if not cursor.fetchone():
            print(f"❌ Ticket with ID {ticket_id} not found")
            cursor.close()
            conn.close()
            return jsonify({"error": f"Ticket with ID {ticket_id} not found"}), 404

        # Check if user exists
        cursor.execute("SELECT id FROM trueday.users WHERE id = %s", (user_id,))
        user_row = cursor.fetchone()
        if not user_row:
            # If user doesn't exist, create a temporary user
            print(f"⚠️ User {user_id} not found, creating temporary user")
            cursor.execute("""
                INSERT INTO trueday.users (username, email, password)
                VALUES (%s, %s, %s)
                RETURNING id;
            """, (f"User_{user_id}", f"user_{user_id}@example.com", "temp_password"))
            created_user_row = cursor.fetchone()
            # extract id whether row is dict or tuple
            new_user_id = get_col(created_user_row, 'id') if isinstance(created_user_row, dict) else get_col(created_user_row, 0)
            if new_user_id is None:
                # As a fallback, try first value
                try:
                    new_user_id = list(created_user_row.values())[0]
                except Exception:
                    new_user_id = created_user_row[0] if created_user_row else None
            user_id = new_user_id
            print(f"✅ Created temporary user with ID: {user_id}")

        # Insert the message
        insert_query = sql.SQL("""
            INSERT INTO trueday.messages (ticket_id, user_id, message_text, parent_id, created_at)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, created_at;
        """)
        created_at_val = timestamp or datetime.now()
        cursor.execute(insert_query, (ticket_id, user_id, message, parent_id, created_at_val))
        result = cursor.fetchone()

        # Safely extract message id and created_at
        if isinstance(result, dict):
            message_id = result.get('id') or result.get('message_id') or list(result.values())[0]
            created_at = result.get('created_at') or (list(result.values())[1] if len(result) > 1 else created_at_val)
        else:
            # tuple-like
            message_id = result[0] if result and len(result) > 0 else None
            created_at = result[1] if result and len(result) > 1 else created_at_val

        # Get user information (username)
        cursor.execute("SELECT username FROM trueday.users WHERE id = %s", (user_id,))
        user_row = cursor.fetchone()
        if isinstance(user_row, dict):
            username = user_row.get('username')
        else:
            username = user_row[0] if user_row else None
        print(f"👤 Message author username: {username}")

        # Record comment add in ticket history (store concise details)
        try:
            cleaned = clean_message_for_email(message)
            snippet = (cleaned[:120] + '…') if cleaned and len(cleaned) > 120 else (cleaned or '')
            cursor.execute("""
                INSERT INTO trueday.ticket_history (
                    ticket_id, changed_by, change_type, old_value, new_value, change_details, changed_at
                ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
            """, (
                ticket_id,
                username,
                'comment',
                None,
                snippet,
                json.dumps({"message_id": message_id})
            ))
        except Exception as e:
            print(f"⚠️ Failed to record comment history: {e}")

        conn.commit()
        cursor.close()
        conn.close()

        # Extract tagged usernames and send notifications
        try:
            tagged_usernames = extract_tagged_usernames(message)
            if tagged_usernames:
                # Fire-and-forget is okay here; but keep it synchronous for now to preserve context
                try:
                    send_tagging_notifications(tagged_usernames, ticket_id, username, message)
                except Exception as email_error:
                    print(f"❌ Error sending email notifications: {email_error}")
        except Exception as e:
            print(f"🔍 Error extracting/sending tagging notifications: {e}")

        # Ensure created_at is JSON serializable
        try:
            timestamp_iso = created_at.isoformat() if isinstance(created_at, datetime) else str(created_at)
        except Exception:
            timestamp_iso = str(created_at)

        response_data = {
            "id": message_id,
            "message": message,
            "user_id": user_id,
            "username": username,
            "timestamp": timestamp_iso
        }
        print(f"✅ Returning response: {response_data}")
        return jsonify(response_data), 201

    except Exception as e:
        print(f"❌ Error adding message: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# Update an existing ticket message
@app.route('/update_ticket_message/<int:message_id>', methods=['PUT', 'POST', 'OPTIONS'])
def update_ticket_message(message_id):
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'PUT,POST,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    
    print(f"Received {request.method} request to update message {message_id}")
    print(f"Request headers: {dict(request.headers)}")
    
    try:
        data = request.get_json(silent=True) or {}
        print(f"Request data: {data}")
        
        new_message = data.get('message')
        user_id = data.get('user_id')

        if not all([message_id, new_message, user_id]):
            print(f"Missing required fields: message_id={message_id}, new_message={bool(new_message)}, user_id={user_id}")
            return jsonify({"error": "message_id, message and user_id are required"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # Ensure message exists and belongs to the user performing the update
        cursor.execute("SELECT ticket_id, user_id, message_text FROM trueday.messages WHERE id = %s", (message_id,))
        row = cursor.fetchone()
        if not row:
            cursor.close(); conn.close()
            print(f"Message {message_id} not found")
            return jsonify({"error": "Message not found"}), 404

        ticket_id, owner_user_id, old_message_text = row
        print(f"Message owner: {owner_user_id}, requesting user: {user_id}")
        
        if str(owner_user_id) != str(user_id):
            cursor.close(); conn.close()
            print(f"Authorization failed: {owner_user_id} != {user_id}")
            return jsonify({"error": "Not authorized to edit this message"}), 403

        cursor.execute("""
            UPDATE trueday.messages
            SET message_text = %s
            WHERE id = %s
            RETURNING id, message_text, created_at, user_id
        """, (new_message, message_id))
        updated = cursor.fetchone()
        print(f"Updated message: {updated}")

        # Fetch username
        cursor.execute("SELECT username FROM trueday.users WHERE id = %s", (updated[3],))
        username_row = cursor.fetchone()
        username = username_row[0] if username_row else ''

        # Record comment edit in history
        try:
            old_clean = clean_message_for_email(old_message_text)
            new_clean = clean_message_for_email(new_message)
            old_snippet = (old_clean[:120] + '…') if old_clean and len(old_clean) > 120 else (old_clean or '')
            new_snippet = (new_clean[:120] + '…') if new_clean and len(new_clean) > 120 else (new_clean or '')
            cursor.execute("""
                INSERT INTO trueday.ticket_history (
                    ticket_id, changed_by, change_type, old_value, new_value, change_details, changed_at
                ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
            """, (
                ticket_id,
                username,
                'comment_edit',
                old_snippet,
                new_snippet,
                json.dumps({"message_id": updated[0]})
            ))
        except Exception as e:
            print(f"⚠️ Failed to record comment edit history: {e}")

        conn.commit()
        cursor.close(); conn.close()

        # Extract tagged usernames and send notifications in background for edited messages
        print(f"🔍 Starting to extract tagged usernames from edited message...")
        tagged_usernames = extract_tagged_usernames(new_message)
        print(f"🎯 Extracted tagged usernames from edited message: {tagged_usernames}")
        
        if tagged_usernames:
            print(f"🎯 Found {len(tagged_usernames)} tagged usernames in edited message: {tagged_usernames}")
            print(f"🚀 Starting background thread for email notifications for edited message...")
            # Send notifications in background thread to avoid blocking
            Thread(target=send_tagging_notifications, args=(tagged_usernames, ticket_id, username, new_message)).start()
            print(f"✅ Background thread started for tagging notifications (edited message)")
        else:
            print(f"ℹ️ No tagged usernames found in edited message")

        response_data = {
            "id": updated[0],
            "message": updated[1],
            "created_at": updated[2].isoformat() if updated[2] else None,
            "user_id": updated[3],
            "username": username,
            "ticket_id": ticket_id
        }
        print(f"Returning response: {response_data}")
        return jsonify(response_data), 200
    except Exception as e:
        print("Error updating message:", str(e))
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# API-prefixed aliases (useful when reverse proxy exposes backend under /api)
@app.route('/api/update_ticket_message/<int:message_id>', methods=['PUT', 'POST', 'OPTIONS'])
def api_update_ticket_message(message_id):
    return update_ticket_message(message_id)

 
@app.route('/get_ticket_attachments/<int:ticket_id>', methods=['GET', 'OPTIONS'])
def get_ticket_attachments(ticket_id):
    if request.method == 'OPTIONS':
        response = make_response()
        # Allow the frontend origins used in dev and prod
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Origin', 'https://trueday.ariths.com')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
       
        # Return the real attachment id so the frontend can delete by id
        cursor.execute("""
            SELECT a.id, a.ticket_id, a.file_name, a.file_path, a.file_type, a.file_size,
                   a.uploaded_at, u.username as uploaded_by_name
            FROM trueday.attachments a
            JOIN trueday.users u ON a.uploaded_by = u.id
            WHERE a.ticket_id = %s
            ORDER BY a.uploaded_at DESC
        """, (ticket_id,))
       
        attachments = cursor.fetchall()

        # Map rows to a dict representation handling dict-row or tuple-row
        attachment_list = []
        for att in attachments:
            try:
                if isinstance(att, dict):
                    uploaded_at = att.get('uploaded_at')
                    uploaded_at_iso = uploaded_at.isoformat() if hasattr(uploaded_at, 'isoformat') else (str(uploaded_at) if uploaded_at is not None else None)
                    attachment_list.append({
                        "id": att.get('id'),
                        "file_name": att.get('file_name'),
                        "file_path": att.get('file_path'),
                        "file_type": att.get('file_type'),
                        "file_size": att.get('file_size'),
                        "uploaded_at": uploaded_at_iso,
                        "uploaded_by": att.get('uploaded_by_name') or att.get('uploaded_by')
                    })
                else:
                    # tuple/list-like row in the same order as SELECT
                    uploaded_at = att[6] if len(att) > 6 else None
                    uploaded_at_iso = uploaded_at.isoformat() if hasattr(uploaded_at, 'isoformat') else (str(uploaded_at) if uploaded_at is not None else None)
                    attachment_list.append({
                        "id": att[0] if len(att) > 0 else None,
                        "file_name": att[2] if len(att) > 2 else None,
                        "file_path": att[3] if len(att) > 3 else None,
                        "file_type": att[4] if len(att) > 4 else None,
                        "file_size": att[5] if len(att) > 5 else None,
                        "uploaded_at": uploaded_at_iso,
                        "uploaded_by": att[7] if len(att) > 7 else None
                    })
            except Exception:
                # Skip malformed rows but continue
                continue
       
        cursor.close()
        conn.close()
       
        return jsonify(attachment_list), 200
       
    except Exception as e:
        print("Error fetching attachments:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route('/api/worklogs/<int:ticket_id>', methods=['GET', 'OPTIONS'])
def api_get_worklogs(ticket_id):
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Origin', 'https://trueday.ariths.com')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Try to select common worklog columns; if table differs, an exception will be caught
        # Try selecting from trueday.worklogs; if schema/table doesn't exist, fall back gracefully
        try:
            cursor.execute("""
                SELECT id, ticket_id, user_id, hours, notes, created_at
                FROM trueday.worklogs
                WHERE ticket_id = %s
                ORDER BY created_at DESC
            """, (ticket_id,))
            rows = cursor.fetchall()
        except Exception as e:
            # If the worklogs table doesn't exist in this deployment, return empty list
            try:
                from psycopg import errors as _pg_errors
                if isinstance(e, _pg_errors.UndefinedTable):
                    print(f"⚠️ worklogs table not found: {e}")
                    cursor.close()
                    conn.close()
                    return jsonify([]), 200
            except Exception:
                # generic fallback
                print(f"⚠️ Error querying worklogs: {e}")
                cursor.close()
                conn.close()
                return jsonify({"error": str(e)}), 500
        worklogs = []
        for r in rows:
            try:
                if isinstance(r, dict):
                    created = r.get('created_at')
                    created_iso = created.isoformat() if hasattr(created, 'isoformat') else (str(created) if created is not None else None)
                    worklogs.append({
                        'id': r.get('id'),
                        'ticket_id': r.get('ticket_id'),
                        'user_id': r.get('user_id'),
                        'hours': r.get('hours'),
                        'notes': r.get('notes'),
                        'created_at': created_iso
                    })
                else:
                    created = r[5] if len(r) > 5 else None
                    created_iso = created.isoformat() if hasattr(created, 'isoformat') else (str(created) if created is not None else None)
                    worklogs.append({
                        'id': r[0] if len(r) > 0 else None,
                        'ticket_id': r[1] if len(r) > 1 else None,
                        'user_id': r[2] if len(r) > 2 else None,
                        'hours': r[3] if len(r) > 3 else None,
                        'notes': r[4] if len(r) > 4 else None,
                        'created_at': created_iso
                    })
            except Exception:
                continue

        cursor.close()
        conn.close()
        return jsonify(worklogs), 200
    except Exception as e:
        print(f"Error fetching worklogs for ticket {ticket_id}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
 
@app.route('/delete_attachment/<int:attachment_id>', methods=['DELETE'])
def delete_attachment(attachment_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
       
        # Get attachment details before deleting
        cursor.execute("""
            SELECT ticket_id, file_name, file_path, uploaded_by
            FROM trueday.attachments
            WHERE id = %s
        """, (attachment_id,))
       
        result = cursor.fetchone()
        if not result:
            return jsonify({"error": "Attachment not found"}), 404
           
        ticket_id, file_name, file_path, uploaded_by = result
       
        # Delete from database
        cursor.execute("""
            DELETE FROM trueday.attachments
            WHERE id = %s
        """, (attachment_id,))
       
        conn.commit()
        cursor.close()
        conn.close()
       
        # Delete the file from the attachments directory
        try:
            absolute_path = os.path.join(ATTACHMENTS_FOLDER, file_path)
            os.remove(absolute_path)
        except Exception as e:
            print(f"Warning: Could not delete file {absolute_path}: {str(e)}")
        
        # Record attachment delete in history (best-effort)
        try:
            conn_h = get_db_connection(); cur_h = conn_h.cursor()
            changed_by = session.get('name') or 'Unknown User'
            cur_h.execute("""
                INSERT INTO trueday.ticket_history (
                    ticket_id, changed_by, change_type, old_value, new_value, change_details, changed_at
                ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
            """, (
                ticket_id,
                changed_by,
                'attachment_delete',
                file_name,
                None,
                json.dumps({"attachment_id": attachment_id, "file_path": file_path})
            ))
            conn_h.commit(); cur_h.close(); conn_h.close()
        except Exception as e:
            print(f"⚠️ Failed to record attachment delete history: {e}")

        return jsonify({"message": "Attachment deleted successfully"}), 200
       
    except Exception as e:
        print("Error deleting attachment:", str(e))
        return jsonify({"error": str(e)}), 500    
@app.route('/api/statuses/<status>', methods=['DELETE'])
def delete_status_by_name(status):
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Check if the status exists
        cur.execute("SELECT status_name, is_default FROM trueday.statuses WHERE status_name = %s", (status,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return jsonify({"error": f"Status '{status}' not found"}), 404

        # Prevent deleting default statuses
        if row['is_default']:
            cur.close()
            conn.close()
            return jsonify({"error": "Cannot delete a default status"}), 400

        # Move tickets under the deleted status to "DELETED"
        cur.execute("""
            UPDATE trueday.tickets
            SET status = 'DELETED', updated_at = NOW(), deleted_at = NOW()
            WHERE status = %s
        """, (status,))

        # Delete the status from the statuses table
        cur.execute("""
            DELETE FROM trueday.statuses
            WHERE status_name = %s
        """, (status,))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": f"Status '{status}' deleted successfully and associated tickets marked as deleted"}), 200

    except Exception as e:
        print("Error deleting status:", e)
        return jsonify({"error": str(e)}), 500


@app.route('/api/metrics-overview', methods=['GET'])
def get_metrics_overview():
    try:
        conn = get_db_connection()
        cur = conn.cursor()  # ✅ no cursor_factory needed

        
        # Query to get all metrics in one go
        query = """
            SELECT 
                COUNT(*) as total_tasks,
                COUNT(*) FILTER (WHERE status = 'Resolved') as completed_tasks,
                COUNT(*) FILTER (WHERE status = 'In Progress') as pending_tasks,
                COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status != 'Resolved') as overdue_tasks
            FROM trueday.tickets;
        """
        
        cur.execute(query)
        metrics = cur.fetchone()
        
        # Convert numeric values to integers
        result = {
            'totalTasks': int(metrics['total_tasks']),
            'completedTasks': int(metrics['completed_tasks']),
            'pendingTasks': int(metrics['pending_tasks']),
            'overdueTasks': int(metrics['overdue_tasks'])
        }
        
        cur.close()
        conn.close()
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error fetching metrics overview: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ticket-stats', methods=['GET'])
def get_ticket_stats():
    try:
        conn = get_db_connection()
        cur = conn.cursor()  # ✅ no cursor_factory needed

        
        # Query to get all stats in one go
        query = """
            SELECT 
                COUNT(*) as total_tickets,
                COUNT(*) FILTER (WHERE status = 'Resolved') as completed_tickets,
                COUNT(*) FILTER (WHERE priority = 'High') as urgent_tickets
            FROM trueday.tickets;
        """
        
        cur.execute(query)
        stats = cur.fetchone()
        
        # Convert numeric values to integers
        result = {
            'total': int(stats['total_tickets']),
            'completed': int(stats['completed_tickets']),
            'urgent': int(stats['urgent_tickets'])
        }
        
        cur.close()
        conn.close()
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error fetching ticket stats: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
    
    
    

@app.route('/api/add-tag-constraint', methods=['POST'])
def add_tag_constraint():
    try:
        data = request.get_json()
        allowed_tags = data.get("tags")
        
        if not allowed_tags or not isinstance(allowed_tags, list):
            return jsonify({"error": "Tags must be provided as a list"}), 400
            
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Create a constraint on the tag column
        cur.execute("""
            ALTER TABLE tickets
            ADD CONSTRAINT valid_tags
            CHECK (tag IN %s)
        """, (tuple(allowed_tags),))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({"message": "Tag constraint added successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route('/api/status', methods=['GET', 'OPTIONS'])
def get_statuses():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Simple query to fetch statuses
        cur.execute("""
            SELECT status_id, status_name, is_default, is_active, display_order
            FROM trueday.statuses
            ORDER BY display_order;
        """)

        rows = cur.fetchall()
        cur.close()
        conn.close()

        # Convert rows to JSON - support both tuple rows and dict-like rows
        statuses = []
        for row in rows:
            try:
                if isinstance(row, dict):
                    statuses.append({
                        'status_id': row.get('status_id') or row.get('status_id'),
                        'name': row.get('status_name') or row.get('name'),
                        'is_default': row.get('is_default'),
                        'is_active': row.get('is_active'),
                        'display_order': row.get('display_order')
                    })
                else:
                    # tuple-like row
                    statuses.append({
                        'status_id': row[0],
                        'name': row[1],
                        'is_default': row[2],
                        'is_active': row[3],
                        'display_order': row[4]
                    })
            except Exception as conv_err:
                # Log conversion error but continue processing remaining rows
                print(f"Warning: failed to convert status row {row}: {conv_err}")

        return jsonify(statuses)

    except Exception as e:
        print("Error fetching statuses:", e)
        return jsonify({'error': str(e)}), 500


@app.route('/api/statuses/add', methods=['POST', 'OPTIONS'])
def add_status():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    try:
        data = request.get_json()
        status_name = data.get('status')

        if not status_name:
            return jsonify({"error": "Status name is required"}), 400

        # Convert status to UPPERCASE
        status_name = status_name.strip().upper()

        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Check if status already exists
        cursor.execute(
            "SELECT status_name FROM trueday.statuses WHERE status_name = %s",
            (status_name,)
        )
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({"error": "Status already exists"}), 400

        # Get the next display_order
        cursor.execute("SELECT COALESCE(MAX(display_order), 0) AS max_order FROM trueday.statuses")
        next_order = cursor.fetchone()['max_order'] + 1

        # Insert the new status
        cursor.execute("""
            INSERT INTO trueday.statuses (status_name, is_default, is_active, display_order)
            VALUES (%s, FALSE, TRUE, %s)
            RETURNING status_name, is_default, is_active, display_order;
        """, (status_name, next_order))

        new_status = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({
            "message": "Status added successfully",
            "status": new_status
        }), 201

    except Exception as e:
        print(f"Error adding status: {e}")  # server-side logging
        return jsonify({"error": str(e)}), 500
@app.route('/api/statuses/delete', methods=['DELETE', 'OPTIONS'])
def delete_status():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'DELETE,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    try:
        data = request.get_json()
        status_name = data.get('status')

        if not status_name:
            return jsonify({"error": "Status name is required"}), 400

        # Convert status to UPPERCASE
        status_name = status_name.strip().upper()

        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if status exists and is not a default status
        cursor.execute("""
            SELECT status_name FROM trueday.statuses 
            WHERE status_name = %s AND is_default = FALSE;
        """, (status_name,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({"error": "Status not found or cannot be deleted"}), 404

        # Move tickets under the deleted status to 'DELETED', update timestamps
        cursor.execute("""
            UPDATE trueday.tickets
            SET status = 'DELETED', updated_at = NOW(), deleted_at = NOW()
            WHERE status = %s;
        """, (status_name,))

        # Delete the status
        cursor.execute("""
            DELETE FROM trueday.statuses
            WHERE status_name = %s AND is_default = FALSE;
        """, (status_name,))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({
            "message": "Status deleted successfully and associated tickets marked as deleted",
            "status": status_name
        }), 200

    except Exception as e:
        # Ensure cursor/connection are closed if an exception occurs
        try:
            cursor.close()
            conn.close()
        except:
            pass
        print(f"Error deleting status: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/tickets/<int:ticket_id>/restore', methods=['PUT', 'OPTIONS'])
def restore_ticket(ticket_id):
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'PUT,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    try:
        # Always restore to 'NEW' status (UPPERCASE)
        restore_status = 'NEW'
        
        # Get current user information
        current_username = session.get('name', 'Unknown User')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get the current status before updating
        cursor.execute("SELECT status FROM trueday.tickets WHERE ticket_id = %s", (ticket_id,))
        current_ticket = cursor.fetchone()
        if not current_ticket:
            return jsonify({"error": "Ticket not found"}), 404
        
        old_status = current_ticket[0]
        
        cursor.execute("""
            UPDATE trueday.tickets
            SET status = %s, updated_at = NOW(), deleted_at = NULL
            WHERE ticket_id = %s
            RETURNING ticket_id, title, status, updated_at, deleted_at;
        """, (restore_status, ticket_id))
        result = cursor.fetchone()
        if not result:
            return jsonify({"error": "Ticket not found"}), 404
            
        # Record the status change in history
        if old_status != restore_status:
            cursor.execute("""
                INSERT INTO trueday.ticket_history (
                    ticket_id, changed_by, change_type, old_value, new_value, changed_at
                ) VALUES (%s, %s, %s, %s, %s, NOW())
            """, (ticket_id, current_username, 'status', old_status, restore_status))
        
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({
            "message": "Ticket restored successfully",
            "ticket": {
                "id": result[0],
                "title": result[1],
                "status": result[2],
                "updated_at": result[3].isoformat() if result[3] else None,
                "deleted_at": result[4].isoformat() if result[4] else None
            }
        }), 200
    except Exception as e:
        print(f"Error restoring ticket: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/tickets/<int:ticket_id>/status', methods=['PUT', 'OPTIONS'])
def update_ticket_status(ticket_id):
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'PUT,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    try:
        data = request.get_json()
        new_status = data.get('status')
        
        if not new_status:
            return jsonify({"error": "Status is required"}), 400

        # Convert status to UPPERCASE
        new_status = new_status.upper()

        # Get current user information from request body or session
        current_user_id = data.get('user_id') or session.get('user_id')
        current_username = data.get('username') or session.get('name', 'Unknown User')
        
        # Debug logging
        print(f"DEBUG: Status update for ticket {ticket_id} by user {current_username}")
        print(f"DEBUG: User info from request: user_id={data.get('user_id')}, username={data.get('username')}")
        print(f"DEBUG: User info from session: user_id={session.get('user_id')}, name={session.get('name')}")

        conn = get_db_connection()
        cursor = conn.cursor()

        # Get the current status and ticket details before updating
        cursor.execute("SELECT status, approver_id, assignee_id, creator_id, title, collaborator_id FROM trueday.tickets WHERE ticket_id = %s", (ticket_id,))
        current_ticket = cursor.fetchone()
        if not current_ticket:
            return jsonify({"error": "Ticket not found"}), 404

        # Support both dict-row (dict-like) and tuple/list rows
        if isinstance(current_ticket, dict):
            old_status = current_ticket.get('status')
            ticket_approver_id = current_ticket.get('approver_id')
            ticket_assignee_id = current_ticket.get('assignee_id')
            ticket_creator_id = current_ticket.get('creator_id')
            ticket_title = current_ticket.get('title')
            ticket_collaborator_id = current_ticket.get('collaborator_id')
        else:
            old_status = current_ticket[0]
            ticket_approver_id = current_ticket[1]
            ticket_assignee_id = current_ticket[2]
            ticket_creator_id = current_ticket[3]
            ticket_title = current_ticket[4]
            ticket_collaborator_id = current_ticket[5] if len(current_ticket) > 5 else None

        # Get user role
        user_role = 'user'
        if current_user_id:
            cursor.execute("SELECT role FROM trueday.users WHERE id = %s", (current_user_id,))
            user_row = cursor.fetchone()
            if user_row:
                user_role = str(user_row.get('role') if isinstance(user_row, dict) else user_row[0]).lower()

        is_admin = user_role in ['admin', 'superadmin', 'superuser']
        current_uid_str = str(current_user_id) if current_user_id else None

        # Check general move permissions
        is_authorized = False
        if is_admin:
            is_authorized = True
        elif current_uid_str and current_uid_str == str(ticket_assignee_id):
            is_authorized = True
        elif current_uid_str and current_uid_str == str(ticket_creator_id):
            is_authorized = True
        elif current_uid_str and current_uid_str == str(ticket_approver_id):
            is_authorized = True

        if not is_authorized:
            return jsonify({"error": "Only the assignee, creator, approver, or an admin can move this ticket."}), 403

        # Validate approver permissions for COMPLETED status
        if new_status == 'COMPLETED' and ticket_approver_id:
            # If there is an approver assigned, only that approver can complete the ticket
            if not current_uid_str or (current_uid_str != str(ticket_approver_id) and not is_admin):
                return jsonify({"error": f"Only the assigned approver can mark this ticket as completed"}), 403

        # Update the ticket status and set deleted_at if status is DELETED
        if new_status == 'DELETED':
            cursor.execute("""
                UPDATE trueday.tickets 
                SET status = %s, deleted_at = NOW()
                WHERE ticket_id = %s 
                RETURNING ticket_id, title, description, priority, status, assignee_id, due_date, deleted_at
            """, (new_status, ticket_id))
        else:
            cursor.execute("""
                UPDATE trueday.tickets 
                SET status = %s, deleted_at = NULL
                WHERE ticket_id = %s 
                RETURNING ticket_id, title, description, priority, status, assignee_id, due_date, deleted_at
            """, (new_status, ticket_id))

        updated_ticket = cursor.fetchone()
        if not updated_ticket:
            return jsonify({"error": "Ticket not found"}), 404

        # Record the status change in history
        if old_status != new_status:
            print(f"DEBUG: Recording status change - Old: {old_status}, New: {new_status}, User: {current_username}")
            try:
                cursor.execute("""
                    INSERT INTO trueday.ticket_history (
                        ticket_id, changed_by, change_type, old_value, new_value, changed_at
                    ) VALUES (%s, %s, %s, %s, %s, NOW())
                """, (ticket_id, current_username, 'status', old_status, new_status))
                print(f"DEBUG: History record inserted successfully")

                # Trigger status change notifications
                msg = f'{current_username} moved ticket \'{ticket_title}\' from {old_status} to {new_status}'
                notified_ids_2 = {str(current_user_id)}
                print(f"DEBUG NOTIF: assignee={ticket_assignee_id}, creator={ticket_creator_id}, approver={ticket_approver_id}, collaborator={ticket_collaborator_id}, current_user={current_user_id}")

                # Notify assignee
                if ticket_assignee_id and str(ticket_assignee_id) not in notified_ids_2:
                    create_notification(
                        cursor,
                        ticket_assignee_id,
                        "Ticket Moved",
                        msg,
                        "status_change",
                        ticket_id
                    )
                    notified_ids_2.add(str(ticket_assignee_id))
                # Notify creator
                if ticket_creator_id and str(ticket_creator_id) not in notified_ids_2:
                    create_notification(
                        cursor,
                        ticket_creator_id,
                        "Ticket Moved",
                        msg,
                        "status_change",
                        ticket_id
                    )
                    notified_ids_2.add(str(ticket_creator_id))
                # Notify approver
                if ticket_approver_id and str(ticket_approver_id) not in notified_ids_2:
                    create_notification(
                        cursor,
                        ticket_approver_id,
                        "Ticket Moved",
                        msg,
                        "status_change",
                        ticket_id
                    )
                    notified_ids_2.add(str(ticket_approver_id))
                # Notify collaborator
                if ticket_collaborator_id and str(ticket_collaborator_id) not in notified_ids_2:
                    create_notification(
                        cursor,
                        ticket_collaborator_id,
                        "Ticket Moved",
                        msg,
                        "status_change",
                        ticket_id
                    )
                    notified_ids_2.add(str(ticket_collaborator_id))
            except Exception as e:
                print(f"DEBUG: Error inserting history record: {e}")
                conn.rollback()
                cursor.close()
                conn.close()
                return jsonify({"error": f"Failed to record history: {str(e)}"}), 500
        else:
            print(f"DEBUG: No status change detected - Old: {old_status}, New: {new_status}")

        conn.commit()
        cursor.close()
        conn.close()

        # Build response tolerant to dict-row or tuple-row
        if isinstance(updated_ticket, dict):
            due_val = updated_ticket.get('due_date')
            deleted_val = updated_ticket.get('deleted_at')
            resp_payload = {
                "id": updated_ticket.get('ticket_id') or updated_ticket.get('id'),
                "title": updated_ticket.get('title'),
                "description": updated_ticket.get('description'),
                "priority": updated_ticket.get('priority'),
                "status": updated_ticket.get('status'),
                "assignee_id": updated_ticket.get('assignee_id'),
                "due_date": due_val.isoformat() if hasattr(due_val, 'isoformat') else (str(due_val) if due_val else None),
                "deleted_at": deleted_val.isoformat() if hasattr(deleted_val, 'isoformat') else (str(deleted_val) if deleted_val else None)
            }
        else:
            resp_payload = {
                "id": updated_ticket[0],
                "title": updated_ticket[1],
                "description": updated_ticket[2],
                "priority": updated_ticket[3],
                "status": updated_ticket[4],
                "assignee_id": updated_ticket[5],
                "due_date": updated_ticket[6].isoformat() if updated_ticket[6] else None,
                "deleted_at": updated_ticket[7].isoformat() if updated_ticket[7] else None
            }
        response = jsonify(resp_payload)
        
        # Add CORS headers to the response
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200

    except Exception as e:
        print(f"Error updating ticket status: {str(e)}")
        response = jsonify({"error": str(e)})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 500

@app.route('/api/attachments/<int:ticket_id>', methods=['GET'])
def list_attachments(ticket_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, ticket_id, file_name, file_path, file_type, file_size, uploaded_by, uploaded_at
            FROM attachments WHERE ticket_id = %s
            ORDER BY uploaded_at DESC
        """, (ticket_id,))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        attachments = [
            {
                'id': row[0],
                'ticket_id': row[1],
                'file_name': row[2],
                'file_path': row[3],
                'file_type': row[4],
                'file_size': row[5],
                'uploaded_by': row[6],
                'uploaded_at': row[7].isoformat() if row[7] else None
            }
            for row in rows
        ]
        return jsonify(attachments)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/attachments/<filename>', methods=['GET'])
def serve_attachment(filename):
    try:
        return send_from_directory(ATTACHMENTS_FOLDER, filename)
    except Exception as e:
        return jsonify({'error': str(e)}), 404

@app.route('/api/ticket-history/<int:ticket_id>', methods=['GET', 'POST'])
def ticket_history(ticket_id):
    if request.method == 'GET':
        try:
            print(f"DEBUG: Fetching history for ticket {ticket_id}")
            conn = get_db_connection()
            cursor = conn.cursor()
            # Join with users to map numeric changed_by to username when possible
            cursor.execute("""
                SELECT th.id, th.ticket_id,
                       COALESCE(u.username, th.changed_by::text) AS changed_by,
                       th.change_type, th.old_value, th.new_value, th.change_details, th.changed_at
                FROM trueday.ticket_history th
                LEFT JOIN trueday.users u
                  ON (CASE WHEN th.changed_by ~ '^[0-9]+$' THEN th.changed_by::int ELSE NULL END) = u.id
                WHERE th.ticket_id = %s
                ORDER BY th.changed_at DESC
            """, (ticket_id,))
            rows = cursor.fetchall()
            print(f"DEBUG: Found {len(rows)} history records for ticket {ticket_id}")
            for i, row in enumerate(rows):
                print(f"DEBUG: History {i+1}: {row}")
            cursor.close()
            conn.close()

            # Build history list tolerant to dict-row (dict_row) and tuple/list rows
            history = []
            for row in rows:
                try:
                    if isinstance(row, dict):
                        changed_at_value = row.get('changed_at')
                        changed_by_val = row.get('changed_by')
                        change_type = row.get('change_type')
                        old_value = row.get('old_value')
                        new_value = row.get('new_value')
                        details_val = row.get('change_details')
                        rec_id = row.get('id')
                        rec_ticket = row.get('ticket_id')
                    else:
                        # tuple/list-like
                        rec_id = row[0] if len(row) > 0 else None
                        rec_ticket = row[1] if len(row) > 1 else None
                        changed_by_val = row[2] if len(row) > 2 else None
                        change_type = row[3] if len(row) > 3 else None
                        old_value = row[4] if len(row) > 4 else None
                        new_value = row[5] if len(row) > 5 else None
                        details_val = row[6] if len(row) > 6 else None
                        changed_at_value = row[7] if len(row) > 7 else None

                    # Safely serialize changed_at regardless of type
                    try:
                        if hasattr(changed_at_value, 'isoformat'):
                            changed_at_str = changed_at_value.isoformat()
                        elif changed_at_value is None:
                            changed_at_str = None
                        else:
                            changed_at_str = str(changed_at_value)
                    except Exception:
                        changed_at_str = None

                    history.append({
                        'id': rec_id,
                        'ticket_id': rec_ticket,
                        'changed_by': str(changed_by_val) if changed_by_val is not None else 'Unknown User',
                        'change_type': change_type or 'update',
                        'old_value': old_value,
                        'new_value': new_value,
                        'change_details': details_val if details_val is None or isinstance(details_val, str) else str(details_val),
                        'changed_at': changed_at_str
                    })
                except Exception as e:
                    print(f"⚠️ Skipping history row due to parsing error: {e}")
                    continue

            print(f"DEBUG: Returning history: {history}")
            return jsonify(history)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'POST':
        try:
            data = request.get_json(silent=True) or {}
            # Normalize/sanitize inputs to avoid DB errors
            changed_by = data.get('changed_by')
            if changed_by is None or str(changed_by).strip() == '':
                changed_by = 'Unknown User'
            else:
                changed_by = str(changed_by)

            change_type = data.get('change_type') or 'update'
            old_value = data.get('old_value')
            new_value = data.get('new_value')
            # Ensure values are strings or None
            old_value = None if old_value is None else str(old_value)
            new_value = None if new_value is None else str(new_value)

            # Ensure change_details is valid JSON or NULL
            details = data.get('change_details')
            if details is None:
                details_json = None
            elif isinstance(details, str):
                try:
                    json.loads(details)  # verify it's valid JSON
                    details_json = details
                except Exception:
                    details_json = json.dumps({'details': details})
            else:
                # dict/list/primitive -> JSON string
                details_json = json.dumps(details)

            conn = get_db_connection()
            cursor = conn.cursor()

            # Insert the history record
            cursor.execute("""
                INSERT INTO trueday.ticket_history (
                    ticket_id, changed_by, change_type, old_value, new_value, change_details, changed_at
                ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
                RETURNING id, changed_at
            """, (
                ticket_id,
                changed_by,
                change_type,
                old_value,
                new_value,
                details_json
            ))

            history_id, changed_at = cursor.fetchone()
            conn.commit()
            cursor.close()
            conn.close()

            return jsonify({
                'id': history_id,
                'ticket_id': ticket_id,
                'changed_by': changed_by,
                'change_type': change_type,
                'old_value': old_value,
                'new_value': new_value,
                'change_details': details_json,
                'changed_at': changed_at.isoformat() if changed_at else None
            }), 201
        except Exception as e:
            return jsonify({'error': str(e)}), 500

def create_tables():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Create schema if it doesn't exist
        cursor.execute('CREATE SCHEMA IF NOT EXISTS trueday;')
        
        # Create users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS trueday.users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'User',
                first_name VARCHAR(255),
                last_name VARCHAR(255),
                phone VARCHAR(50),
                location VARCHAR(255),
                department VARCHAR(255),
                join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        
        # Create project table if not exists
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS trueday.project (
                project_id SERIAL PRIMARY KEY,
                project_name VARCHAR(255) NOT NULL UNIQUE,
                color VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        
        # Create labels table if not exists
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS trueday.labels (
                label_id SERIAL PRIMARY KEY,
                label_name VARCHAR(255) NOT NULL,
                color VARCHAR(50),
                project_id INTEGER REFERENCES trueday.project(project_id) ON DELETE CASCADE
            );
        ''')
        
        # Create statuses table if not exists
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS trueday.statuses (
                status_id SERIAL PRIMARY KEY,
                status_name VARCHAR(50) NOT NULL UNIQUE,
                is_default BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                display_order INTEGER DEFAULT 0
            );
        ''')
        
        # Seed default statuses if table is empty
        cursor.execute("SELECT COUNT(*) FROM trueday.statuses;")
        _row_cnt = cursor.fetchone()
        _cnt = _row_cnt['count'] if isinstance(_row_cnt, dict) else _row_cnt[0]
        if _cnt == 0:
            cursor.execute('''
                INSERT INTO trueday.statuses (status_name, is_default, is_active, display_order)
                VALUES 
                    ('NEW', TRUE, TRUE, 1),
                    ('IN PROGRESS', FALSE, TRUE, 2),
                    ('BLOCKED', FALSE, TRUE, 3),
                    ('QA', FALSE, TRUE, 4),
                    ('COMPLETED', FALSE, TRUE, 5);
            ''')
        
        # Create tickets table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS trueday.tickets (
                ticket_id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                priority VARCHAR(50),
                assignee_id INTEGER REFERENCES trueday.users(id),
                creator_id INTEGER REFERENCES trueday.users(id),
                approver_id INTEGER REFERENCES trueday.users(id),
                collaborator_id INTEGER REFERENCES trueday.users(id),
                due_date DATE,
                status VARCHAR(50),
                tag VARCHAR(50),
                project_id INTEGER REFERENCES trueday.project(project_id),
                label_id INTEGER REFERENCES trueday.labels(label_id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP
            );
        ''')
        
        # Create ticket_history table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS trueday.ticket_history (
                id SERIAL PRIMARY KEY,
                ticket_id INTEGER REFERENCES trueday.tickets(ticket_id),
                changed_by VARCHAR(255) NOT NULL,
                change_type VARCHAR(50) NOT NULL,
                old_value TEXT,
                new_value TEXT,
                change_details JSONB,
                changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        
        # Create project_users table for user-project assignments
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS trueday.project_users (
                project_users_id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES trueday.users(id) ON DELETE CASCADE,
                project_id INTEGER NOT NULL REFERENCES trueday.project(project_id) ON DELETE CASCADE,
                role VARCHAR(50) DEFAULT 'User',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, project_id)
            );
        ''')
        
        # Create messages table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS trueday.messages (
                id SERIAL PRIMARY KEY,
                ticket_id INTEGER REFERENCES trueday.tickets(ticket_id),
                user_id INTEGER REFERENCES trueday.users(id),
                message_text TEXT,
                parent_id INTEGER REFERENCES trueday.messages(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        
        # Create updated_tickets_data table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS trueday.updated_tickets_data (
                id SERIAL PRIMARY KEY,
                ticket_id INTEGER UNIQUE NOT NULL REFERENCES trueday.tickets(ticket_id) ON DELETE CASCADE,
                title VARCHAR(255),
                start_date TIMESTAMP WITH TIME ZONE,
                end_date TIMESTAMP WITH TIME ZONE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        
        # Create ticket_pulse_details table (stores draft or active input details for progress pulse)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS trueday.ticket_pulse_details (
                ticket_id INTEGER PRIMARY KEY REFERENCES trueday.tickets(ticket_id) ON DELETE CASCADE,
                what_did_you_do TEXT,
                challenge TEXT,
                what_you_learned TEXT,
                similar_tickets TEXT,
                comments TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')

        # Create progresspulse table (stores submitted progress log history entries)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS trueday.progresspulse (
                id SERIAL PRIMARY KEY,
                ticket_id INTEGER REFERENCES trueday.tickets(ticket_id) ON DELETE CASCADE,
                work_done TEXT,
                challenge TEXT,
                learning TEXT,
                review_comment TEXT,
                created_by VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        
        conn.commit()
    except Exception as e:
        print(f"Error creating tables: {str(e)}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

def update_database_schema():
    """Update existing database schema with new columns"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Add parent_id column to messages table if it doesn't exist
        cursor.execute("""
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'trueday' 
                    AND table_name = 'messages' 
                    AND column_name = 'parent_id'
                ) THEN
                    ALTER TABLE trueday.messages ADD COLUMN parent_id INTEGER REFERENCES trueday.messages(id);
                END IF;
            END $$;
        """)
        
        conn.commit()
        print("[SUCCESS] Database schema updated successfully")
        
    except Exception as e:
        print(f"[ERROR] Error updating database schema: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Add missing columns to tickets table if they don't exist
        columns_to_add = [
            ('creator_id', 'INTEGER REFERENCES trueday.users(id)'),
            ('approver_id', 'INTEGER REFERENCES trueday.users(id)'),
            ('collaborator_id', 'INTEGER REFERENCES trueday.users(id)'),
            ('project_id', 'INTEGER REFERENCES trueday.project(project_id)'),
            ('label_id', 'INTEGER'),
            ('updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'),
            ('deleted_at', 'TIMESTAMP')
        ]
        
        for column_name, column_def in columns_to_add:
            try:
                cursor.execute(f'ALTER TABLE trueday.tickets ADD COLUMN IF NOT EXISTS {column_name} {column_def}')
                print(f"Added column {column_name} to tickets table")
            except Exception as e:
                print(f"Column {column_name} might already exist: {e}")

        # Add missing columns to users table if they don't exist
        users_columns = [
            ('role', "VARCHAR(50) DEFAULT 'User'"),
            ('first_name', 'VARCHAR(255)'),
            ('last_name', 'VARCHAR(255)'),
            ('phone', 'VARCHAR(50)'),
            ('location', 'VARCHAR(255)'),
            ('department', 'VARCHAR(255)'),
            ('join_date', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
        ]
        for column_name, column_def in users_columns:
            try:
                cursor.execute(f'ALTER TABLE trueday.users ADD COLUMN IF NOT EXISTS {column_name} {column_def}')
                print(f"Added column {column_name} to users table")
            except Exception as e:
                print(f"Column {column_name} might already exist in users: {e}")

        # Add missing columns to progresspulse table
        try:
            cursor.execute('ALTER TABLE trueday.progresspulse ADD COLUMN IF NOT EXISTS review_comment TEXT')
            print("Added column review_comment to progresspulse table")
        except Exception as e:
            print(f"Column review_comment might already exist in progresspulse: {e}")
        
        conn.commit()
        cursor.close()
        conn.close()
        print("Database schema updated successfully")
        
    except Exception as e:
        print(f"Error updating database schema: {str(e)}")

# Call create_tables() when the application starts
create_tables()
# Update existing schema
update_database_schema()

# @app.route('/', defaults={'path': ''})
# @app.route('/<path:path>')
# def serve(path):
#     if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
#         return send_from_directory(app.static_folder, path)
#     else:
#         return send_from_directory(app.static_folder, 'index.html')

from flask import Flask, request, redirect, send_from_directory, render_template
import os
import jwt


SECRET_KEY = "Maitreya@010125"  # use same key used to sign JWT

@app.route("/message")
def message_page():
    return 'Session timeout! Login through <a href="https://ariths.com">ariths.com</a>'

@app.route('/validate-token', methods=['GET', 'OPTIONS'])
def validate_token_endpoint():
    """Endpoint to validate secure tokens"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    
    try:
        token = request.args.get('token')
        if not token:
            return jsonify({"error": "Token required"}), 400
        
        # Validate the secure token
        token_data = validate_secure_token(token)
        if not token_data:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        return jsonify({
            "valid": True,
            "user_id": token_data['user_id'],
            "access_type": token_data['access_type']
        }), 200
        
    except Exception as e:
        logger.error(f"Error validating token: {e}")
        return jsonify({"error": "Token validation failed"}), 500

@app.route('/api/auth/generate-jwt', methods=['POST', 'OPTIONS'])
def generate_jwt_endpoint():
    """Endpoint for main domain to generate JWT tokens"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        username = data.get('username')
        email = data.get('email')
        
        if not all([user_id, username]):
            return jsonify({"error": "user_id and username are required"}), 400
        
        # Generate JWT token
        token = generate_jwt_token(user_id, username, email)
        if not token:
            return jsonify({"error": "Failed to generate token"}), 500
        
        return jsonify({
            "token": token,
            "expires_in": 86400,  # 24 hours in seconds
            "user_id": user_id,
            "username": username
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating JWT: {e}")
        return jsonify({"error": "Token generation failed"}), 500

@app.route('/api/auth/validate-jwt', methods=['POST', 'OPTIONS'])
def validate_jwt_endpoint():
    """Endpoint to validate JWT tokens"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    
    try:
        data = request.get_json()
        token = data.get('token')
        
        if not token:
            return jsonify({"error": "Token required"}), 400
        
        # Decode JWT token to get full payload
        try:
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            except jwt.InvalidTokenError:
                logger.warning("JWT signature verification failed, falling back to decoding without verification in dev/SSO mode")
                payload = jwt.decode(token, options={"verify_signature": False})
                
            user_id = payload.get('user_id') or payload.get('sub') or payload.get('id')
            if not user_id:
                return jsonify({"error": "Invalid token: missing user identifier"}), 401
                
            # Combine first_name and last_name if present
            first_name = payload.get('first_name') or payload.get('given_name') or ''
            last_name = payload.get('last_name') or payload.get('family_name') or ''
            full_name_constructed = f"{first_name} {last_name}".strip()
            
            username = (full_name_constructed or 
                        payload.get('username') or payload.get('name') or 
                        payload.get('full_name') or payload.get('nickname') or 
                        payload.get('display_name') or payload.get('user_name') or 
                        f"User_{user_id}")
            email = payload.get('email') or payload.get('user_email') or f"user_{user_id}@example.com"
        except Exception as e:
            return jsonify({"error": f"Invalid token: {str(e)}"}), 401
        
        # Get user details from database and sync if missing
        conn = get_db_connection()
        cur = conn.cursor()

        # Sync user role from ariths_accesses foreign table
        try:
            cur.execute("""
                UPDATE trueday.users u
                SET role = a.access_type
                FROM trueday.ariths_accesses a
                WHERE u.id = %s AND a.user_id = %s AND a.tool_id = 2 AND u.role IS DISTINCT FROM a.access_type;
            """, (user_id, user_id))
            conn.commit()
        except Exception as sync_err:
            logger.warning(f"Failed to sync user role via FDW: {sync_err}")

        cur.execute("SELECT id, username, email, role FROM trueday.users WHERE id = %s", (user_id,))
        user_data = cur.fetchone()
        
        # Fallback: Find user by email to prevent duplicate accounts when SSO IDs don't match legacy IDs
        if not user_data and email:
            cur.execute("SELECT id, username, email, role FROM trueday.users WHERE email = %s", (email,))
            user_data = cur.fetchone()
            if user_data:
                logger.info(f"Found legacy user by email {email}. Using legacy ID instead of SSO ID {user_id}.")
        
        if not user_data:
            logger.info(f"Syncing new user from JWT: {username} ({user_id})")
            # Create user in trueday database using the ID from the token
            # Try to get default role from foreign table first
            default_role = "User"
            try:
                cur.execute("SELECT access_type FROM trueday.ariths_accesses WHERE user_id = %s AND tool_id = 2;", (user_id,))
                row = cur.fetchone()
                if row:
                    default_role = row.get('access_type') if isinstance(row, dict) else row[0]
            except Exception:
                pass

            cur.execute("""
                INSERT INTO trueday.users (id, username, email, password, role)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET 
                    username = EXCLUDED.username,
                    email = EXCLUDED.email
                RETURNING id, username, email, role;
            """, (user_id, username, email, "sso_managed", default_role))
            user_data = cur.fetchone()
            conn.commit()
        
        # Handle dict or tuple user_data
        uid = user_data.get('id') if isinstance(user_data, dict) else user_data[0]
        uname = user_data.get('username') if isinstance(user_data, dict) else user_data[1]
        uemail = user_data.get('email') if isinstance(user_data, dict) else user_data[2]
        urole = user_data.get('role') if isinstance(user_data, dict) else user_data[3]

        # Fetch assigned projects
        assigned_projects = []
        try:
            cur.execute("SELECT project_id FROM trueday.project_users WHERE user_id = %s", (uid,))
            rows = cur.fetchall()
            for r in rows:
                p_id = r.get('project_id') if isinstance(r, dict) else r[0]
                assigned_projects.append(p_id)
        except Exception as e:
            logger.warning(f"Error fetching assigned projects for synced user {uid}: {e}")

        cur.close()
        conn.close()
        
        # Set session cookie for /api/projects and other protected routes
        session.permanent = True
        session['user_id'] = uid
        session['email'] = uemail
        session['name'] = uname
        session['role'] = urole
        
        return jsonify({
            "valid": True,
            "user_id": uid,
            "username": uname,
            "email": uemail,
            "role": urole,
            "assigned_projects": assigned_projects
        }), 200
        
    except Exception as e:
        logger.error(f"Error validating JWT: {e}")
        return jsonify({"error": "Token validation failed"}), 500
 


def is_local_request():
    try:
        host = request.headers.get('Host', '').lower()
        if ':' in host:
            host = host.split(':')[0]
        
        # Check standard local hostnames/IPs
        if host in ('localhost', '127.0.0.1', '::1') or request.remote_addr in ('127.0.0.1', '::1'):
            return True
            
        # Check private IP ranges
        if host.startswith('192.168.') or host.startswith('10.') or host.startswith('172.'):
            return True
        if request.remote_addr and (
            request.remote_addr.startswith('192.168.') or 
            request.remote_addr.startswith('10.') or 
            request.remote_addr.startswith('172.')
        ):
            return True
    except Exception as e:
        logger.error(f"Error checking if request is local: {e}")
    return False

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    # 🔒 Block access if no cookie is present, but exempt local dev requests
    if not is_local_request() and not request.cookies.get("jwt"):
        # return redirect("https://ariths.com/login_through_ariths_account_to_access_trueday")
        return redirect("/message")   # redirects to message.html


    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/company-performance-line', methods=['GET'])
def get_company_performance_line():
    try:
        employee_id = request.args.get('employee')
        priority = request.args.get('priority')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        year = request.args.get('year')
        month = request.args.get('month')

        conn = get_db_connection()
        cur = conn.cursor()  # ✅ no cursor_factory needed


        # Get all statuses from the statuses table
        cur.execute("SELECT status_name FROM trueday.statuses WHERE is_active = TRUE ORDER BY display_order")
        status_rows = cur.fetchall()
        statuses = [row['status_name'] for row in status_rows]

        # Build base query for monthly ticket counts by status
        query = """
            SELECT 
                TO_CHAR(DATE_TRUNC('month', t.created_at), 'YYYY-MM') AS month,
                t.status,
                COUNT(*) AS count
            FROM trueday.tickets t
            WHERE 1=1
        """
        params = []
        if employee_id and employee_id != 'all':
            query += " AND t.assignee_id = %s"
            params.append(employee_id)
        if priority and priority != 'all':
            query += " AND t.priority = %s"
            params.append(priority.capitalize())
        if start_date:
            query += " AND t.created_at >= %s"
            params.append(start_date)
        if end_date:
            query += " AND t.created_at <= %s"
            params.append(end_date)
        if year and month:
            query += " AND EXTRACT(YEAR FROM t.created_at) = %s AND EXTRACT(MONTH FROM t.created_at) = %s"
            params.append(int(year))
            params.append(int(month))

        p_ids = get_project_ids_list()
        if p_ids:
            query += " AND t.project_id = ANY(%s)"
            params.append(p_ids)

        query += " GROUP BY month, t.status ORDER BY month, t.status"
        cur.execute(query, params)
        results = cur.fetchall()

        # Organize data for each status
        month_set = sorted(set(row['month'] for row in results))
        data_by_status = {status: [0]*len(month_set) for status in statuses}
        month_index = {m: i for i, m in enumerate(month_set)}
        for row in results:
            status = row['status']
            if status in data_by_status:
                idx = month_index[row['month']]
                data_by_status[status][idx] = row['count']
        datasets = [
            {
                'label': status,
                'data': data_by_status[status],
                'borderColor': f'rgba({(i*50)%255}, {(i*80)%255}, {(i*120)%255}, 1)',
                'backgroundColor': f'rgba({(i*50)%255}, {(i*80)%255}, {(i*120)%255}, 0.2)',
                'tension': 0.4
            }
            for i, status in enumerate(statuses)
        ]
        chart_data = {
            'labels': month_set,
            'datasets': datasets
        }
        cur.close()
        conn.close()
        return jsonify(chart_data)
    except Exception as e:
        print(f"Error in get_company_performance_line: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/projects', methods=['GET'])
def get_projects():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT project_id, project_name FROM trueday.project ORDER BY project_name')
    projects = cursor.fetchall()
    cursor.close()
    conn.close()
    
    # projects is likely a list of dicts, so access keys
    return jsonify([{'id': p['project_id'], 'name': p['project_name']} for p in projects])


@app.route('/api/answers', methods=['POST'])
def submit_answers():
    try:
        data = request.get_json()
        ticket_id = data.get('ticket_id')
        user_id = data.get('user_id')
        project_id = data.get('project_id')
        text_response_1 = data.get('text_response_1')
        text_response_2 = data.get('text_response_2')
        if not all([ticket_id, user_id]):
            return {'error': 'Missing required fields'}, 400
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            INSERT INTO trueday.answers (ticket_id, user_id, project_id, text_response_1, text_response_2)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING answer_id, created_at;
        ''', (ticket_id, user_id, project_id, text_response_1, text_response_2))
        answer_id, created_at = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return {'answer_id': answer_id, 'created_at': created_at}, 201
    except Exception as e:
        return {'error': str(e)}, 500

@app.route('/api/answers', methods=['GET'])
def get_all_answers():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            SELECT a.answer_id, a.ticket_id, u.username, a.text_response_1, a.text_response_2, a.created_at
            FROM trueday.answers a
            JOIN trueday.users u ON a.user_id = u.id
            ORDER BY a.created_at DESC
        ''')
        rows = cur.fetchall()
        answers = [
            {
                'answer_id': row[0],
                'ticket_id': row[1],
                'username': row[2],
                'text_response_1': row[3],
                'text_response_2': row[4],
                'created_at': row[5].isoformat() if row[5] else None
            }
            for row in rows
        ]
        cur.close()
        conn.close()
        return jsonify(answers), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/projects', methods=['POST'])
def create_project():
    try:
        data = request.get_json()
        project_name = data.get('project_name')
        color = data.get('color', '#FFFFFF')  # default color if not provided

        if not project_name:
            return jsonify({'error': 'Project name is required'}), 400

        conn = get_db_connection()
        cur = conn.cursor()

        # Check if project exists
        cur.execute('SELECT project_id FROM trueday.project WHERE project_name = %s', (project_name,))
        row = cur.fetchone()
        if row:
            # row might be dict or tuple
            project_id = row[0] if isinstance(row, tuple) else row['project_id']
        else:
            cur.execute(
                'INSERT INTO trueday.project (project_name, color) VALUES (%s, %s) RETURNING project_id',
                (project_name, color)
            )
            row = cur.fetchone()
            project_id = row[0] if isinstance(row, tuple) else row['project_id']
            conn.commit()

        cur.close()
        conn.close()

        return jsonify({'project_id': project_id}), 201

    except Exception as e:
        # Add server-side logging for debugging
        print("Error in create_project:", e)
        return jsonify({'error': str(e)}), 500


# Serve static assets from the React build
@app.route('/assets/<path:filename>')
def serve_assets(filename):
    assets_dir = os.path.join(os.path.dirname(__file__), '../my-vite-app/dist/assets')
    file_path = os.path.join(assets_dir, filename)
    print(f"[DEBUG] Serving asset: {file_path} (exists: {os.path.exists(file_path)})")
    return send_from_directory(assets_dir, filename)

# NOTE: Using catch_all() function below for SPA routing - removed duplicate serve_react_app()

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    print(f"[DEBUG] Catch-all route triggered for path: '{path}'")
    
    # Handle API routes
    if path.startswith('api/'):
        print("[DEBUG] API route detected, returning 404")
        return "Not Found", 404
        
    # Handle static assets
    if path.startswith('assets/'):
        assets_dir = os.path.join(os.path.dirname(__file__), '../my-vite-app/dist/assets')
        file_path = os.path.join(assets_dir, path.replace('assets/', ''))
        print(f"[DEBUG] Serving asset: {file_path} (exists: {os.path.exists(file_path)})")
        if os.path.exists(file_path):
            return send_from_directory(assets_dir, path.replace('assets/', ''))
        return "Not Found", 404
        
    # Handle uploads
    if path.startswith('uploads/'):
        uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')
        file_path = os.path.join(uploads_dir, path.replace('uploads/', ''))
        print(f"[DEBUG] Serving upload: {file_path} (exists: {os.path.exists(file_path)})")
        if os.path.exists(file_path):
            return send_from_directory(uploads_dir, path.replace('uploads/', ''))
        return "Not Found", 404
    
    # For all other routes, serve index.html
    dist_dir = os.path.join(os.path.dirname(__file__), '../my-vite-app/dist')
    index_path = os.path.join(dist_dir, 'index.html')
    print(f"[DEBUG] Serving index.html from: {index_path} (exists: {os.path.exists(index_path)})")
    
    if not os.path.exists(index_path):
        print('[ERROR] index.html not found!')
        return "index.html not found", 500
        
    return send_from_directory(dist_dir, 'index.html')

# @app.route('/test_mail')
# def test_mail():
#     try:
#         msg = Message(
#             subject="Test Email",
#             sender="ariths@arithwise.com",
#             recipients=["aditi.pimpalkar@arithwise.com"],  # Replace with your email for testing
#             body="This is a test email from Flask."
#         )
#         mail.send(msg)
#         return "Mail sent!"
#     except Exception as e:
#         return f"Mail failed: {e}"

@app.route('/api/statuses/reorder', methods=['POST'])
def reorder_statuses():
    # No-op: order is managed on the frontend only
    return jsonify({'message': 'Status order updated (frontend only, not persisted)'}), 200

@app.route('/api/user/<int:user_id>/points', methods=['GET'])
def get_user_points(user_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT points FROM trueday.users WHERE id = %s", (user_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if row:
            return jsonify({'points': row[0]})
        else:
            return jsonify({'error': 'User not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, points FROM trueday.users ORDER BY points DESC LIMIT 10;")
        users = [{'id': row[0], 'username': row[1], 'points': row[2]} for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        return jsonify(users)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Patch the /api/tickets/<int:ticket_id>/status endpoint to award points
import functools
old_update_ticket_status = app.view_functions.get('update_ticket_status')

def patched_update_ticket_status(ticket_id):
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'PUT,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    try:
        data = request.get_json()
        new_status = data.get('status')
        assignee_id = data.get('assignee_id')
        if not new_status:
            return jsonify({"error": "Status is required"}), 400
        new_status = new_status.upper()
        
        # Get current user information from request body or session
        current_user_id = data.get('user_id') or session.get('user_id')
        current_username = data.get('username') or session.get('name', 'Unknown User')
        
        # Debug logging
        print(f"DEBUG: Patched status update for ticket {ticket_id} by user {current_username}")
        print(f"DEBUG: User info from request: user_id={data.get('user_id')}, username={data.get('username')}")
        print(f"DEBUG: User info from session: user_id={session.get('user_id')}, name={session.get('name')}")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get the current status and approver before updating
        cursor.execute("SELECT status, approver_id FROM trueday.tickets WHERE ticket_id = %s", (ticket_id,))
        current_ticket = cursor.fetchone()
        if not current_ticket:
            return jsonify({"error": "Ticket not found"}), 404

        # Support dict-like rows (dict_row) and tuple rows
        if isinstance(current_ticket, dict):
            old_status = current_ticket.get('status')
            ticket_approver_id = current_ticket.get('approver_id')
        else:
            old_status = current_ticket[0]
            ticket_approver_id = current_ticket[1]
        
        # Validate approver permissions for COMPLETED status
        if new_status == 'COMPLETED' and ticket_approver_id:
            # If there is an approver assigned, only that approver can complete the ticket
            if not current_user_id or str(current_user_id) != str(ticket_approver_id):
                return jsonify({"error": f"Only the assigned approver can mark this ticket as completed"}), 403
        
        # Update the ticket status and set deleted_at if status is DELETED
        if new_status == 'DELETED':
            cursor.execute("""
                UPDATE trueday.tickets 
                SET status = %s, deleted_at = NOW()
                WHERE ticket_id = %s 
                RETURNING ticket_id, assignee_id
            """, (new_status, ticket_id))
        else:
            cursor.execute("""
                UPDATE trueday.tickets 
                SET status = %s, deleted_at = NULL
                WHERE ticket_id = %s 
                RETURNING ticket_id, assignee_id
            """, (new_status, ticket_id))
        updated_ticket = cursor.fetchone()
        if not updated_ticket:
            return jsonify({"error": "Ticket not found"}), 404
            
        # Record the status change in history
        if old_status != new_status:
            print(f"DEBUG: Recording status change in patched function - Old: {old_status}, New: {new_status}, User: {current_username}")
            try:
                cursor.execute("""
                    INSERT INTO trueday.ticket_history (
                        ticket_id, changed_by, change_type, old_value, new_value, changed_at
                    ) VALUES (%s, %s, %s, %s, %s, NOW())
                """, (ticket_id, current_username, 'status', old_status, new_status))
                print(f"DEBUG: History record inserted successfully in patched function")
            except Exception as e:
                print(f"DEBUG: Error inserting history record in patched function: {e}")
                conn.rollback()
                cursor.close()
                conn.close()
                return jsonify({"error": f"Failed to record history: {str(e)}"}), 500
        else:
            print(f"DEBUG: No status change detected in patched function - Old: {old_status}, New: {new_status}")
        
        # Award points if completed
        if new_status == 'COMPLETED':
            # updated_ticket may be dict-like or tuple-like; extract assignee safely
            try:
                if isinstance(updated_ticket, dict):
                    assignee_from_row = updated_ticket.get('assignee_id') or updated_ticket.get('assignee') or updated_ticket.get('assigneeId')
                else:
                    # tuple: RETURNING ticket_id, assignee_id -> assignee at index 1
                    assignee_from_row = updated_ticket[1] if len(updated_ticket) > 1 else None
            except Exception:
                assignee_from_row = None

            assignee = assignee_id or assignee_from_row
            if assignee:
                cursor.execute(
                    "UPDATE trueday.users SET points = COALESCE(points, 0) + 10 WHERE id = %s",
                    (assignee,)
                )
        conn.commit()
        cursor.close()
        conn.close()
        response = jsonify({"message": "Status updated successfully"})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
    except Exception as e:
        response = jsonify({"error": str(e)})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 500

app.view_functions['update_ticket_status'] = patched_update_ticket_status

@app.route('/api/current_user', methods=['GET'])
def get_current_user():
    user_id = session.get('user_id')
    name = session.get('name')
    print(f"DEBUG: Current user endpoint - user_id: {user_id}, name: {name}")
    print(f"DEBUG: Session data: {dict(session)}")
    if user_id and name:
        return jsonify({'id': user_id, 'name': name})
    else:
        return jsonify({'error': 'Not logged in'}), 401

@app.route('/api/send-progress-pulse-notification', methods=['POST'])
def send_progress_pulse_notification():
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        ticket_id = data.get('ticket_id')
        project_id = data.get('project_id')

        # Get user info
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT username, email FROM trueday.users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        if isinstance(user, dict):
            username = user.get('username')
            email = user.get('email')
        else:
            username, email = user

        # Optionally, get ticket info
        ticket_info = ""
        if ticket_id:
            cur.execute("SELECT title FROM trueday.tickets WHERE ticket_id = %s", (ticket_id,))
            ticket = cur.fetchone()
            if ticket:
                t_title = ticket.get('title') if isinstance(ticket, dict) else ticket[0]
                ticket_info = f"\nTicket: {t_title} (ID: {ticket_id})"

        # Optionally, get project info
        project_info = ""
        if project_id:
            cur.execute("SELECT project_name FROM trueday.project WHERE project_id = %s", (project_id,))
            project = cur.fetchone()
            if project:
                p_name = project.get('project_name') if isinstance(project, dict) else project[0]
                project_info = f"\nProject: {p_name}"

        # Compose and send email
        msg = Message(
            subject="Progress Pulse Entry Submitted",
            recipients=[email],
            body=f"Hi {username},\n\nYour Progress Pulse entry has been submitted successfully!{ticket_info}{project_info}\n\nThank you!"
        )
        mail.send(msg)
        cur.close()
        conn.close()
        return jsonify({'message': 'Notification email sent'}), 200

    except Exception as e:
        print(f"Error sending Progress Pulse notification: {e}")
        return jsonify({'error': str(e)}), 500

def send_progress_pulse_reminders():
    print(f"Reminder job triggered at {datetime.now()}")
    now = datetime.now()
    # Only run after 12:00 PM
    if now.hour < 12:
        return

    conn = get_db_connection()
    cur = conn.cursor()
    # Get all IN PROGRESS tickets and their assignees
    cur.execute("""
        SELECT t.ticket_id, t.title, u.id, u.username, u.email
        FROM trueday.tickets t
        JOIN trueday.users u ON t.assignee_id = u.id
        WHERE UPPER(t.status) = 'IN PROGRESS'
    """)
    tickets = cur.fetchall()

    for row in tickets:
        if isinstance(row, dict):
            ticket_id = row.get('ticket_id')
            ticket_title = row.get('title')
            user_id = row.get('id')
            username = row.get('username')
            email = row.get('email')
        else:
            ticket_id, ticket_title, user_id, username, email = row

        # Check if user has filled progress pulse for this ticket today
        cur.execute("""
            SELECT 1 FROM progress_pulse
            WHERE created_by = %s AND ticket_number = %s AND date = %s
        """, (user_id, ticket_id, now.date()))
        if not cur.fetchone():
            # Send reminder email
            msg = Message(
                subject="Reminder: Please fill your Progress Pulse entry",
                recipients=[email],
                body=f"Hi {username},\n\nPlease remember to fill your Progress Pulse entry for ticket '{ticket_title}' (ID: {ticket_id}) today.\n\nThank you!"
            )
            mail.send(msg)
            # Insert or update notification
            cur.execute("""
                SELECT id, reminder_count FROM trueday.notifications
                WHERE user_id = %s AND notification_type = %s AND related_entity_id = %s AND status = 'unread' AND created_at::date = %s
            """, (user_id, "progress_pulse_reminder", ticket_id, now.date()))
            row_notif = cur.fetchone()
            if row_notif:
                if isinstance(row_notif, dict):
                    notif_id = row_notif.get('id')
                    reminder_count = row_notif.get('reminder_count')
                else:
                    notif_id, reminder_count = row_notif
                cur.execute("""
                    UPDATE trueday.notifications
                    SET reminder_count = %s, last_reminder_at = NOW()
                    WHERE id = %s
                """, (reminder_count + 1, notif_id))
            else:
                cur.execute("""
                    INSERT INTO trueday.notifications (
                        user_id, title, message, notification_type, priority, status, 
                        sent_at, reminder_count, last_reminder_at, related_entity_type, related_entity_id
                    ) VALUES (%s, %s, %s, %s, %s, %s, NOW(), %s, NOW(), %s, %s)
                """, (
                    user_id,
                    "Progress Pulse Reminder",
                    f"Hi {username},\n\nPlease remember to fill your Progress Pulse entry for ticket '{ticket_title}' (ID: {ticket_id}) today.\n\nThank you!",
                    "progress_pulse_reminder",
                    "normal",
                    "unread",
                    1,
                    "progress_pulse",
                    ticket_id
                ))
    conn.commit()
    cur.close()
    conn.close()

# Set the scheduler to use Indian Standard Time (IST)
ist = timezone('Asia/Kolkata')
scheduler = BackgroundScheduler(timezone=ist)
# Change to run every hour from 12:00 PM to 11:00 PM
scheduler.add_job(send_progress_pulse_reminders, 'cron', hour='12-23', minute=0)  # every hour at minute 0, from 12 PM onwards
scheduler.start()

@app.route('/api/collaborators', methods=['GET'])
def get_collaborators():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT id, username FROM trueday.users ORDER BY username;')
        users = [{'id': row[0], 'username': row[1]} for row in cur.fetchall()]
        cur.close()
        conn.close()
        return jsonify(users)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/update_general_tags_to_task', methods=['POST'])
def update_general_tags_to_task():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE trueday.tickets
            SET tag = 'Task'
            WHERE tag = 'General';
        """)
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({"message": "All 'General' tags updated to 'Task' successfully"}), 200
    except Exception as e:
        print(f"Error updating tags: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/labels', methods=['GET'])
def get_labels():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT label_id, label_name, color, project_id FROM trueday.labels;')
        rows = cur.fetchall()
        labels = [
            {
                'label_id': row['label_id'],
                'label_name': row['label_name'],
                'color': row['color'],
                'project_id': row['project_id']
            }
            for row in rows
        ]
        cur.close()
        conn.close()
        return jsonify(labels)

    except Exception as e:
        print("Error in get_labels:", e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/labels/create', methods=['POST', 'OPTIONS'])
def create_labels():
    try:
        data = request.get_json() or {}
        project_id = data.get('project_id')
        labels = data.get('labels')

        if not project_id or not labels or not isinstance(labels, list):
            return jsonify({'error': 'project_id and labels list are required'}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        created = []

        for label in labels:
            name = (label.get('label_name') or '').strip()
            color = label.get('color') or '#5e145e'
            if not name:
                continue

            cur.execute(
                '''
                INSERT INTO trueday.labels (label_name, color, project_id)
                VALUES (%s, %s, %s)
                RETURNING label_id;
                ''',
                (name, color, project_id)
            )
            row = cur.fetchone()
            created.append({
                'label_id': row['label_id'] if row else None,
                'label_name': name,
                'color': color,
                'project_id': project_id
            })

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({'created': created}), 200
    except Exception as e:
        print('Error in create_labels:', e)
        return jsonify({'error': str(e)}), 500


@app.route('/api/approvers', methods=['GET'])
def get_approvers():
    try:
        conn = get_db_connection()
        cur = conn.cursor()  # ✅ no cursor_factory needed

        
        # Get all users who can be approvers with their assigned project IDs
        query = """
            SELECT u.id, u.username, u.email, array_agg(pu.project_id) as project_ids
            FROM trueday.users u
            LEFT JOIN trueday.project_users pu ON u.id = pu.user_id
            GROUP BY u.id, u.username, u.email
            ORDER BY u.username;
        """
        
        cur.execute(query)
        rows = cur.fetchall()
        
        # Format the response
        approvers = []
        for row in rows:
            approvers.append({
                'id': row['id'],
                'username': row['username'],
                'email': row['email'],
                'project_ids': [str(pid) for pid in row['project_ids'] if pid is not None]
            })
        
        cur.close()
        conn.close()
        
        return jsonify(approvers)

    except Exception as e:
        print(f"Error fetching approvers: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ===========================
# PROJECT MANAGEMENT ROUTES
# ===========================

@app.route('/api/projects', methods=['GET', 'OPTIONS'])
def get_user_projects():
    """Get all projects assigned to the current user"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        return response
    
    try:
        # Get user_id from session or JWT
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Fetch projects assigned to the user
        cursor.execute("""
            SELECT DISTINCT p.project_id, p.project_name, p.color, p.created_at, pu.role
            FROM trueday.project p
            INNER JOIN trueday.project_users pu ON p.project_id = pu.project_id
            WHERE pu.user_id = %s
            ORDER BY p.project_name ASC
        """, (user_id,))
        
        projects = cursor.fetchall()
        projects_list = []
        
        for project in projects:
            projects_list.append({
                'id': project[0],
                'name': project[1],
                'color': project[2],
                'created_at': project[3].isoformat() if project[3] else None,
                'role': project[4]
            })
        
        cursor.close()
        conn.close()
        
        return jsonify(projects_list)
    
    except Exception as e:
        print(f"Error fetching user projects: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/projects/all', methods=['GET', 'OPTIONS'])
def get_all_projects():
    """Get all projects (for admin purposes)"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        return response
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
        
        # Check if user is admin (session_id in allowed list)
        session_id = session.get('id')
        ALLOWED_SESSION_IDS = ['1', '2', '3', '7', '8']
        
        if str(session_id) not in ALLOWED_SESSION_IDS:
            return jsonify({'error': 'Access denied'}), 403
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Fetch all projects
        cursor.execute("""
            SELECT project_id, project_name, color, created_at
            FROM trueday.project
            ORDER BY project_name ASC
        """)
        
        projects = cursor.fetchall()
        projects_list = []
        
        for project in projects:
            projects_list.append({
                'id': project[0],
                'name': project[1],
                'color': project[2],
                'created_at': project[3].isoformat() if project[3] else None
            })
        
        cursor.close()
        conn.close()
        
        return jsonify(projects_list)
    
    except Exception as e:
        print(f"Error fetching all projects: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/projects/create', methods=['POST', 'OPTIONS'])
def create_new_project():
    """Create a new project"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        return response
    
    conn = None
    try:
        data = request.get_json()
        if data is None:
            return jsonify({'error': 'Invalid JSON in request body'}), 400
            
        project_name = data.get('project_name', '').strip()
        color = data.get('color', '#5e145e')
        
        if not project_name:
            return jsonify({'error': 'Project name is required'}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Create project
        cursor.execute("""
            INSERT INTO trueday.project (project_name, color, created_at)
            VALUES (%s, %s, CURRENT_TIMESTAMP)
            RETURNING project_id
        """, (project_name, color))
        
        result = cursor.fetchone()
        if result is None:
            conn.rollback()
            cursor.close()
            conn.close()
            return jsonify({'error': 'Failed to retrieve project ID after creation'}), 500
        
        # Handle both dict_row and tuple results
        if isinstance(result, dict):
            project_id = result['project_id']
        else:
            project_id = result[0]
            
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'project_id': project_id,
            'project_name': project_name,
            'color': color,
            'message': 'Project created successfully'
        }), 201
        
    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except:
                pass
        
        error_msg = str(e)
        logger.error(f"Error creating project: {error_msg}")
        import traceback
        traceback.print_exc()
        
        # Check if it's a unique constraint violation
        if 'unique constraint' in error_msg.lower() or 'duplicate key' in error_msg.lower():
            return jsonify({'error': f'Project name "{project_name}" already exists. Please use a different name.'}), 400
        else:
            return jsonify({'error': f'Failed to create project: {error_msg}'}), 500
    
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass


@app.route('/api/projects/update/<int:project_id>', methods=['PUT', 'OPTIONS'])
def update_project(project_id):
    """Update an existing project"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'PUT,OPTIONS')
        return response
    
    conn = None
    try:
        data = request.get_json()
        project_name = data.get('project_name', '').strip()
        color = data.get('color', '#5e145e')
        
        if not project_name:
            return jsonify({'error': 'Project name is required'}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE trueday.project
            SET project_name = %s, color = %s
            WHERE project_id = %s
        """, (project_name, color, project_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Project updated successfully'})
    
    except Exception as e:
        logger.error(f"Error updating project: {str(e)}")
        if conn:
            conn.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/projects/delete/<int:project_id>', methods=['DELETE', 'OPTIONS'])
def delete_project(project_id):
    """Delete a project"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'DELETE,OPTIONS')
        return response
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # First, check if there are tickets associated with this project
        cursor.execute("SELECT count(*) FROM trueday.tickets WHERE project_id = %s", (project_id,))
        count_res = cursor.fetchone()
        
        # Handle dictionary and tuple row types
        if isinstance(count_res, dict):
            count_val = count_res['count']
        elif count_res:
            count_val = count_res[0]
        else:
            count_val = 0
            
        if count_val > 0:
            return jsonify({'error': 'Cannot delete project with active tickets. Please reassign or delete tickets first.'}), 400
            
        # Delete from project_users first (junction table)
        cursor.execute("DELETE FROM trueday.project_users WHERE project_id = %s", (project_id,))
        
        # Delete project
        cursor.execute("DELETE FROM trueday.project WHERE project_id = %s", (project_id,))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Project deleted successfully'})
    
    except Exception as e:
        logger.error(f"Error deleting project: {str(e)}")
        if conn:
            conn.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/project-users/add', methods=['POST', 'OPTIONS'])
def add_user_to_project():
    """Add a user to a project"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        return response
    
    conn = None
    try:
        data = request.get_json()
        if data is None:
            return jsonify({'error': 'Invalid JSON in request body'}), 400
        
        project_id = data.get('project_id')
        user_id = data.get('user_id')
        role = data.get('role', 'User')
        
        if not project_id:
            return jsonify({'error': 'Project ID is required'}), 400
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if user is already assigned to project
        cursor.execute("""
            SELECT project_users_id FROM trueday.project_users 
            WHERE user_id = %s AND project_id = %s
        """, (user_id, project_id))
        
        existing = cursor.fetchone()
        if existing:
            cursor.close()
            conn.close()
            return jsonify({'error': 'User is already assigned to this project'}), 400
        
        # Insert user-project assignment
        cursor.execute("""
            INSERT INTO trueday.project_users (user_id, project_id, role, created_at)
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
            RETURNING project_users_id
        """, (user_id, project_id, role))
        
        result = cursor.fetchone()
        if result is None:
            conn.rollback()
            cursor.close()
            conn.close()
            return jsonify({'error': 'Failed to add user to project'}), 500
        
        # Handle both dict_row and tuple results
        if isinstance(result, dict):
            project_users_id = result['project_users_id']
        else:
            project_users_id = result[0]
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'project_users_id': project_users_id,
            'user_id': user_id,
            'project_id': project_id,
            'role': role,
            'message': 'User added to project successfully'
        }), 201
        
    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except:
                pass
        
        error_msg = str(e)
        logger.error(f"Error adding user to project: {error_msg}")
        import traceback
        traceback.print_exc()
        
        if 'unique constraint' in error_msg.lower() or 'duplicate key' in error_msg.lower():
            return jsonify({'error': 'User is already assigned to this project'}), 400
        else:
            return jsonify({'error': f'Failed to add user to project: {error_msg}'}), 500
    
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass


@app.route('/api/project-users/remove', methods=['DELETE', 'OPTIONS'])
def remove_user_from_project():
    """Remove a user from a project"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'DELETE,OPTIONS')
        return response
    
    conn = None
    try:
        data = request.get_json()
        if data is None:
            return jsonify({'error': 'Invalid JSON in request body'}), 400
            
        project_id = data.get('project_id')
        user_id = data.get('user_id')
        
        if not project_id or not user_id:
            return jsonify({'error': 'Project ID and User ID are required'}), 400
            
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            DELETE FROM trueday.project_users 
            WHERE user_id = %s AND project_id = %s
        """, (user_id, project_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'success': True, 'message': 'User removed from project successfully'})
        
    except Exception as e:
        logger.error(f"Error removing user from project: {str(e)}")
        if conn:
            conn.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/project-users/update-role', methods=['PUT', 'OPTIONS'])
def update_project_user_role():
    """Update a user's role in a project"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'PUT,OPTIONS')
        return response
    
    conn = None
    try:
        data = request.get_json()
        project_id = data.get('project_id')
        user_id = data.get('user_id')
        role = data.get('role')
        
        if not all([project_id, user_id, role]):
            return jsonify({'error': 'Project ID, User ID, and Role are required'}), 400
            
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE trueday.project_users 
            SET role = %s
            WHERE user_id = %s AND project_id = %s
        """, (role, user_id, project_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'success': True, 'message': 'User role updated successfully'})
        
    except Exception as e:
        logger.error(f"Error updating user role in project: {str(e)}")
        if conn:
            conn.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/project-users', methods=['GET', 'OPTIONS'])
def get_project_users():
    """Get all users in the system for project assignment"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        return response
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Fetch all users
        cursor.execute("""
            SELECT id, username, email, first_name, last_name
            FROM trueday.users
            ORDER BY username ASC
        """)
        
        users = cursor.fetchall()
        users_list = []
        
        for user in users:
            users_list.append({
                'id': user[0],
                'username': user[1],
                'email': user[2],
                'first_name': user[3],
                'last_name': user[4],
                'display_name': f"{user[3]} {user[4]}".strip() or user[1]
            })
        
        cursor.close()
        conn.close()
        
        return jsonify(users_list)
    
    except Exception as e:
        print(f"Error fetching project users: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/project/<int:project_id>/users', methods=['GET', 'OPTIONS'])
def get_project_user_list(project_id):
    """Get all users assigned to a specific project"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        return response
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Fetch users assigned to project
        cursor.execute("""
            SELECT u.id, u.username, u.email, pu.role
            FROM trueday.users u
            INNER JOIN trueday.project_users pu ON u.id = pu.user_id
            WHERE pu.project_id = %s
            ORDER BY u.username ASC
        """, (project_id,))
        
        users = cursor.fetchall()
        users_list = []
        
        for user in users:
            # Handle both dict_row and tuple formats
            if isinstance(user, dict):
                users_list.append({
                    'id': user['id'],
                    'username': user['username'],
                    'email': user['email'],
                    'role': user['role'],
                    'display_name': user['username']
                })
            else:
                users_list.append({
                    'id': user[0],
                    'username': user[1],
                    'email': user[2],
                    'role': user[3],
                    'display_name': user[1]
                })
        
        cursor.close()
        conn.close()
        
        return jsonify(users_list)
    
    except Exception as e:
        if conn:
            try:
                conn.close()
            except:
                pass
        logger.error(f"Error fetching project users: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/projects/with-users', methods=['GET', 'OPTIONS'])
def get_all_projects_with_users():
    """Get all projects with their assigned users from project and project_users tables"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        return response
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Fetch all projects with their assigned users
        cursor.execute("""
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
        """)
        
        projects = cursor.fetchall()
        projects_list = []
        
        for project in projects:
            users_data = project[4] if project[4] else []
            projects_list.append({
                'project_id': project[0],
                'project_name': project[1],
                'color': project[2],
                'created_at': project[3].isoformat() if project[3] else None,
                'users': users_data,
                'user_count': len(users_data) if users_data else 0
            })
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'total_projects': len(projects_list),
            'projects': projects_list
        })
    
    except Exception as e:
        print(f"Error fetching projects with users: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


        


@app.route('/api/ticket-creation-frequency', methods=['GET'])
def get_ticket_creation_frequency():
    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'Database connection failed'}), 500
    try:
        employee = request.args.get('employee')
        priority = request.args.get('priority')
        status = request.args.get('status')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        query = """
            SELECT 
                TO_CHAR(t.created_at, 'YYYY-MM') as month,
                u.username as creator,
                COUNT(t.ticket_id) as count
            FROM trueday.tickets t
            LEFT JOIN trueday.users u ON t.assignee_id = u.id
            WHERE t.created_at IS NOT NULL
        """
        params = []
        if employee and employee != 'all':
            query += " AND t.assignee_id = %s"
            params.append(employee)
        if priority and priority != 'all':
            query += " AND LOWER(t.priority) = LOWER(%s)"
            params.append(priority)
        if status and status != 'all':
            query += " AND LOWER(t.status) = LOWER(%s)"
            params.append(status)
            
        if start_date:
            query += " AND t.created_at >= %s"
            params.append(start_date)
        if end_date:
            query += " AND t.created_at <= %s"
            params.append(end_date)

        p_ids = get_project_ids_list()
        if p_ids:
            query += " AND t.project_id = ANY(%s)"
            params.append(p_ids)
            
        query += """
            GROUP BY TO_CHAR(t.created_at, 'YYYY-MM'), creator
            ORDER BY month ASC
        """
        
        from psycopg.rows import dict_row
        cursor = conn.cursor(row_factory=dict_row)
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        months = sorted(list(set(row['month'] for row in rows if row['month'])))
        creators = list(set(row['creator'] for row in rows if row['creator']))
        
        colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6']
        
        datasets = []
        for i, creator in enumerate(creators):
            data = []
            for m in months:
                count = next((r['count'] for r in rows if r['month'] == m and r['creator'] == creator), 0)
                data.append(count)
            color = colors[i % len(colors)]
            datasets.append({
                'label': creator,
                'data': data,
                'borderColor': color,
                'backgroundColor': color,
                'tension': 0.4
            })
            
        return jsonify({
            'labels': months,
            'datasets': datasets
        })
    except Exception as e:
        print(f"Error fetching ticket creation frequency: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/recent-inprogress-tickets', methods=['GET'])
def get_recent_inprogress_tickets():
    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'Database connection failed'}), 500
    try:
        query = """
            SELECT 
                t.ticket_id, 
                t.title, 
                COALESCE(u.username, 'Unassigned') as creator, 
                t.priority, 
                TO_CHAR(t.updated_at, 'YYYY-MM-DD HH24:MI') as moved_at
            FROM trueday.tickets t
            LEFT JOIN trueday.users u ON t.assignee_id = u.id
            WHERE LOWER(t.status) = 'in progress'
        """
        params = []
        p_ids = get_project_ids_list()
        if p_ids:
            query += " AND t.project_id = ANY(%s)"
            params.append(p_ids)

        query += """
            ORDER BY t.updated_at DESC
            LIMIT 5
        """
        from psycopg.rows import dict_row
        cursor = conn.cursor(row_factory=dict_row)
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return jsonify({'tickets': rows})
    except Exception as e:
        print(f"Error fetching recent inprogress tickets: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

# --- PROGRESS PULSE ENDPOINTS ---

@app.route('/api/progress-pulse/tickets', methods=['GET'])
def get_pp_tickets():
    try:
        user_id = request.args.get('user_id')
        conn = get_db_connection()
        from psycopg.rows import dict_row
        cursor = conn.cursor(row_factory=dict_row)

        # Check if the user is admin
        is_admin = False
        if user_id:
            try:
                cursor.execute("SELECT role FROM trueday.users WHERE id = %s", (int(user_id),))
                user_row = cursor.fetchone()
                if user_row:
                    role = str(user_row.get('role', '')).lower()
                    is_admin = role in ['admin', 'superadmin', 'superuser']
            except ValueError:
                pass

        query = """
            SELECT t.*, u.username as assignee_name, u2.username as creator_name, p.project_name
            FROM trueday.tickets t
            LEFT JOIN trueday.users u ON t.assignee_id = u.id
            LEFT JOIN trueday.users u2 ON t.creator_id = u2.id
            LEFT JOIN trueday.project p ON t.project_id = p.project_id
            WHERE UPPER(t.status) = 'COMPLETED'
              AND EXISTS (
                SELECT 1 FROM trueday.ticket_history th 
                WHERE th.ticket_id = t.ticket_id 
                  AND th.change_type = 'status' 
                  AND UPPER(th.new_value) = 'COMPLETED' 
                  AND th.changed_at::date = CURRENT_DATE
              )
        """
        params = []
        if not is_admin and user_id:
            try:
                query += " AND t.assignee_id = %s"
                params.append(int(user_id))
            except ValueError:
                pass

        query += " ORDER BY t.ticket_id DESC"
        cursor.execute(query, params)
        tickets = cursor.fetchall()
        return jsonify(tickets)
    except Exception as e:
        print(f"Error fetching pp tickets: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals(): conn.close()

@app.route('/api/progress-pulse/ticket/<int:ticket_id>', methods=['GET'])
def get_pp_ticket_detail(ticket_id):
    try:
        conn = get_db_connection()
        from psycopg.rows import dict_row
        cursor = conn.cursor(row_factory=dict_row)
        cursor.execute("SELECT * FROM trueday.ticket_pulse_details WHERE ticket_id = %s", (ticket_id,))
        detail = cursor.fetchone()
        if not detail:
            detail = {
                "ticket_id": ticket_id,
                "what_did_you_do": "",
                "challenge": "",
                "what_you_learned": "",
                "similar_tickets": "",
                "comments": ""
            }
        return jsonify(detail)
    except Exception as e:
        print(f"Error fetching pp detail: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals(): conn.close()

@app.route('/api/progress-pulse/update/<int:ticket_id>', methods=['PUT'])
def update_pp_ticket_detail(ticket_id):
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO trueday.ticket_pulse_details 
            (ticket_id, what_did_you_do, challenge, what_you_learned, similar_tickets, comments)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (ticket_id) DO UPDATE SET
                what_did_you_do = EXCLUDED.what_did_you_do,
                challenge = EXCLUDED.challenge,
                what_you_learned = EXCLUDED.what_you_learned,
                similar_tickets = EXCLUDED.similar_tickets,
                comments = EXCLUDED.comments
        """, (
            ticket_id,
            data.get('what_did_you_do', ''),
            data.get('challenge', ''),
            data.get('what_you_learned', ''),
            data.get('similar_tickets', ''),
            data.get('comments', '')
        ))
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        print(f"Error updating pp detail: {e}")
        if 'conn' in locals(): conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals(): conn.close()


# ==================================================================
# TIMELINE FEATURE ENDPOINTS
# ==================================================================

# ── Helper: build dict_row cursor ──────────────────────────────────
def _dict_cursor(conn):
    from psycopg.rows import dict_row
    return conn.cursor(row_factory=dict_row)


# 1. POST /api/timeline  ─── Store a daily ticket update
@app.route('/api/timeline', methods=['POST'])
def create_timeline_entry():
    try:
        data = request.json or {}
        ticket_id   = data.get('ticket_id')
        work_done   = data.get('work_done', '')
        challenge   = data.get('challenge', '')
        learning    = data.get('learning', '')
        created_by  = data.get('created_by', '')

        if not ticket_id:
            return jsonify({'error': 'ticket_id is required'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO trueday.timeline_entries
                (ticket_id, work_done, challenge, learning, created_by)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        """, (ticket_id, work_done, challenge, learning, created_by))
        new_id = cursor.fetchone()[0]
        conn.commit()
        return jsonify({'success': True, 'id': new_id}), 201
    except Exception as e:
        print(f"Error creating timeline entry: {e}")
        if 'conn' in locals(): conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals(): conn.close()


# 2. GET /api/timeline/<ticket_id>  ─── Full ticket view with entries
@app.route('/api/timeline/<int:ticket_id>', methods=['GET'])
def get_timeline_by_ticket(ticket_id):
    try:
        conn = get_db_connection()
        cur  = _dict_cursor(conn)

        # Ticket details
        cur.execute("""
            SELECT t.*,
                   u.username  AS assignee_name,
                   u2.username AS creator_name,
                   p.project_name
            FROM trueday.tickets t
            LEFT JOIN trueday.users    u  ON t.assignee_id = u.id
            LEFT JOIN trueday.users    u2 ON t.creator_id  = u2.id
            LEFT JOIN trueday.project  p  ON t.project_id  = p.project_id
            WHERE t.ticket_id = %s
        """, (ticket_id,))
        ticket = cur.fetchone()
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404

        # Timeline entries — table may not exist yet, handle gracefully
        try:
            cur.execute("""
                SELECT * FROM trueday.timeline_entries
                WHERE ticket_id = %s
                ORDER BY created_at DESC
            """, (ticket_id,))
            timeline = cur.fetchall()
        except Exception:
            conn.rollback()  # clear the failed transaction so cursor stays usable
            timeline = []

        # Comments (map existing schema columns)
        cur.execute("""
            SELECT c.id, c.task_id AS ticket_id,
                   u.username AS user_name,
                   c.comment_text AS comment,
                   c.created_at,
                   c.user_id
            FROM trueday.comments c
            LEFT JOIN trueday.users u ON c.user_id = u.id
            WHERE c.task_id = %s
            ORDER BY c.created_at DESC
        """, (ticket_id,))
        comments = cur.fetchall()

        # Similar tickets (same project or matching tag)
        cur.execute("""
            SELECT t.ticket_id, t.title, t.status, t.priority, t.tag,
                   p.project_name
            FROM trueday.tickets t
            LEFT JOIN trueday.project p ON t.project_id = p.project_id
            WHERE t.ticket_id <> %s
              AND (
                t.project_id = (SELECT project_id FROM trueday.tickets WHERE ticket_id = %s)
                OR (t.tag IS NOT NULL AND t.tag = (SELECT tag FROM trueday.tickets WHERE ticket_id = %s))
              )
            ORDER BY t.updated_at DESC
            LIMIT 5
        """, (ticket_id, ticket_id, ticket_id))
        similar = cur.fetchall()

        return jsonify({
            'ticket':          dict(ticket),
            'timeline':        [dict(r) for r in timeline],
            'comments':        [dict(r) for r in comments],
            'similar_tickets': [dict(r) for r in similar],
        })
    except Exception as e:
        print(f"Error fetching timeline: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cur'  in locals(): cur.close()
        if 'conn' in locals(): conn.close()


# 3. POST /api/comments  ─── Add a comment to a ticket
@app.route('/api/comments', methods=['POST'])
def add_timeline_comment():
    try:
        data       = request.json or {}
        ticket_id  = data.get('ticket_id')
        user_name  = data.get('user_name', 'Anonymous')
        user_id    = data.get('user_id')
        comment    = data.get('comment', '')

        if not ticket_id or not comment:
            return jsonify({'error': 'ticket_id and comment are required'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # Resolve user_id from username (fallback to None) if not provided
        if not user_id:
            cursor.execute(
                "SELECT id FROM trueday.users WHERE username ILIKE %s LIMIT 1",
                (user_name,)
            )
            row     = cursor.fetchone()
            if row:
                user_id = row['id'] if isinstance(row, dict) else row[0]
            else:
                user_id = None

        # Fallback 1: If user_name is Anonymous or user could not be found, try to look up user "Anonymous"
        if not user_id:
            cursor.execute("SELECT id FROM trueday.users WHERE username ILIKE 'Anonymous' LIMIT 1")
            row = cursor.fetchone()
            if row:
                user_id = row['id'] if isinstance(row, dict) else row[0]
            else:
                # Create a default Anonymous user
                try:
                    cursor.execute("""
                        INSERT INTO trueday.users (username, email, password)
                        VALUES ('Anonymous', 'anonymous@trueday.com', 'anonymous')
                        RETURNING id;
                    """)
                    inserted_row = cursor.fetchone()
                    user_id = inserted_row['id'] if isinstance(inserted_row, dict) else inserted_row[0]
                except Exception:
                    # Fallback 2: fetch the first available user in DB
                    cursor.execute("SELECT id FROM trueday.users LIMIT 1")
                    row = cursor.fetchone()
                    if row:
                        user_id = row['id'] if isinstance(row, dict) else row[0]
                    else:
                        user_id = None

        cursor.execute("""
            INSERT INTO trueday.comments (task_id, user_id, comment_text)
            VALUES (%s, %s, %s)
            RETURNING id, created_at
        """, (ticket_id, user_id, comment))
        result = cursor.fetchone()

        # Trigger comment notifications
        try:
            cursor.execute("SELECT assignee_id, creator_id, title FROM trueday.tickets WHERE ticket_id = %s", (ticket_id,))
            t_row = cursor.fetchone()
            if t_row:
                t_assignee_id = t_row.get('assignee_id') if isinstance(t_row, dict) else t_row[0]
                t_creator_id = t_row.get('creator_id') if isinstance(t_row, dict) else t_row[1]
                t_title = t_row.get('title') if isinstance(t_row, dict) else t_row[2]
                
                import re
                clean_comment = re.sub(r'<[^>]*>', '', comment).replace('&nbsp;', ' ').strip()
                comment_snippet = clean_comment[:50] + '...' if len(clean_comment) > 50 else clean_comment
                
                # Notify assignee
                if t_assignee_id and str(t_assignee_id) != str(user_id):
                    create_notification(
                        cursor,
                        t_assignee_id,
                        f'New Comment on \'{t_title}\'',
                        f'{user_name} commented: \'{comment_snippet}\'',
                        'comment',
                        ticket_id
                    )
                # Notify creator
                if t_creator_id and str(t_creator_id) != str(user_id) and str(t_creator_id) != str(t_assignee_id):
                    create_notification(
                        cursor,
                        t_creator_id,
                        f'New Comment on \'{t_title}\'',
                        f'{user_name} commented: \'{comment_snippet}\'',
                        'comment',
                        ticket_id
                    )
        except Exception as notify_err:
            logger.error(f"Error triggering comment notifications: {notify_err}")

        conn.commit()

        r_id = result['id'] if isinstance(result, dict) else result[0]
        r_created_at = result['created_at'] if isinstance(result, dict) else result[1]

        return jsonify({
            'success': True,
            'id':         r_id,
            'created_at': r_created_at.isoformat() if r_created_at else None
        }), 201
    except Exception as e:
        print(f"Error adding comment: {e}")
        if 'conn' in locals(): conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn'   in locals(): conn.close()


# Update an existing trueday.comment
@app.route('/api/update_ticket_comment/<int:comment_id>', methods=['PUT', 'POST', 'OPTIONS'])
def update_ticket_comment(comment_id):
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'PUT,POST,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    
    try:
        data = request.get_json(silent=True) or {}
        new_comment = data.get('message') or data.get('comment')
        user_id = data.get('user_id')

        if not all([comment_id, new_comment, user_id]):
            return jsonify({"error": "comment_id, comment and user_id are required"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # Ensure comment exists and belongs to the user performing the update
        cursor.execute("SELECT task_id, user_id, comment_text FROM trueday.comments WHERE id = %s", (comment_id,))
        row = cursor.fetchone()
        if not row:
            cursor.close(); conn.close()
            return jsonify({"error": "Comment not found"}), 404

        if isinstance(row, dict):
            ticket_id = row['task_id']
            owner_user_id = row['user_id']
            old_comment_text = row['comment_text']
        else:
            ticket_id, owner_user_id, old_comment_text = row
        
        if str(owner_user_id) != str(user_id):
            cursor.close(); conn.close()
            return jsonify({"error": "Not authorized to edit this comment"}), 403

        cursor.execute("""
            UPDATE trueday.comments
            SET comment_text = %s
            WHERE id = %s
            RETURNING id, comment_text, created_at, user_id
        """, (new_comment, comment_id))
        updated = cursor.fetchone()

        updated_id = updated['id'] if isinstance(updated, dict) else updated[0]
        updated_comment_text = updated['comment_text'] if isinstance(updated, dict) else updated[1]
        updated_created_at = updated['created_at'] if isinstance(updated, dict) else updated[2]
        updated_user_id = updated['user_id'] if isinstance(updated, dict) else updated[3]

        # Fetch username
        cursor.execute("SELECT username FROM trueday.users WHERE id = %s", (updated_user_id,))
        username_row = cursor.fetchone()
        username = ''
        if username_row:
            username = username_row['username'] if isinstance(username_row, dict) else username_row[0]

        # Record comment edit in history
        try:
            old_clean = clean_message_for_email(old_comment_text)
            new_clean = clean_message_for_email(new_comment)
            old_snippet = (old_clean[:120] + '…') if old_clean and len(old_clean) > 120 else (old_clean or '')
            new_snippet = (new_clean[:120] + '…') if new_clean and len(new_clean) > 120 else (new_clean or '')
            cursor.execute("""
                INSERT INTO trueday.ticket_history (
                    ticket_id, changed_by, change_type, old_value, new_value, change_details, changed_at
                ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
            """, (
                ticket_id,
                username,
                'comment_edit',
                old_snippet,
                new_snippet,
                json.dumps({"comment_id": updated_id})
            ))
        except Exception as e:
            print(f"⚠️ Failed to record comment edit history: {e}")

        conn.commit()
        cursor.close(); conn.close()
        return jsonify({"success": True, "comment_id": updated_id, "comment_text": updated_comment_text})
    except Exception as e:
        print(f"❌ Error updating comment: {str(e)}")
        return jsonify({"error": str(e)}), 500


# NOTE: Duplicate route removed - use get_tickets() at line 1531 for GET /api/tickets


# 5. GET /api/tickets/similar/<ticket_id>  ─── Similar tickets
@app.route('/api/tickets/similar/<int:ticket_id>', methods=['GET'])
def get_similar_tickets(ticket_id):
    try:
        conn = get_db_connection()
        cur  = _dict_cursor(conn)

        # Fetch source ticket metadata
        cur.execute("""
            SELECT project_id, tag, title
            FROM trueday.tickets WHERE ticket_id = %s
        """, (ticket_id,))
        src = cur.fetchone()
        if not src:
            return jsonify([])

        # Keyword extraction from title (simple split)
        keywords = [w for w in (src['title'] or '').split() if len(w) > 3]
        title_pattern = '%' + '%'.join(keywords[:3]) + '%' if keywords else '%%'

        cur.execute("""
            SELECT t.ticket_id, t.title, t.status, t.priority, t.tag,
                   u.username AS assignee_name, p.project_name
            FROM trueday.tickets t
            LEFT JOIN trueday.users   u ON t.assignee_id = u.id
            LEFT JOIN trueday.project p ON t.project_id  = p.project_id
            WHERE t.ticket_id <> %s
              AND (
                t.project_id = %s
                OR (t.tag IS NOT NULL AND t.tag = %s)
                OR t.title ILIKE %s
              )
            ORDER BY t.updated_at DESC
            LIMIT 8
        """, (ticket_id, src['project_id'], src['tag'], title_pattern))
        similar = cur.fetchall()
        return jsonify([dict(r) for r in similar])
    except Exception as e:
        print(f"Error finding similar tickets: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cur'  in locals(): cur.close()
        if 'conn' in locals(): conn.close()



@app.route('/api/progress-pulse/history/<int:ticket_id>', methods=['GET'])
def get_pp_history(ticket_id):
    try:
        conn = get_db_connection()
        from psycopg.rows import dict_row
        cursor = conn.cursor(row_factory=dict_row)
        cursor.execute("""
            SELECT id, ticket_id, work_done, challenge, learning, review_comment,
                   created_by, created_at
            FROM trueday.progresspulse
            WHERE ticket_id = %s
            ORDER BY created_at DESC
        """, (ticket_id,))
        rows = cursor.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('created_at'):
                d['created_at'] = d['created_at'].isoformat()
            result.append(d)
        return jsonify(result)
    except Exception as e:
        print(f"Error fetching pp history: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals(): conn.close()

@app.route('/api/progresspulse/add', methods=['POST'])
def add_progresspulse_entry():
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        # Delete the active draft since it is now submitted
        cursor.execute("DELETE FROM trueday.ticket_pulse_details WHERE ticket_id = %s", (data.get('ticket_id'),))
        cursor.execute("""
            INSERT INTO trueday.progresspulse 
            (ticket_id, work_done, challenge, learning, created_by)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            data.get('ticket_id'),
            data.get('work_done', ''),
            data.get('challenge', ''),
            data.get('learning', ''),
            data.get('created_by', 'Unknown')
        ))
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        print(f"Error adding progress pulse entry: {e}")
        if 'conn' in locals(): conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals(): conn.close()


@app.route('/api/progress-pulse/entry/<int:entry_id>/review', methods=['PUT'])
def update_entry_review(entry_id):
    try:
        data = request.json or {}
        review_comment = data.get('review_comment', '')
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE trueday.progresspulse
            SET review_comment = %s
            WHERE id = %s
        """, (review_comment, entry_id))
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        print(f"Error updating entry review: {e}")
        if 'conn' in locals(): conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals(): conn.close()


@app.route('/api/tickets/<int:ticket_id_patch>', methods=['GET', 'PATCH', 'OPTIONS'])
def patch_ticket_dates(ticket_id_patch):
    if request.method == 'OPTIONS':
        resp = make_response('', 200)
        resp.headers['Access-Control-Allow-Methods'] = 'GET, PATCH, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return resp
    if request.method == 'GET':
        return jsonify({'error': 'Use /api/tickets for listing'}), 400
    # PATCH
    conn = None
    cursor = None
    try:
        data = request.json or {}
        start_date = data.get('start_date')
        end_date = data.get('end_date')

        if not start_date or not end_date:
            return jsonify({'error': 'Missing start_date or end_date'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 1. Fetch ticket details (title) from trueday.tickets to save in updated_tickets_data
        cursor.execute('SELECT title FROM trueday.tickets WHERE ticket_id = %s', (ticket_id_patch,))
        row = cursor.fetchone()
        ticket_title = row['title'] if row else 'Unknown Ticket'

        # 2. Update the main tickets table
        cursor.execute(
            'UPDATE trueday.tickets SET created_at = %s, due_date = %s WHERE ticket_id = %s',
            (start_date, end_date, ticket_id_patch)
        )

        # 3. Create table if not exists and insert/update updated_tickets_data
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS trueday.updated_tickets_data (
                id SERIAL PRIMARY KEY,
                ticket_id INTEGER UNIQUE NOT NULL REFERENCES trueday.tickets(ticket_id) ON DELETE CASCADE,
                title VARCHAR(255),
                start_date TIMESTAMP WITH TIME ZONE,
                end_date TIMESTAMP WITH TIME ZONE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        
        cursor.execute('''
            INSERT INTO trueday.updated_tickets_data (ticket_id, title, start_date, end_date, updated_at)
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (ticket_id) 
            DO UPDATE SET 
                title = EXCLUDED.title,
                start_date = EXCLUDED.start_date,
                end_date = EXCLUDED.end_date,
                updated_at = CURRENT_TIMESTAMP
        ''', (ticket_id_patch, ticket_title, start_date, end_date))

        conn.commit()
        logger.info(f"Timeline PATCH: ticket {ticket_id_patch} updated in tickets and updated_tickets_data: {start_date} -> {end_date}")
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Timeline PATCH error: {e}")
        if conn:
            conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()# ==========================================
# NOTIFICATION API ENDPOINTS
# ==========================================

@app.route('/api/notifications', methods=['GET', 'OPTIONS'])
def get_notifications():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    try:
        user_id = request.args.get('user_id') or session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized, no user_id found'}), 401
            
        limit = request.args.get('limit', 50, type=int)
        
        conn = get_db_connection()
        cursor = conn.cursor()

        # Delete seen/read notifications that are older than 24 hours
        try:
            cursor.execute("""
                DELETE FROM trueday.notifications 
                WHERE status = 'read' AND created_at < NOW() - INTERVAL '24 hours';
            """)
            conn.commit()
        except Exception as clean_err:
            logger.error(f"Error cleaning up old read notifications: {clean_err}")
            conn.rollback()

        cursor.execute("""
            SELECT 
                n.id, n.title, n.message, n.notification_type, n.priority, n.status, n.created_at, n.related_entity_type, n.related_entity_id,
                t.priority AS ticket_priority,
                t.due_date AS ticket_due_date,
                p.project_name,
                t.title AS ticket_title
            FROM trueday.notifications n
            LEFT JOIN trueday.tickets t ON n.related_entity_type = 'ticket' AND n.related_entity_id = t.ticket_id
            LEFT JOIN trueday.project p ON t.project_id = p.project_id
            WHERE n.user_id = %s 
            ORDER BY n.created_at DESC 
            LIMIT %s;
        """, (user_id, limit))
        rows = cursor.fetchall()
        
        notifications = []
        for r in rows:
            created_val = r.get('created_at') if isinstance(r, dict) else r[6]
            due_val = r.get('ticket_due_date') if isinstance(r, dict) else r[10]
            
            notifications.append({
                'id': r.get('id') if isinstance(r, dict) else r[0],
                'title': r.get('title') if isinstance(r, dict) else r[1],
                'message': r.get('message') if isinstance(r, dict) else r[2],
                'notification_type': r.get('notification_type') if isinstance(r, dict) else r[3],
                'priority': r.get('priority') if isinstance(r, dict) else r[4],
                'status': r.get('status') if isinstance(r, dict) else r[5],
                'created_at': created_val.isoformat() if hasattr(created_val, 'isoformat') else str(created_val),
                'related_entity_type': r.get('related_entity_type') if isinstance(r, dict) else r[7],
                'related_entity_id': r.get('related_entity_id') if isinstance(r, dict) else r[8],
                'ticket_priority': r.get('ticket_priority') if isinstance(r, dict) else r[9],
                'ticket_due_date': due_val.isoformat() if hasattr(due_val, 'isoformat') else (str(due_val) if due_val else None),
                'project_name': r.get('project_name') if isinstance(r, dict) else r[11],
                'ticket_title': r.get('ticket_title') if isinstance(r, dict) else r[12]
            })
            
        cursor.close()
        conn.close()
        
        response = jsonify(notifications)
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
    except Exception as e:
        logger.error(f"Error fetching notifications: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/notifications/<int:notification_id>/read', methods=['PUT', 'OPTIONS'])
def mark_notification_read(notification_id):
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'PUT,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE trueday.notifications 
            SET status = 'read', read_at = NOW() 
            WHERE id = %s;
        """, (notification_id,))
        conn.commit()
        cursor.close()
        conn.close()
        
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
    except Exception as e:
        logger.error(f"Error marking notification read: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/notifications/read-all', methods=['PUT', 'OPTIONS'])
def mark_all_notifications_read():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'PUT,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    try:
        user_id = request.args.get('user_id') or session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized, no user_id found'}), 401

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE trueday.notifications 
            SET status = 'read', read_at = NOW() 
            WHERE user_id = %s;
        """, (user_id,))
        conn.commit()
        cursor.close()
        conn.close()
        
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
    except Exception as e:
        logger.error(f"Error marking all notifications read: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/notifications/<int:notification_id>', methods=['DELETE', 'OPTIONS'])
def delete_notification(notification_id):
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'DELETE,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM trueday.notifications 
            WHERE id = %s;
        """, (notification_id,))
        conn.commit()
        cursor.close()
        conn.close()
        
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
    except Exception as e:
        logger.error(f"Error deleting notification: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/notifications/stream', methods=['GET', 'OPTIONS'])
def notifications_stream():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'Missing user_id'}), 400
        
    client_queue = queue.Queue(maxsize=10)
    sse_clients.append((client_queue, user_id))
    
    def event_generator():
        try:
            # Send initial message to confirm connection
            yield f"data: init\n\n"
            while True:
                try:
                    msg = client_queue.get(timeout=20)
                    yield f"data: {msg}\n\n"
                except queue.Empty:
                    # Heartbeat
                    yield ": keep-alive\n\n"
        except GeneratorExit:
            pass
        finally:
            if (client_queue, user_id) in sse_clients:
                sse_clients.remove((client_queue, user_id))
                
    response = Response(event_generator(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response


if __name__ == '__main__':
    # Automate running setup_fdw.py on startup
    try:
        print("Initializing FDW setup mapping...")
        import subprocess
        subprocess.run(["python", "setup_fdw.py"], check=False)
    except Exception as startup_err:
        print(f"FDW startup auto-run skipped/failed: {startup_err}")

    print("Starting Flask server...")
    # Allow overriding the port via the PORT environment variable for flexibility
    port = int(os.getenv('PORT', '5009'))
    print(f"Server is listening on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=True)
