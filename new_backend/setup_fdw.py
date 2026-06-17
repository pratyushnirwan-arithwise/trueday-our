import psycopg
import os
from dotenv import load_dotenv

# Load database environment variables
load_dotenv('.env')

DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'pratyush1588283')
DB_NAME = os.getenv('DB_NAME', 'TRUEDAY')

print(f"Connecting to database {DB_NAME} to setup postgres_fdw...")

try:
    conn = psycopg.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        dbname=DB_NAME
    )
    conn.autocommit = True
    cur = conn.cursor()
    
    # 1. Enable FDW extension
    print("1. Enabling postgres_fdw extension...")
    cur.execute("CREATE EXTENSION IF NOT EXISTS postgres_fdw;")
    
    # Check if server exists
    cur.execute("SELECT 1 FROM pg_foreign_server WHERE srvname = 'ariths_server';")
    server_exists = cur.fetchone()
    
    if not server_exists:
        print("2. Creating foreign server ariths_server...")
        cur.execute(f"""
            CREATE SERVER ariths_server
            FOREIGN DATA WRAPPER postgres_fdw
            OPTIONS (host '{DB_HOST}', dbname 'ariths', port '{DB_PORT}');
        """)
    else:
        print("2. Foreign server ariths_server already exists.")
        
    # Check if user mapping exists
    cur.execute("""
        SELECT 1 FROM pg_user_mappings 
        WHERE srvname = 'ariths_server' AND usename = %s;
    """, (DB_USER,))
    mapping_exists = cur.fetchone()
    
    if not mapping_exists:
        print(f"3. Creating user mapping for {DB_USER}...")
        cur.execute(f"""
            CREATE USER MAPPING FOR {DB_USER}
            SERVER ariths_server
            OPTIONS (user '{DB_USER}', password '{DB_PASSWORD}');
        """)
    else:
        print(f"3. User mapping for {DB_USER} already exists.")
        
    # Drop foreign table if exists to recreate cleanly
    print("4. Creating foreign table trueday.ariths_accesses...")
    cur.execute("DROP FOREIGN TABLE IF EXISTS trueday.ariths_accesses;")
    cur.execute("""
        CREATE FOREIGN TABLE trueday.ariths_accesses (
            user_id INT,
            tool_id INT,
            access_type VARCHAR(100)
        )
        SERVER ariths_server
        OPTIONS (schema_name 'public', table_name 'accesses');
    """)
    
    # Verify we can query the foreign table
    print("5. Verifying foreign table query...")
    cur.execute("SELECT COUNT(*), COUNT(DISTINCT user_id) FROM trueday.ariths_accesses;")
    res = cur.fetchone()
    print(f"Success! Foreign table has {res[0]} rows and {res[1]} unique user IDs.")
    
    # Test synchronization
    print("6. Executing role synchronization...")
    cur.execute("""
        UPDATE trueday.users u
        SET role = a.access_type
        FROM trueday.ariths_accesses a
        WHERE u.id = a.user_id AND a.tool_id = 2 AND u.role IS DISTINCT FROM a.access_type;
    """)
    print(f"Sync completed successfully! Rows updated: {cur.rowcount}")
        
    cur.close()
    conn.close()
except Exception as e:
    print(f"Setup failed: {e}")
