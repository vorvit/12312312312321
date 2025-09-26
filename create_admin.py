#!/usr/bin/env python3
"""
Interactive script to create or promote an admin user.
Uses existing SQLAlchemy session and AuthService password hashing.
"""

import sys
import getpass
from typing import Optional

from app.database import SessionLocal
from app.models.user import User
from app.auth.auth import AuthService


def prompt_non_empty(prompt: str, secret: bool = False) -> str:
    while True:
        try:
            value = getpass.getpass(prompt) if secret else input(prompt)
        except EOFError:
            print("\nAborted.")
            sys.exit(1)
        value = (value or "").strip()
        if value:
            return value
        print("Value cannot be empty.")


def find_user_by_email_or_username(db, email_or_username: str) -> Optional[User]:
    user = db.query(User).filter(User.email == email_or_username).first()
    if user:
        return user
    return db.query(User).filter(User.username == email_or_username).first()


def create_or_promote_admin():
    print("\n=== Admin creation ===")
    print("You can enter an existing email/username to promote, or new credentials.")

    db = SessionLocal()
    try:
        identifier = prompt_non_empty("Email or username: ")
        user = find_user_by_email_or_username(db, identifier)

        if user:
            print(f"Found user: id={user.id}, username={user.username}, email={user.email}, admin={user.is_admin}")
            if not user.is_admin:
                user.is_admin = True
                user.is_active = True
                db.commit()
                print("✅ User promoted to admin.")
            else:
                print("ℹ️  User is already admin.")

            change_pwd = input("Change password? [y/N]: ").strip().lower() in {"y", "yes"}
            if change_pwd:
                pwd = prompt_non_empty("New password: ", secret=True)
                confirm = prompt_non_empty("Confirm password: ", secret=True)
                if pwd != confirm:
                    print("❌ Passwords do not match. Aborting.")
                    return
                user.hashed_password = AuthService.get_password_hash(pwd)
                db.commit()
                print("✅ Password updated.")
            return

        # Create new user
        print("No existing user found. Creating a new admin user.")
        email = identifier if "@" in identifier else prompt_non_empty("Email: ")
        username = identifier if "@" not in identifier else prompt_non_empty("Username: ")

        # Ensure uniqueness
        if db.query(User).filter(User.email == email).first():
            print("❌ Email already exists. Aborting.")
            return
        if db.query(User).filter(User.username == username).first():
            print("❌ Username already exists. Aborting.")
            return

        password = prompt_non_empty("Password: ", secret=True)
        confirm = prompt_non_empty("Confirm password: ", secret=True)
        if password != confirm:
            print("❌ Passwords do not match. Aborting.")
            return

        hashed_password = AuthService.get_password_hash(password)
        new_user = User(
            email=email,
            username=username,
            hashed_password=hashed_password,
            is_active=True,
            is_admin=True,
            is_email_verified=True,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        print(f"✅ Admin created: id={new_user.id}, username={new_user.username}, email={new_user.email}")

    finally:
        db.close()


if __name__ == "__main__":
    try:
        create_or_promote_admin()
    except KeyboardInterrupt:
        print("\nAborted by user.")
        sys.exit(1)


