import sys
sys.path.append('.')
from app import get_db_connection

def test_login(email, user_id, username):
    print(f"Testing login for {email} with ID {user_id}")
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        safe_user_id = None
        try:
            safe_user_id = int(user_id) if user_id else None
        except (ValueError, TypeError):
            pass

        user_data = None
        if email:
            cur.execute("SELECT id, username, email, role FROM trueday.users WHERE LOWER(email) = LOWER(%s) ORDER BY id ASC LIMIT 1", (email,))
            user_data = cur.fetchone()
            if user_data:
                legacy_id = user_data.get('id') if isinstance(user_data, dict) else user_data[0]
                if str(legacy_id) != str(user_id):
                    print(f"Found legacy user by email {email}. Forcing legacy ID {legacy_id} instead of SSO ID {user_id}.")
        
        if not user_data and safe_user_id is not None:
            cur.execute("SELECT id, username, email, role FROM trueday.users WHERE id = %s", (safe_user_id,))
            user_data = cur.fetchone()
            
        if not user_data:
            print(f"Syncing new user from JWT: {username} ({user_id})")
            default_role = "User"
            if safe_user_id is not None:
                cur.execute("""
                    INSERT INTO trueday.users (id, username, email, password, role)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET 
                        username = EXCLUDED.username,
                        email = EXCLUDED.email
                    RETURNING id, username, email, role;
                """, (safe_user_id, username, email, "sso_managed", default_role))
            else:
                cur.execute("""
                    INSERT INTO trueday.users (username, email, password, role)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, username, email, role;
                """, (username, email, "sso_managed", default_role))
            user_data = cur.fetchone()
            conn.commit()

        # Handle dict or tuple user_data
        uid = user_data.get('id') if isinstance(user_data, dict) else user_data[0]
        uname = user_data.get('username') if isinstance(user_data, dict) else user_data[1]
        uemail = user_data.get('email') if isinstance(user_data, dict) else user_data[2]
        urole = user_data.get('role') if isinstance(user_data, dict) else user_data[3]
        print(f"SUCCESS: {uid}, {uname}, {uemail}, {urole}")
        
    except Exception as e:
        print(f"CRASH: {e}")
        import traceback
        traceback.print_exc()

test_login("prajwal.akre@arithwise.com", "f3a4-82bd", "Prajwal")
test_login("pratyush@arithwise.com", "uuid-1234", "Pratyush")
