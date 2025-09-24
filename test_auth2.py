import requests
import json

# Test different passwords
passwords = ["password123", "password", "123456", "admin", "test"]

for password in passwords:
    login_data = {
        "email": "vorvit@bk.ru",
        "password": password
    }
    
    response = requests.post("http://localhost:8000/auth/login", json=login_data)
    print(f"Password '{password}': {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('access_token'):
            print(f"SUCCESS! Token: {data['access_token'][:20]}...")
            break
    else:
        print(f"Failed: {response.json()}")
