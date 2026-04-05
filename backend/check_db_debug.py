import sqlite3
import os

def check_db():
    db_path = 'agridirect.db'
    if not os.path.exists(db_path):
        print('Error: agridirect.db not found.')
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"Tables found: {', '.join(tables)}")

    for table in ['orders', 'delivery_slots']:
        if table in tables:
            cursor.execute(f"PRAGMA table_info({table})")
            columns = [row[1] for row in cursor.fetchall()]
            print(f"Columns in '{table}': {', '.join(columns)}")
        else:
            print(f"Table '{table}' NOT FOUND.")
    
    conn.close()

if __name__ == "__main__":
    check_db()
