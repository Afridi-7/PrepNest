import psycopg2, os
from dotenv import load_dotenv
from urllib.parse import urlparse
load_dotenv()
db_url = os.getenv('DATABASE_URL', '')
parsed = urlparse(db_url)
conn = psycopg2.connect(host=parsed.hostname, port=parsed.port or 5432,
                        dbname=parsed.path.lstrip('/'), user=parsed.username, password=parsed.password)
cur = conn.cursor()

cur.execute("""
    SELECT t.id, t.title, s.name, s.exam_type
    FROM topics t JOIN subjects s ON t.subject_id = s.id
    WHERE LOWER(t.title) LIKE '%homeost%'
    ORDER BY t.id ASC
""")
rows = cur.fetchall()
print("=== Topics containing 'homeost' ===")
for row in rows:
    print(f"  topic_id={row[0]}  title={row[1]}  subject={row[2]}  exam_type={row[3]}")

print()
print("=== Biology USAT-M topics (by id) ===")
cur.execute("""
    SELECT t.id, t.title FROM topics t
    JOIN subjects s ON t.subject_id = s.id
    WHERE s.name='Biology' AND s.exam_type='USAT-M'
    ORDER BY t.id ASC
    LIMIT 30
""")
for row in cur.fetchall():
    print(f"  id={row[0]}  title={row[1]}")

conn.close()
