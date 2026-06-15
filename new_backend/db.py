import psycopg2

try:
    conn = psycopg2.connect(
        host="localhost",
        port="5432",
        database="trueday",
        user="postgres",
        password="Arya@25"
    )

    print("✅ PostgreSQL connection successful")

    cur = conn.cursor()
    cur.execute("SELECT current_database();")

    print("Connected to:", cur.fetchone())

    cur.close()
    conn.close()

except Exception as e:
    print("❌ Connection failed")
    print(e)