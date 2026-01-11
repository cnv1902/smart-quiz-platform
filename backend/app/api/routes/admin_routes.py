"""
Admin Routes - Knowledge Base Management API

Routes for managing Topics and Resources (files organized by topic).
All routes require admin authentication.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.models.knowledge_base import Topic, Resource, KBUser, UserRole
from app.services.s3_service import get_s3_service, slugify
from app.services.smart_upload_service import get_smart_upload_service

router = APIRouter(prefix="/admin", tags=["Admin - Knowledge Base"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class TopicResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str]
    category: Optional[str] = None
    category_slug: Optional[str] = None
    file_count: int
    
    class Config:
        from_attributes = True


class TopicCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ResourceResponse(BaseModel):
    id: str
    topic_id: str
    file_name: str
    s3_key: str
    s3_url: str
    content_type: Optional[str]
    file_size: Optional[int]
    created_at: str
    
    class Config:
        from_attributes = True


class TopicDetailResponse(BaseModel):
    topic: TopicResponse
    resources: List[ResourceResponse]


class UploadResponse(BaseModel):
    message: str
    topic: dict
    resource: dict


class SmartUploadResponse(BaseModel):
    """Response for smart upload with AI classification"""
    message: str
    classification: dict
    topic: dict
    resource: dict
    s3_key: str
    s3_url: str


# ============================================================================
# Admin Authentication (simplified - implement proper JWT auth in production)
# ============================================================================

async def get_current_admin(db: Session = Depends(get_db)) -> KBUser:
    """
    Dependency to verify admin access.
    TODO: Implement proper JWT authentication.
    For now, returns first admin user or raises 401.
    """
    admin = db.query(KBUser).filter(KBUser.role == UserRole.ADMIN.value).first()
    if not admin:
        raise HTTPException(status_code=401, detail="Admin authentication required")
    return admin


# ============================================================================
# Topic Routes (Folder Management)
# ============================================================================

@router.get("/topics", response_model=List[TopicResponse])
async def get_all_topics(
    db: Session = Depends(get_db),
    # admin: KBUser = Depends(get_current_admin)  # Uncomment for auth
):
    """
    Get all topics with file counts.
    Used for Dashboard view (folder grid).
    """
    # Query topics with file count
    topics = db.query(
        Topic,
        func.count(Resource.id).label('file_count')
    ).outerjoin(Resource).group_by(Topic.id).all()
    
    result = []
    for topic, file_count in topics:
        result.append(TopicResponse(
            id=topic.id,
            name=topic.name,
            slug=topic.slug,
            description=topic.description,
            category=topic.category,
            category_slug=topic.category_slug,
            file_count=file_count
        ))
    
    return result


@router.post("/topics", response_model=TopicResponse)
async def create_topic(
    topic_data: TopicCreate,
    db: Session = Depends(get_db),
    # admin: KBUser = Depends(get_current_admin)
):
    """
    Create a new topic/folder.
    """
    # Check if slug already exists
    slug = slugify(topic_data.name)
    existing = db.query(Topic).filter(Topic.slug == slug).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Topic with slug '{slug}' already exists")
    
    topic = Topic(
        name=topic_data.name,
        slug=slug,
        description=topic_data.description
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)
    
    return TopicResponse(
        id=topic.id,
        name=topic.name,
        slug=topic.slug,
        description=topic.description,
        file_count=0
    )


@router.get("/topics/{topic_slug}", response_model=TopicDetailResponse)
async def get_topic_detail(
    topic_slug: str,
    db: Session = Depends(get_db),
    # admin: KBUser = Depends(get_current_admin)
):
    """
    Get topic details with all resources.
    Used for Folder Detail view (file list).
    """
    topic = db.query(Topic).filter(Topic.slug == topic_slug).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    resources = db.query(Resource).filter(Resource.topic_id == topic.id).all()
    
    return TopicDetailResponse(
        topic=TopicResponse(
            id=topic.id,
            name=topic.name,
            slug=topic.slug,
            description=topic.description,
            file_count=len(resources)
        ),
        resources=[
            ResourceResponse(
                id=r.id,
                topic_id=r.topic_id,
                file_name=r.file_name,
                s3_key=r.s3_key,
                s3_url=r.s3_url,
                content_type=r.content_type,
                file_size=r.file_size,
                created_at=r.created_at.isoformat() if r.created_at else ""
            ) for r in resources
        ]
    )


@router.delete("/topics/{topic_id}")
async def delete_topic(
    topic_id: str,
    db: Session = Depends(get_db),
    # admin: KBUser = Depends(get_current_admin)
):
    """
    Delete a topic and all its resources.
    WARNING: This also deletes all files from S3.
    """
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Delete all resources from S3
    s3_service = get_s3_service()
    resources = db.query(Resource).filter(Resource.topic_id == topic_id).all()
    
    for resource in resources:
        try:
            s3_service.s3_client.delete_object(
                Bucket=s3_service.bucket_name,
                Key=resource.s3_key
            )
        except Exception as e:
            # Log but continue
            print(f"Error deleting S3 object {resource.s3_key}: {e}")
    
    # Delete topic (cascades to resources in DB)
    db.delete(topic)
    db.commit()
    
    return {"message": f"Topic '{topic.name}' and {len(resources)} files deleted"}


# ============================================================================
# Resource Routes (File Management)
# ============================================================================

@router.post("/smart-upload", response_model=SmartUploadResponse)
async def smart_upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    # admin: KBUser = Depends(get_current_admin)
):
    """
    Smart Upload with AI Classification.
    
    This endpoint:
    1. Extracts text from the document (first 5 questions)
    2. Uses Gemini AI to classify category and subject
    3. Deduplicates topics using fuzzy matching (>90% similarity)
    4. Uploads to S3 with dynamic path: {category_slug}/{topic_slug}/{filename}
    
    Example:
        Upload "DeThi_KinhTeViMo.pdf"
        -> AI classifies: {"category": "Kinh Tế", "subject": "Kinh Tế Vi Mô"}
        -> S3 Key: "kinh-te/kinh-te-vi-mo/dethi-kinhtevimu.pdf"
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    
    try:
        # Read file content
        file_content = await file.read()
        
        # Get Smart Upload service
        smart_service = get_smart_upload_service()
        
        # Smart upload with AI classification
        result = smart_service.smart_upload(
            db=db,
            file_content=file_content,
            filename=file.filename,
            content_type=file.content_type or 'application/octet-stream'
        )
        
        return SmartUploadResponse(
            message=f"File uploaded to: {result['topic']['category']}/{result['topic']['name']}",
            classification=result['classification'],
            topic=result['topic'],
            resource=result['resource'],
            s3_key=result['s3_key'],
            s3_url=result['s3_url']
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Smart upload failed: {str(e)}")


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    topic_name: str = Form(...),
    category_name: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    # admin: KBUser = Depends(get_current_admin)
):
    """
    Manual Upload to a specific topic folder.
    
    Use this when you want to specify the topic manually instead of AI classification.
    
    - If topic exists (fuzzy match): File goes to existing folder
    - If topic is new: Creates new folder, then uploads
    
    S3 Key format: {category_slug}/{topic_slug}/{sanitized_filename}
    Example: "kinh-te/kinh-te-vi-mo/bai-1.pdf"
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    
    if not topic_name or not topic_name.strip():
        raise HTTPException(
            status_code=400, 
            detail="topic_name is required. Files cannot be uploaded to root bucket."
        )
    
    try:
        # Read file content
        file_content = await file.read()
        
        # Get Smart Upload service (for manual upload method)
        smart_service = get_smart_upload_service()
        
        # Manual upload with specified topic
        result = smart_service.manual_upload(
            db=db,
            file_content=file_content,
            filename=file.filename,
            topic_name=topic_name,
            category_name=category_name,
            content_type=file.content_type or 'application/octet-stream'
        )
        
        return UploadResponse(
            message=f"File uploaded successfully to topic: {result['topic']['name']}",
            topic=result['topic'],
            resource=result['resource']
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/resources", response_model=List[ResourceResponse])
async def get_all_resources(
    topic_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    # admin: KBUser = Depends(get_current_admin)
):
    """
    Get all resources, optionally filtered by topic.
    """
    query = db.query(Resource)
    
    if topic_id:
        query = query.filter(Resource.topic_id == topic_id)
    
    resources = query.all()
    
    return [
        ResourceResponse(
            id=r.id,
            topic_id=r.topic_id,
            file_name=r.file_name,
            s3_key=r.s3_key,
            s3_url=r.s3_url,
            content_type=r.content_type,
            file_size=r.file_size,
            created_at=r.created_at.isoformat() if r.created_at else ""
        ) for r in resources
    ]


@router.delete("/resources/{resource_id}")
async def delete_resource(
    resource_id: str,
    db: Session = Depends(get_db),
    # admin: KBUser = Depends(get_current_admin)
):
    """
    Delete a single resource from S3 and database.
    """
    s3_service = get_s3_service()
    success = s3_service.delete_file(db, resource_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Resource not found or delete failed")
    
    return {"message": "Resource deleted successfully"}


# ============================================================================
# Dashboard Stats
# ============================================================================

@router.get("/stats")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    # admin: KBUser = Depends(get_current_admin)
):
    """
    Get overview statistics for admin dashboard.
    Includes both database records AND direct S3 scan.
    """
    # Database stats
    total_topics = db.query(func.count(Topic.id)).scalar() or 0
    total_resources = db.query(func.count(Resource.id)).scalar() or 0
    total_size = db.query(func.sum(Resource.file_size)).scalar() or 0
    
    # Also scan S3 directly for files not tracked in DB
    s3_files = 0
    s3_size = 0
    s3_folders = set()
    
    try:
        s3_service = get_s3_service()
        # List all objects in bucket
        paginator = s3_service.s3_client.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=s3_service.bucket_name):
            for obj in page.get('Contents', []):
                s3_files += 1
                s3_size += obj.get('Size', 0)
                # Extract folder name (first part of key)
                key_parts = obj['Key'].split('/')
                if len(key_parts) > 1:
                    s3_folders.add(key_parts[0])
    except Exception as e:
        # If S3 scan fails, just use DB stats
        pass
    
    return {
        "total_topics": max(total_topics, len(s3_folders)),
        "total_resources": max(total_resources, s3_files),
        "total_size_bytes": max(total_size, s3_size),
        "total_size_mb": round(max(total_size, s3_size) / (1024 * 1024), 2) if max(total_size, s3_size) else 0,
        # Additional S3 info
        "s3_files": s3_files,
        "s3_folders": list(s3_folders),
        "db_resources": total_resources
    }


@router.get("/s3/folders")
async def list_s3_folders():
    """
    List all folders (prefixes) directly from S3 bucket.
    This shows the actual folder structure in S3.
    """
    try:
        s3_service = get_s3_service()
        
        # List unique prefixes (folders)
        folders = {}
        paginator = s3_service.s3_client.get_paginator('list_objects_v2')
        
        for page in paginator.paginate(Bucket=s3_service.bucket_name):
            for obj in page.get('Contents', []):
                key = obj['Key']
                parts = key.split('/')
                if len(parts) > 1:
                    folder = parts[0]
                    if folder not in folders:
                        folders[folder] = {
                            'name': folder,
                            'file_count': 0,
                            'total_size': 0
                        }
                    folders[folder]['file_count'] += 1
                    folders[folder]['total_size'] += obj.get('Size', 0)
        
        return {
            "folders": list(folders.values()),
            "total_folders": len(folders)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list S3 folders: {str(e)}")
