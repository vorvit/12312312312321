from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from fastapi import BackgroundTasks
from typing import List, Optional
import os
from config import settings

# Email configuration
mail_config = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME", "your-email@gmail.com"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD", "your-app-password"),
    MAIL_FROM=os.getenv("MAIL_FROM", "noreply@ifc-auth.com"),
    MAIL_FROM_NAME=os.getenv("MAIL_FROM_NAME", "IFC Auth Service"),
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",  # Change to your SMTP server
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

class EmailService:
    def __init__(self):
        self.fastmail = FastMail(mail_config)
    
    async def send_email(
        self, 
        subject: str, 
        recipients: List[str], 
        body: str, 
        background_tasks: BackgroundTasks
    ):
        """Send email"""
        # Demo mode - log to console instead of sending real emails
        print(f'📧 EMAIL DEMO: {subject}')
        print(f'   To: {", ".join(recipients)}')
        print(f'   Body preview: {body[:200]}...')
        print(f'   (In production, this would be sent via SMTP)')
        print('=' * 50)
        
        # Uncomment below for real email sending (after setting up SMTP)
        # message = MessageSchema(
        #     subject=subject,
        #     recipients=recipients,
        #     body=body,
        #     subtype="html"
        # )
        # 
        # background_tasks.add_task(self.fastmail.send_message, message)
    
    async def send_welcome_email(
        self, 
        email: str, 
        username: str, 
        password: str,
        background_tasks: BackgroundTasks
    ):
        """Send welcome email with credentials"""
        subject = "Welcome to IFC Auth Service! 🎉"
        
        body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                .credentials {{ background: #e8f4fd; border: 1px solid #bee5eb; border-radius: 8px; padding: 20px; margin: 20px 0; }}
                .button {{ background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }}
                .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎉 Welcome to IFC Auth Service!</h1>
                    <p>Your account has been successfully created</p>
                </div>
                <div class="content">
                    <h2>Hello {username}!</h2>
                    <p>Thank you for registering with IFC Auth Service. We're excited to have you on board!</p>
                    
                    <div class="credentials">
                        <h3>🔐 Your Login Credentials:</h3>
                        <p><strong>Email:</strong> {email}</p>
                        <p><strong>Password:</strong> {password}</p>
                        <p><em>Please save these credentials in a secure place.</em></p>
                    </div>
                    
                    <h3>🚀 What's Next?</h3>
                    <ul>
                        <li>Log in to your dashboard</li>
                        <li>Upload and manage your IFC files</li>
                        <li>Access your personal storage space</li>
                        <li>Explore our admin features (if applicable)</li>
                    </ul>
                    
                    <p>
                        <a href="http://localhost:8000/login" class="button">Login to Dashboard</a>
                    </p>
                    
                    <h3>🔒 Security Tips:</h3>
                    <ul>
                        <li>Change your password after first login</li>
                        <li>Use a strong, unique password</li>
                        <li>Enable two-factor authentication if available</li>
                        <li>Never share your credentials</li>
                    </ul>
                </div>
                <div class="footer">
                    <p>If you have any questions, feel free to contact our support team.</p>
                    <p>© 2024 IFC Auth Service. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        await self.send_email(subject, [email], body, background_tasks)
    
    async def send_email_verification(
        self, 
        email: str, 
        username: str, 
        verification_token: str,
        background_tasks: BackgroundTasks
    ):
        """Send email verification"""
        subject = "Verify Your Email Address - IFC Auth Service"
        verification_url = f"http://localhost:8000/verify-email?token={verification_token}"
        
        body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                .button {{ background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; font-weight: bold; }}
                .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📧 Verify Your Email Address</h1>
                    <p>Almost there! Just one more step to complete your registration.</p>
                </div>
                <div class="content">
                    <h2>Hello {username}!</h2>
                    <p>Thank you for registering with IFC Auth Service. To complete your registration and activate your account, please verify your email address.</p>
                    
                    <p style="text-align: center;">
                        <a href="{verification_url}" class="button">Verify Email Address</a>
                    </p>
                    
                    <p><strong>Or copy and paste this link into your browser:</strong></p>
                    <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace;">
                        {verification_url}
                    </p>
                    
                    <h3>⏰ Important:</h3>
                    <ul>
                        <li>This verification link will expire in 24 hours</li>
                        <li>If you didn't create an account, please ignore this email</li>
                        <li>For security reasons, don't share this link with anyone</li>
                    </ul>
                </div>
                <div class="footer">
                    <p>If you have any questions, feel free to contact our support team.</p>
                    <p>© 2024 IFC Auth Service. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        await self.send_email(subject, [email], body, background_tasks)
    
    async def send_password_reset(
        self, 
        email: str, 
        username: str, 
        reset_token: str,
        background_tasks: BackgroundTasks
    ):
        """Send password reset email"""
        subject = "Reset Your Password - IFC Auth Service"
        reset_url = f"http://localhost:8000/reset-password?token={reset_token}"
        
        body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                .button {{ background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; font-weight: bold; }}
                .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 14px; }}
                .warning {{ background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔒 Password Reset Request</h1>
                    <p>Someone requested to reset your password</p>
                </div>
                <div class="content">
                    <h2>Hello {username}!</h2>
                    <p>We received a request to reset the password for your IFC Auth Service account.</p>
                    
                    <p style="text-align: center;">
                        <a href="{reset_url}" class="button">Reset My Password</a>
                    </p>
                    
                    <p><strong>Or copy and paste this link into your browser:</strong></p>
                    <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace;">
                        {reset_url}
                    </p>
                    
                    <div class="warning">
                        <h3>⚠️ Security Notice:</h3>
                        <ul>
                            <li>This link will expire in 1 hour for security</li>
                            <li>If you didn't request this reset, please ignore this email</li>
                            <li>Your password won't change until you click the link above</li>
                            <li>For your security, don't share this link with anyone</li>
                        </ul>
                    </div>
                    
                    <h3>🔐 If you didn't request this:</h3>
                    <p>If you didn't request a password reset, you can safely ignore this email. Your account remains secure.</p>
                </div>
                <div class="footer">
                    <p>If you have any questions, feel free to contact our support team.</p>
                    <p>© 2024 IFC Auth Service. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        await self.send_email(subject, [email], body, background_tasks)

# Global email service instance
email_service = EmailService()
