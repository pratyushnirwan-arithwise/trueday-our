import sys
sys.path.append('.')
from app import get_db_connection

try:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT
            conname AS constraint_name,
            contype AS constraint_type,
            pg_get_constraintdef(c.oid) AS constraint_definition
        FROM
            pg_constraint c
        JOIN
            pg_namespace n ON n.oid = c.connamespace
        WHERE
            n.nspname = 'trueday' AND
            conrelid = 'trueday.users'::regclass;
    """)
    rows = cur.fetchall()
    print("USERS CONSTRAINTS:")
    for r in rows:
        print(r)
except Exception as e:
    print(f"Error: {e}")
