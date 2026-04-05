import sqlite3
import os

def migrate():
    db_path = 'agridirect.db'
    if not os.path.exists(db_path):
        print("Error: agridirect.db not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. Check existing columns in 'orders'
    cursor.execute("PRAGMA table_info(orders)")
    columns = [row[1] for row in cursor.fetchall()]
    
    # 2. Add 'delivery_date' if missing
    if 'delivery_date' not in columns:
        print("Adding 'delivery_date' to 'orders' table...")
        try:
            cursor.execute("ALTER TABLE orders ADD COLUMN delivery_date DATETIME")
            conn.commit()
            print("Successfully added 'delivery_date'.")
        except Exception as e:
            print(f"Error adding 'delivery_date': {e}")
    else:
        print("'delivery_date' already exists.")

    # 3. Add 'slot_id' if missing
    if 'slot_id' not in columns:
        print("Adding 'slot_id' to 'orders' table...")
        try:
            cursor.execute("ALTER TABLE orders ADD COLUMN slot_id INTEGER DEFAULT NULL")
            conn.commit()
            print("Successfully added 'slot_id'.")
        except Exception as e:
            print(f"Error adding 'slot_id': {e}")
    else:
        print("'slot_id' already exists.")

    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
