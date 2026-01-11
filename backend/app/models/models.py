"""
Database Models for Smart Quiz Platform
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(String(20), default="user")  # 'admin' or 'user'
    is_verified = Column(Boolean, default=False)  # Email verified via OTP
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # OTP for verification/password reset
    otp_code = Column(String(6), nullable=True)
    otp_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    classes = relationship("Class", back_populates="teacher")
    exams = relationship("Exam", back_populates="creator")
    exam_results = relationship("ExamResult", back_populates="user")


class Class(Base):
    __tablename__ = "classes"
    
    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    teacher_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    teacher = relationship("User", back_populates="classes")
    students = relationship("ClassStudent", back_populates="class_", cascade="all, delete-orphan")
    exam_assignments = relationship("ExamClassAssignment", back_populates="class_", cascade="all, delete-orphan")


class ClassStudent(Base):
    __tablename__ = "class_students"
    
    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    class_id = Column(String(36), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    student_email = Column(String(255), nullable=False)
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String(255), nullable=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    class_ = relationship("Class", back_populates="students")


class Exam(Base):
    __tablename__ = "exams"
    
    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    public_id = Column(String(36), unique=True, default=generate_uuid, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    creator_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    # Configuration
    mode = Column(String(20), default="test")  # 'practice' or 'test'
    shuffle_questions = Column(Boolean, default=False)
    shuffle_answers = Column(Boolean, default=False)
    time_limit = Column(Integer, nullable=True)  # minutes
    password = Column(String(255), nullable=True)
    is_public = Column(Boolean, default=False)
    
    # Questions stored as JSONB
    questions = Column(JSON, nullable=False, default=list)
    
    # Stats
    total_attempts = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    creator = relationship("User", back_populates="exams")
    results = relationship("ExamResult", back_populates="exam", cascade="all, delete-orphan")
    class_assignments = relationship("ExamClassAssignment", back_populates="exam", cascade="all, delete-orphan")
    email_whitelist = relationship("ExamEmailWhitelist", back_populates="exam", cascade="all, delete-orphan")


class ExamClassAssignment(Base):
    __tablename__ = "exam_class_assignments"
    
    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    exam_id = Column(String(36), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    class_id = Column(String(36), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    exam = relationship("Exam", back_populates="class_assignments")
    class_ = relationship("Class", back_populates="exam_assignments")


class ExamEmailWhitelist(Base):
    __tablename__ = "exam_email_whitelist"
    
    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    exam_id = Column(String(36), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), nullable=False)
    added_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    exam = relationship("Exam", back_populates="email_whitelist")


class ExamResult(Base):
    __tablename__ = "exam_results"
    
    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    exam_id = Column(String(36), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    guest_email = Column(String(255), nullable=True)  # For non-logged users
    guest_name = Column(String(255), nullable=True)
    
    score = Column(Float, nullable=False)  # 0-10 scale
    correct_count = Column(Integer, nullable=False)
    total_questions = Column(Integer, nullable=False)
    time_taken = Column(Integer, nullable=True)  # seconds
    
    # Detailed answers
    answers = Column(JSON, nullable=True)
    
    completed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    exam = relationship("Exam", back_populates="results")
    user = relationship("User", back_populates="exam_results")


class ExamAccess(Base):
    """Track exam access for 24h traffic stats"""
    __tablename__ = "exam_accesses"
    
    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    exam_id = Column(String(36), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    accessed_at = Column(DateTime(timezone=True), server_default=func.now())
    ip_address = Column(String(50), nullable=True)
