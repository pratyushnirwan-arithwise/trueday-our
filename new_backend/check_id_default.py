import sys
sys.path.append('.')
from app import get_db_connection

try:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT column_default FROM information_schema.columns WHERE table_schema = 'trueday' AND table_name = 'users' AND column_name = 'id'")
    print("ID DEFAULT:", cur.fetchone())
except Exception as e:
    print(f"Error: {e}")
