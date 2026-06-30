import sys
sys.path.append('.')
from app import get_db_connection

try:
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Get columns of trueday.attachments
    cur.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'trueday' AND table_name = 'attachments'
    """)
    print("ATTACHMENTS COLUMNS:")
    for r in cur.fetchall():
        print(r)
        
    # Get constraints of trueday.attachments
    cur.execute("""
        SELECT conname, pg_get_constraintdef(c.oid)
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'trueday' AND conrelid = 'trueday.attachments'::regclass
    """)
    print("\nATTACHMENTS CONSTRAINTS:")
    for r in cur.fetchall():
        print(r)
        
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
