import sys
sys.path.append('.')
from app import get_db_connection

try:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, username, email FROM trueday.users WHERE username ILIKE '%prajwal%'")
    rows = cur.fetchall()
    print("PRAJWAL USERS:")
    for r in rows:
        print(r)
except Exception as e:
    print(f"Error: {e}")
