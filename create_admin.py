#!/usr/bin/env python3
"""
Script to create the first admin user
"""
import sys
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models.user import User
from app.auth.auth import AuthService

def create_admin():
    """Create the first admin user"""
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Create database session
    db = SessionLocal()
    
    try:
        # Check if admin already exists
        admin = db.query(User).filter(User.is_admin == True).first()
        if admin:
            print(f"Admin user already exists: {admin.username} ({admin.email})")
            return
        
        # Create admin user
        admin_data = {
            "email": "admin@ifc.com",
            "username": "admin",
            "password": "admin123",
            "full_name": "System Administrator"
        }
        
        hashed_password = AuthService.get_password_hash(admin_data["password"])
        
        admin_user = User(
            email=admin_data["email"],
            username=admin_data["username"],
            hashed_password=hashed_password,
            full_name=admin_data["full_name"],
            is_admin=True,
            is_active=True
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print("✅ Admin user created successfully!")
        print(f"   Email: {admin_user.email}")
        print(f"   Username: {admin_user.username}")
        print(f"   Password: {admin_data['password']}")
        print("\n⚠️  Please change the password after first login!")
        
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("Creating admin user...")
    create_admin()
