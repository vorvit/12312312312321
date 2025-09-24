import requests
import json

# Test login with new user
login_data = {
    "email": "newuser@test.com",
    "password": "password123"
}

response = requests.post("http://localhost:8000/auth/login", json=login_data)
print("Login response:", response.status_code)
print("Login data:", response.json())

if response.status_code == 200:
    data = response.json()
    if data.get('access_token'):
        token = data['access_token']
        print(f"Token: {token[:20]}...")
        
        # Test files API
        headers = {"Authorization": f"Bearer {token}"}
        files_response = requests.get("http://localhost:8000/api/files", headers=headers)
        print("Files response:", files_response.status_code)
        print("Files data:", files_response.json())
    else:
        print("No access token in response")
else:
    print("Login failed")