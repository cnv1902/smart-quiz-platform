"""
Email Service using Brevo API
Handles OTP sending for password reset and class invitations
"""
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
from app.core.config import settings
import random
import string
from typing import Optional


class EmailService:
    def __init__(self):
        if settings.brevo_api_key:
            configuration = sib_api_v3_sdk.Configuration()
            configuration.api_key['api-key'] = settings.brevo_api_key
            self.api_instance = sib_api_v3_sdk.TransactionalEmailsApi(
                sib_api_v3_sdk.ApiClient(configuration)
            )
        else:
            self.api_instance = None
    
    def generate_otp(self, length: int = 6) -> str:
        """Generate a random OTP code"""
        return ''.join(random.choices(string.digits, k=length))
    
    def generate_verification_token(self) -> str:
        """Generate a random verification token"""
        return ''.join(random.choices(string.ascii_letters + string.digits, k=32))
    
    async def send_otp_email(self, to_email: str, otp: str, purpose: str = "verification") -> bool:
        """
        Send OTP email for verification or password reset
        
        Args:
            to_email: Recipient email address
            otp: The OTP code to send
            purpose: Either 'verification' or 'password_reset'
        """
        if not self.api_instance:
            print(f"[DEV MODE] OTP for {to_email}: {otp}")
            return True
        
        subject = "Mã xác thực - Smart Quiz Platform"
        if purpose == "password_reset":
            subject = "Đặt lại mật khẩu - Smart Quiz Platform"
            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <h1 style="color: #0EA5E9; margin-bottom: 20px;">Đặt lại mật khẩu</h1>
                    <p style="color: #334155; font-size: 16px;">Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản Smart Quiz Platform.</p>
                    <p style="color: #334155; font-size: 16px;">Mã xác thực của bạn là:</p>
                    <div style="background: #f1f5f9; border: 2px solid #0EA5E9; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: bold; color: #0EA5E9; letter-spacing: 8px;">{otp}</span>
                    </div>
                    <p style="color: #64748b; font-size: 14px;">Mã này sẽ hết hạn sau 10 phút.</p>
                    <p style="color: #64748b; font-size: 14px;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
                </div>
            </body>
            </html>
            """
        else:
            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <h1 style="color: #0EA5E9; margin-bottom: 20px;">Xác thực email</h1>
                    <p style="color: #334155; font-size: 16px;">Chào mừng bạn đến với Smart Quiz Platform!</p>
                    <p style="color: #334155; font-size: 16px;">Mã xác thực của bạn là:</p>
                    <div style="background: #f1f5f9; border: 2px solid #0EA5E9; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: bold; color: #0EA5E9; letter-spacing: 8px;">{otp}</span>
                    </div>
                    <p style="color: #64748b; font-size: 14px;">Mã này sẽ hết hạn sau 10 phút.</p>
                </div>
            </body>
            </html>
            """
        
        return await self._send_email(to_email, subject, html_content)
    
    async def send_class_invitation(
        self, 
        to_email: str, 
        class_name: str, 
        teacher_name: str,
        verification_link: str
    ) -> bool:
        """
        Send class invitation email
        
        Args:
            to_email: Student's email
            class_name: Name of the class
            teacher_name: Teacher's name
            verification_link: Link to verify and join the class
        """
        if not self.api_instance:
            print(f"[DEV MODE] Class invitation for {to_email}: {verification_link}")
            return True
        
        subject = f"Lời mời tham gia lớp học: {class_name} - Smart Quiz Platform"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h1 style="color: #0EA5E9; margin-bottom: 20px;">Lời mời tham gia lớp học</h1>
                <p style="color: #334155; font-size: 16px;">Xin chào!</p>
                <p style="color: #334155; font-size: 16px;">
                    <strong>{teacher_name}</strong> đã mời bạn tham gia lớp học 
                    <strong style="color: #0EA5E9;">{class_name}</strong> trên Smart Quiz Platform.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{verification_link}" 
                       style="background: #0EA5E9; color: white; padding: 14px 28px; 
                              text-decoration: none; border-radius: 6px; font-weight: bold;
                              display: inline-block;">
                        Tham gia lớp học
                    </a>
                </div>
                <p style="color: #64748b; font-size: 14px;">
                    Hoặc copy link sau vào trình duyệt:<br>
                    <a href="{verification_link}" style="color: #0EA5E9;">{verification_link}</a>
                </p>
                <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
                    Link này sẽ hết hạn sau 7 ngày.
                </p>
            </div>
        </body>
        </html>
        """
        
        return await self._send_email(to_email, subject, html_content)
    
    async def _send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Internal method to send email via Brevo"""
        try:
            send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
                to=[{"email": to_email}],
                sender={
                    "email": settings.brevo_sender_email,
                    "name": settings.brevo_sender_name
                },
                subject=subject,
                html_content=html_content
            )
            
            self.api_instance.send_transac_email(send_smtp_email)
            return True
            
        except ApiException as e:
            print(f"Email send error: {e}")
            return False
        except Exception as e:
            print(f"Email error: {e}")
            return False


# Singleton instance
email_service = EmailService()
