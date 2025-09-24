import requests
import json

# Get CSRF token
response = requests.get("http://localhost:8000/auth/csrf")
print("CSRF response:", response.status_code)
print("CSRF data:", response.json())

if response.status_code == 200:
    data = response.json()
    csrf_token = data.get('csrf_token')
    print(f"CSRF Token: {csrf_token}")
    
    # Test login with CSRF
    login_data = {
        "email": "vorvit@bk.ru",
        "password": "password123"
    }
    
    headers = {
        "X-CSRF-Token": csrf_token,
        "Content-Type": "application/json"
    }
    
    # Set cookies
    cookies = response.cookies
    
    login_response = requests.post("http://localhost:8000/auth/login", json=login_data, headers=headers, cookies=cookies)
    print("Login response:", login_response.status_code)
    print("Login data:", login_response.json())
else:
    print("CSRF token request failed")