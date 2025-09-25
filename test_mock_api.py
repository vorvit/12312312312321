import requests
import json

# Test mock API endpoint
try:
    token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzIiwiZXhwIjoxNzU4Nzk1MzY2fQ.RmD74J7iicRo0Kfh1bbvVNqW3_ilacpeF1ySRIZzPi0'
    
    print('Testing mock API endpoint...')
    response = requests.get('http://localhost:8000/api/mock/files', 
                          headers={'Authorization': f'Bearer {token}'}, 
                          timeout=5)
    print(f'Mock API status: {response.status_code}')
    print(f'Mock API response: {response.text[:500]}')
    
    if response.status_code == 200:
        data = response.json()
        files = data.get('data', [])
        print(f'Files found: {len(files)}')
        for file in files[:3]:  # Show first 3 files
            print(f'  - {file.get("name", "unknown")}')
    
except Exception as e:
    print(f'Error: {e}')
