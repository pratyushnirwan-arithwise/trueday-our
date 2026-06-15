import psycopg2
conn = psycopg2.connect(host='localhost', port='5432', database='trueday', user='postgres', password='Arya@25')
cur = conn.cursor()
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'trueday';")
tables = cur.fetchall()
print("Tables:", tables)

for table in tables:
    if 'activity' in table[0].lower():
        cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'trueday' AND table_name = '{table[0]}';")
        print(f"Schema for {table[0]}:", cur.fetchall())
