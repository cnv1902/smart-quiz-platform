"""
File Upload API - AWS S3 Integration with Smart Folder Organization

Migrated from Google Drive to AWS S3.
Files are organized into topic-based folders.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models import User
from app.services.s3_service import get_s3_service, slugify


router = APIRouter()


class FileUploadResponse(BaseModel):
    """Response model for file upload"""
    file_id: str
    filename: str
    web_view_link: Optional[str] = None
    web_content_link: Optional[str] = None
    message: str


class FileInfoResponse(BaseModel):
    """Response model for file info"""
    file_id: str
    filename: str
    mime_type: str
    size: Optional[int] = None
    web_view_link: Optional[str] = None
    web_content_link: Optional[str] = None
    created_time: Optional[str] = None


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    topic_name: str = Form(default="general"),
    current_user: User = Depends(get_current_user)
):
    """
    Upload file to AWS S3 with Smart Folder Organization.
    
    Files are organized into topic-based folders:
    - topic_name: "Toán Cao Cấp" -> S3 folder: "toan-cao-cap/"
    - S3 Key format: {topic_slug}/{filename}
    
    Features:
    - Chỉ giáo viên mới có thể upload
    - File được tổ chức theo topic/folder trên S3
    - File có thể truy cập bằng link công khai (ACL: public-read)
    """
    # Check if user is teacher
    if current_user.role != "teacher":
        raise HTTPException(
            status_code=403,
            detail="Chỉ giáo viên mới có quyền upload file"
        )
    
    try:
        # Read file content
        content = await file.read()
        
        # Generate topic slug for folder name
        topic_slug = slugify(topic_name) if topic_name else "general"
        
        # Upload to AWS S3 with folder structure
        s3_service = get_s3_service()
        result = s3_service.upload_file_simple(
            file_content=content,
            filename=file.filename or 'untitled',
            topic_name=topic_name,
            content_type=file.content_type or 'application/octet-stream'
        )
        
        return FileUploadResponse(
            file_id=result['file_id'],
            filename=result['filename'],
            web_view_link=result.get('web_view_link'),
            web_content_link=result.get('web_view_link'),  # S3 uses same link
            message=f"Upload thành công vào folder: {result['topic_slug']}"
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Upload file thất bại: {str(e)}"
        )


@router.get("/info/{file_id}", response_model=FileInfoResponse)
async def get_file_info(
    file_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Lấy thông tin file từ S3
    
    NOTE: S3 không lưu metadata chi tiết như Google Drive.
    Sử dụng database Resource table để tracking.
    """
    raise HTTPException(
        status_code=501,
        detail="Chức năng này chưa được triển khai. Sử dụng /admin/resources để xem thông tin file."
    )


@router.delete("/{s3_key:path}")
async def delete_file(
    s3_key: str,
    current_user: User = Depends(get_current_user)
):
    """
    Xóa file từ AWS S3
    
    Args:
        s3_key: Full S3 key (e.g., "toan-cao-cap/file.pdf")
    """
    if current_user.role != "teacher":
        raise HTTPException(
            status_code=403,
            detail="Chỉ giáo viên mới có quyền xóa file"
        )
    
    try:
        s3_service = get_s3_service()
        s3_service.s3_client.delete_object(
            Bucket=s3_service.bucket_name,
            Key=s3_key
        )
        return {"message": f"Đã xóa file: {s3_key}"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Xóa file thất bại: {str(e)}"
        )
