import psycopg2
conn = psycopg2.connect(host='localhost', port='5432', database='trueday', user='postgres', password='12345')
cur = conn.cursor()
cur.execute("SELECT * FROM trueday.comments LIMIT 5;")
print("Comments:", cur.fetchall())
cur.execute("SELECT * FROM trueday.messages LIMIT 5;")
print("Messages:", cur.fetchall())
