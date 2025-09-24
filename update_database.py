#!/usr/bin/env python3
"""
Database update utility
"""

import sys
import subprocess
import os

def update_database():
    """Run database migrations"""
    print("Updating database...")
    
    try:
        # Run Alembic migrations
        result = subprocess.run([
            sys.executable, '-m', 'alembic', 'upgrade', 'head'
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print("Database updated successfully!")
            print(result.stdout)
        else:
            print(f"Error updating database: {result.stderr}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    update_database()

