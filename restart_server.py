#!/usr/bin/env python3
"""
Server restart utility
"""

import subprocess
import sys
import time
import os

def restart_server():
    """Restart the FastAPI server"""
    print("Restarting server...")
    
    # Kill existing processes
    try:
        if os.name == 'nt':  # Windows
            subprocess.run(['taskkill', '/f', '/im', 'python.exe'], capture_output=True)
        else:  # Unix-like
            subprocess.run(['pkill', '-f', 'main:app'], capture_output=True)
    except:
        pass
    
    time.sleep(2)
    
    # Start new server
    print("Starting new server...")
    subprocess.Popen([sys.executable, "start.py"])

if __name__ == "__main__":
    restart_server()

