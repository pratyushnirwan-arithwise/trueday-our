import sys
sys.path.append('.')
from app import get_db_connection

def fix_user_id(old_id, new_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 1. First, we need to alter all foreign key constraints that reference users.id
        # to include ON UPDATE CASCADE so that changing the primary key automatically updates all references.
        
        print("Modifying foreign key constraints to CASCADE updates...")
        
        # Tickets table constraints
        constraints_to_update = [
            ("tickets", "tickets_creator_id_fkey", "creator_id"),
            ("tickets", "tickets_assignee_id_fkey", "assignee_id"),
            ("tickets", "tickets_approver_id_fkey", "approver_id"),
            ("tickets", "tickets_collaborator_id_fkey", "collaborator_id"),
            ("project_users", "project_users_user_id_fkey", "user_id"),
            ("progresspulse", "progresspulse_user_id_fkey", "user_id"),
            ("user_work_locations", "user_work_locations_user_id_fkey", "user_id"),
            ("notifications", "notifications_user_id_fkey", "user_id")
        ]
        
        for table, constraint_name, column_name in constraints_to_update:
            try:
                # Check if the constraint exists
                cur.execute(f"""
                    SELECT constraint_name 
                    FROM information_schema.table_constraints 
                    WHERE table_schema = 'trueday' 
                      AND table_name = '{table}' 
                      AND constraint_name = '{constraint_name}'
                """)
                if cur.fetchone():
                    # Drop existing constraint
                    cur.execute(f"ALTER TABLE trueday.{table} DROP CONSTRAINT {constraint_name};")
                    # Recreate with CASCADE
                    cur.execute(f"""
                        ALTER TABLE trueday.{table} 
                        ADD CONSTRAINT {constraint_name} 
                        FOREIGN KEY ({column_name}) 
                        REFERENCES trueday.users(id) 
                        ON UPDATE CASCADE ON DELETE SET NULL;
                    """)
                    print(f"[OK] Updated constraint {constraint_name} on {table}")
            except Exception as ce:
                print(f"[WARN] Could not update constraint {constraint_name} (might not exist): {ce}")
                conn.rollback() # reset transaction block if it failed
        
        # 2. Check if the new ID already exists
        cur.execute("SELECT username FROM trueday.users WHERE id = %s", (new_id,))
        if cur.fetchone():
            print(f"[ERROR] ID {new_id} is already taken by another user!")
            return
            
        # 3. Now we can safely perform the update
        print(f"Changing user ID from {old_id} to {new_id}...")
        cur.execute("UPDATE trueday.users SET id = %s WHERE id = %s", (new_id, old_id))
        
        if cur.rowcount > 0:
            conn.commit()
            print(f"[SUCCESS] Prajwal's ID has been updated from {old_id} to {new_id}.")
            print("All related tickets, projects, and pulses have been automatically updated!")
        else:
            print(f"[ERROR] Could not find a user with ID {old_id}")
            
    except Exception as e:
        print(f"[FATAL] Fatal Error: {e}")
        conn.rollback()
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    # Change Prajwal from 40 to 1
    fix_user_id(40, 1)
