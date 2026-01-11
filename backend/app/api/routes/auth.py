"""
Authentication API Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models import User
from app.schemas import (
    UserCreate, UserLogin, UserResponse, Token,
    ForgotPasswordRequest, VerifyOTPRequest, ResetPasswordRequest,
    RegisterResponse, VerifyRegisterOTPRequest
)
from app.services.email import email_service
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=RegisterResponse)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user - sends OTP for verification"""
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        if existing_user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        else:
            # User exists but not verified - resend OTP
            otp = email_service.generate_otp()
            existing_user.otp_code = otp
            existing_user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
            existing_user.password_hash = get_password_hash(user_data.password)
            existing_user.full_name = user_data.full_name
            db.commit()
            
            await email_service.send_otp_email(existing_user.email, otp, purpose="verify_email")
            
            return RegisterResponse(
                message="OTP đã được gửi đến email của bạn",
                email=existing_user.email,
                requires_otp=True
            )
    
    # Generate OTP for email verification
    otp = email_service.generate_otp()
    
    # Create new user (unverified)
    user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        is_verified=False,  # Requires OTP verification
        otp_code=otp,
        otp_expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Send OTP email
    await email_service.send_otp_email(user.email, otp, purpose="verify_email")
    
    return RegisterResponse(
        message="OTP đã được gửi đến email của bạn",
        email=user.email,
        requires_otp=True
    )


@router.post("/verify-register", response_model=Token)
async def verify_register_otp(request: VerifyRegisterOTPRequest, db: Session = Depends(get_db)):
    """Verify OTP and complete registration"""
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
    
    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified"
        )
    
    if not user.otp_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No OTP request found. Please register again."
        )
    
    if user.otp_code != request.otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code"
        )
    
    if user.otp_expires_at and user.otp_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please register again."
        )
    
    # Verify user
    user.is_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    
    db.commit()
    db.refresh(user)
    
    # Generate token
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return Token(
        access_token=access_token,
        user=UserResponse.model_validate(user)
    )


@router.post("/resend-otp")
async def resend_otp(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Resend OTP for registration verification"""
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
    
    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified"
        )
    
    # Generate new OTP
    otp = email_service.generate_otp()
    user.otp_code = otp
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    db.commit()
    
    await email_service.send_otp_email(user.email, otp, purpose="verify_email")
    
    return {"message": "OTP đã được gửi lại"}


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Login with email and password"""
    user = db.query(User).filter(User.email == credentials.email).first()
    
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email first."
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return Token(
        access_token=access_token,
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    return current_user


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Request password reset OTP"""
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user:
        # Don't reveal if email exists or not
        return {"message": "If the email exists, an OTP has been sent"}
    
    # Generate OTP
    otp = email_service.generate_otp()
    user.otp_code = otp
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    db.commit()
    
    # Send OTP email
    await email_service.send_otp_email(user.email, otp, purpose="password_reset")
    
    return {"message": "If the email exists, an OTP has been sent"}


@router.post("/verify-otp")
async def verify_otp(request: VerifyOTPRequest, db: Session = Depends(get_db)):
    """Verify OTP code"""
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user or not user.otp_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP request"
        )
    
    if user.otp_code != request.otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code"
        )
    
    if user.otp_expires_at and user.otp_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired"
        )
    
    return {"message": "OTP verified successfully", "valid": True}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password with verified OTP"""
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user or not user.otp_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request"
        )
    
    if user.otp_code != request.otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code"
        )
    
    if user.otp_expires_at and user.otp_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired"
        )
    
    # Update password
    user.password_hash = get_password_hash(request.new_password)
    user.otp_code = None
    user.otp_expires_at = None
    
    db.commit()
    
    return {"message": "Password reset successfully"}
