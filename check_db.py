import sqlite3

conn = sqlite3.connect('auth.db')
cursor = conn.cursor()

# Check tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("Tables:", tables)

# Check files table if exists
try:
    cursor.execute("SELECT name FROM files")
    files = cursor.fetchall()
    print("Files:", files)
except:
    print("Files table does not exist")

conn.close()
