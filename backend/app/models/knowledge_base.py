"""
Knowledge Base Models - Topic-based file organization
"""
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import uuid
import enum


def generate_uuid():
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
    """User roles for access control"""
    ADMIN = "admin"
    STUDENT = "student"


class KBUser(Base):
    """
    Knowledge Base User with role-based access.
    Separate from quiz User to avoid conflicts.
    """
    __tablename__ = "kb_users"
    
    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(String(20), default=UserRole.STUDENT.value, nullable=False)  # 'admin' or 'student'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Topic(Base):
    """
    Topic/Folder for organizing resources.
    Each topic maps to an S3 folder structure.
    
    S3 Structure: {category_slug}/{topic_slug}/
    Example: kinh-te/kinh-te-vi-mo/
    """
    __tablename__ = "topics"
    
    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    name = Column(String(255), nullable=False)  # Display name: "Kinh Tế Vi Mô"
    slug = Column(String(255), unique=True, nullable=False, index=True)  # S3 folder: "kinh-te-vi-mo"
    category = Column(String(255), nullable=True)  # Category name: "Kinh Tế"
    category_slug = Column(String(255), nullable=True, index=True)  # Category folder: "kinh-te"
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    resources = relationship("Resource", back_populates="topic", cascade="all, delete-orphan")
    
    @property
    def file_count(self) -> int:
        """Get number of files in this topic"""
        return len(self.resources) if self.resources else 0
    
    @property
    def s3_prefix(self) -> str:
        """Get full S3 prefix path for this topic"""
        if self.category_slug:
            return f"{self.category_slug}/{self.slug}"
        return self.slug


class Resource(Base):
    """
    File resource stored in S3, organized by Topic.
    S3 key format: {topic_slug}/{sanitized_filename}
    """
    __tablename__ = "resources"
    
    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    topic_id = Column(String(36), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # File info
    file_name = Column(String(255), nullable=False)  # Original filename
    s3_key = Column(String(512), unique=True, nullable=False)  # Full S3 path: topic-slug/filename.pdf
    s3_url = Column(String(1024), nullable=False)  # Public URL
    
    # Metadata
    content_type = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=True)  # bytes
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    uploaded_by = Column(String(36), nullable=True)  # User ID who uploaded
    
    # Relationships
    topic = relationship("Topic", back_populates="resources")
