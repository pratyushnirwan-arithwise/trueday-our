import psycopg2
conn = psycopg2.connect(host='localhost', port='5432', database='trueday', user='postgres', password='12345')
cur = conn.cursor()

def get_schema(table_name):
    cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'trueday' AND table_name = '{table_name}';")
    print(f"Schema for {table_name}:", cur.fetchall())

get_schema('messages')
