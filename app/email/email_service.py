import asyncio
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import settings
import logging

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.smtp_server = settings.MAIL_SERVER
        self.smtp_port = settings.MAIL_PORT
        self.username = settings.MAIL_USERNAME
        self.password = settings.MAIL_PASSWORD
        self.from_email = settings.MAIL_FROM
        self.from_name = settings.MAIL_FROM_NAME

    async def send_email(self, to_email: str, subject: str, body: str, is_html: bool = False):
        """Send email using SMTP"""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            msg['Subject'] = subject

            # Add body
            if is_html:
                msg.attach(MIMEText(body, 'html'))
            else:
                msg.attach(MIMEText(body, 'plain'))

            # Send email
            await aiosmtplib.send(
                msg,
                hostname=self.smtp_server,
                port=self.smtp_port,
                username=self.username,
                password=self.password,
                use_tls=True
            )
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

    async def send_verification_email(self, to_email: str, token: str):
        """Send email verification email"""
        verification_url = f"{settings.BASE_URL}/verify-email?token={token}"
        
        subject = "Подтверждение email адреса"
        body = f"""
        Здравствуйте!
        
        Для подтверждения вашего email адреса перейдите по ссылке:
        {verification_url}
        
        Если вы не регистрировались на нашем сайте, проигнорируйте это письмо.
        
        С уважением,
        Команда IFC Auth Service
        """
        
        return await self.send_email(to_email, subject, body)

    async def send_password_reset_email(self, to_email: str, token: str):
        """Send password reset email"""
        reset_url = f"{settings.BASE_URL}/reset-password?token={token}"
        
        subject = "Восстановление пароля"
        body = f"""
        Здравствуйте!
        
        Для восстановления пароля перейдите по ссылке:
        {reset_url}
        
        Если вы не запрашивали восстановление пароля, проигнорируйте это письмо.
        
        С уважением,
        Команда IFC Auth Service
        """
        
        return await self.send_email(to_email, subject, body)

    # --- Compatibility wrappers used by main.py ---
    async def send_welcome_email(self, email: str, username: str, password: str, background_tasks):
        subject = "Welcome to IFC Auth Service!"
        body = f"""
        Hello {username},\n\nYour account was created.\nEmail: {email}\nPassword: {password}\n\nPlease change your password after first login.
        """
        return await self.send_email(email, subject, body)

    async def send_email_verification(self, email: str, username: str, verification_token: str, background_tasks):
        return await self.send_verification_email(email, verification_token)

    async def send_password_reset(self, email: str, username: str, reset_token: str, background_tasks):
        return await self.send_password_reset_email(email, reset_token)

# Create global instance
email_service = EmailService()