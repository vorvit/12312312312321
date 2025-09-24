#!/usr/bin/env python3
"""
Script to create a test user
"""
import sys
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models.user import User
from app.auth.auth import AuthService

def create_test_user():
    """Create a test user"""
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Create database session
    db = SessionLocal()
    
    try:
        # Check if user already exists
        user = db.query(User).filter(User.email == "vorvit@bk.ru").first()
        if user:
            print(f"User already exists: {user.username} ({user.email})")
            # Update password
            user.hashed_password = AuthService.get_password_hash("password123")
            db.commit()
            print("✅ Password updated!")
            return
        
        # Create test user
        user_data = {
            "email": "vorvit@bk.ru",
            "username": "vorvit",
            "password": "password123",
            "full_name": "Test User"
        }
        
        hashed_password = AuthService.get_password_hash(user_data["password"])
        
        test_user = User(
            email=user_data["email"],
            username=user_data["username"],
            hashed_password=hashed_password,
            full_name=user_data["full_name"],
            is_admin=True,
            is_active=True
        )
        
        db.add(test_user)
        db.commit()
        db.refresh(test_user)
        
        print("✅ Test user created successfully!")
        print(f"   Email: {test_user.email}")
        print(f"   Username: {test_user.username}")
        print(f"   Password: {user_data['password']}")
        
    except Exception as e:
        print(f"❌ Error creating test user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("Creating test user...")
    create_test_user()
