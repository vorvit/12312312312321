#!/usr/bin/env python3
"""
Start all required services (Redis, PostgreSQL, MinIO)
"""

import subprocess
import sys
import time
import os

def start_services():
    """Start Docker services"""
    print("Starting services with Docker Compose...")
    
    try:
        # Start services
        result = subprocess.run([
            'docker-compose', 'up', '-d', '--profile', 'all'
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print("Services started successfully!")
            print("Waiting for services to be ready...")
            time.sleep(10)
            print("Services should be ready now.")
        else:
            print(f"Error starting services: {result.stderr}")
            
    except FileNotFoundError:
        print("Docker Compose not found. Please install Docker Desktop.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    start_services()

