import sys
sys.path.append('.')
from app import get_db_connection

try:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_schema = 'trueday' AND table_name = 'users'")
    rows = cur.fetchall()
    print("USERS SCHEMA:")
    for r in rows:
        print(r)
except Exception as e:
    print(f"Error: {e}")
