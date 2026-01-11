"""
AWS S3 Service - Knowledge Base file uploads with Topic-based folder organization.

CORE PRINCIPLE: Files are NEVER uploaded to the root bucket.
Every file MUST be inside a folder corresponding to its Topic.

S3 Structure:
    bucket/
    ├── toan-cao-cap/
    │   ├── bai-1.pdf
    │   └── de-thi-2024.pdf
    ├── lap-trinh-web/
    │   ├── lecture-01.pptx
    │   └── homework.docx
    └── vat-ly-dai-cuong/
        └── cong-thuc.pdf
"""
import logging
import re
import unicodedata
import time
from typing import Optional
from difflib import SequenceMatcher

import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.knowledge_base import Topic, Resource

logger = logging.getLogger(__name__)


def slugify(text: str) -> str:
    """
    Convert Vietnamese text to URL-safe slug.
    
    Examples:
        "Toán Cao Cấp" -> "toan-cao-cap"
        "Lập Trình Web" -> "lap-trinh-web"
        "Bài 1.pdf" -> "bai-1.pdf"
    """
    # Vietnamese character mappings
    vietnamese_map = {
        'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
        'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
        'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
        'đ': 'd',
        'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
        'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
        'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
        'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
        'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
        'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
        'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
        'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
        'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
    }
    
    # Convert to lowercase
    text = text.lower()
    
    # Replace Vietnamese characters
    result = []
    for char in text:
        if char in vietnamese_map:
            result.append(vietnamese_map[char])
        elif char.upper() in vietnamese_map:
            result.append(vietnamese_map[char.upper()])
        else:
            result.append(char)
    text = ''.join(result)
    
    # Normalize unicode
    text = unicodedata.normalize('NFKD', text)
    text = text.encode('ascii', 'ignore').decode('ascii')
    
    # Replace spaces and special chars with hyphens
    text = re.sub(r'[^\w\s.-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    text = text.strip('-')
    
    return text


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename for S3 storage.
    Preserves extension, converts to lowercase slug format.
    
    Example: "Bài Giảng 1.pdf" -> "bai-giang-1.pdf"
    """
    if '.' in filename:
        name, ext = filename.rsplit('.', 1)
        return f"{slugify(name)}.{ext.lower()}"
    return slugify(filename)


def fuzzy_match(s1: str, s2: str, threshold: float = 0.8) -> bool:
    """
    Check if two strings are similar using fuzzy matching.
    
    Args:
        s1: First string
        s2: Second string  
        threshold: Similarity threshold (0-1), default 0.8 (80% similar)
        
    Returns:
        True if strings are similar above threshold
    """
    s1_normalized = slugify(s1)
    s2_normalized = slugify(s2)
    ratio = SequenceMatcher(None, s1_normalized, s2_normalized).ratio()
    return ratio >= threshold


class S3Service:
    """
    AWS S3 service for Knowledge Base file uploads.
    
    Files are organized into Topic folders:
    - Every upload requires a topic_name
    - Topic is matched (fuzzy) or created automatically
    - Files are stored as: {topic_slug}/{sanitized_filename}
    """
    
    def __init__(self):
        """Initialize S3 client with credentials from settings."""
        self.bucket_name = settings.aws_bucket_name
        self.region = settings.aws_region
        
        if not self.bucket_name:
            raise ValueError(
                "AWS_BUCKET_NAME is required. "
                "Please set it in your environment variables."
            )
        
        if not settings.aws_access_key_id or not settings.aws_secret_access_key:
            raise ValueError(
                "AWS credentials are required. "
                "Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your environment variables."
            )
        
        # Initialize S3 client
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=self.region
        )
        
        logger.info(f"S3 service initialized for bucket: {self.bucket_name} in region: {self.region}")

    def _find_or_create_topic(self, db: Session, topic_name: str) -> Topic:
        """
        Step 1 (Smart Grouping): Find existing topic by fuzzy match or create new one.
        """
        topic_name = topic_name.strip()
        topic_slug = slugify(topic_name)
        
        # First, try exact slug match
        existing = db.query(Topic).filter(Topic.slug == topic_slug).first()
        if existing:
            logger.info(f"Found existing topic by slug: {existing.name} ({existing.slug})")
            return existing
        
        # Try fuzzy match on topic names
        all_topics = db.query(Topic).all()
        for topic in all_topics:
            if fuzzy_match(topic_name, topic.name):
                logger.info(f"Fuzzy matched '{topic_name}' to existing topic: {topic.name}")
                return topic
        
        # No match found - create new topic
        new_topic = Topic(
            name=topic_name,
            slug=topic_slug,
            description=f"Auto-created topic for: {topic_name}"
        )
        db.add(new_topic)
        db.commit()
        db.refresh(new_topic)
        
        logger.info(f"Created new topic: {new_topic.name} ({new_topic.slug})")
        return new_topic

    def _construct_s3_key(self, topic_slug: str, filename: str) -> str:
        """
        Step 2 (Physical Folder Structure): Build S3 key with topic folder.
        
        CRITICAL: Files are NEVER at root level!
        
        Example:
            topic_slug="lap-trinh-web", filename="Bài 1.pdf"
            -> "lap-trinh-web/bai-1.pdf"
        """
        sanitized = sanitize_filename(filename)
        s3_key = f"{topic_slug}/{sanitized}"
        logger.info(f"Constructed S3 key: {s3_key}")
        return s3_key

    def upload_file(
        self,
        db: Session,
        file_content: bytes,
        filename: str,
        topic_name: str,
        content_type: str = 'application/octet-stream',
        uploaded_by: Optional[str] = None
    ) -> dict:
        """
        Upload a file to S3 with Topic-based folder organization.
        
        This is the main upload method that:
        1. Finds or creates a Topic (fuzzy match)
        2. Constructs S3 key as {topic_slug}/{filename}
        3. Uploads to S3 (creates folder structure automatically)
        4. Creates Resource record in database
        
        Args:
            db: Database session
            file_content: File content as bytes
            filename: Original filename
            topic_name: Topic name for grouping (e.g., "Toán Cao Cấp")
            content_type: MIME type
            uploaded_by: User ID who uploaded
            
        Returns:
            dict with topic, resource, s3_key, s3_url
        """
        if not topic_name or not topic_name.strip():
            raise ValueError("topic_name is required. Files cannot be uploaded to root bucket.")
        
        try:
            # Step 1: Find or create topic (Smart Grouping)
            topic = self._find_or_create_topic(db, topic_name)
            
            # Step 2: Construct S3 key with topic folder
            s3_key = self._construct_s3_key(topic.slug, filename)
            
            # Check if file already exists at this key
            existing_resource = db.query(Resource).filter(Resource.s3_key == s3_key).first()
            if existing_resource:
                # Generate unique key by appending timestamp
                timestamp = int(time.time())
                name_part, ext = s3_key.rsplit('.', 1) if '.' in s3_key else (s3_key, '')
                s3_key = f"{name_part}-{timestamp}.{ext}" if ext else f"{name_part}-{timestamp}"
            
            logger.info(f"Uploading '{filename}' to topic '{topic.name}' with key: {s3_key}")
            
            # Step 3: Upload to S3
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_content,
                ContentType=content_type,
                ACL='public-read'
            )
            
            # Construct public URL
            s3_url = f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{s3_key}"
            
            logger.info(f"File uploaded successfully to: {s3_url}")
            
            # Step 4: Create Resource record in database
            resource = Resource(
                topic_id=topic.id,
                file_name=filename,
                s3_key=s3_key,
                s3_url=s3_url,
                content_type=content_type,
                file_size=len(file_content),
                uploaded_by=uploaded_by
            )
            db.add(resource)
            db.commit()
            db.refresh(resource)
            
            return {
                'topic': {
                    'id': topic.id,
                    'name': topic.name,
                    'slug': topic.slug
                },
                'resource': {
                    'id': resource.id,
                    'file_name': resource.file_name,
                    's3_key': resource.s3_key,
                    's3_url': resource.s3_url
                },
                'file_id': resource.id,
                'web_view_link': s3_url
            }
            
        except NoCredentialsError as e:
            error_msg = f"AWS credentials not found or invalid: {e}"
            logger.error(error_msg)
            raise Exception(error_msg)
        except ClientError as e:
            error_msg = f"AWS S3 error uploading '{filename}': {e}"
            logger.error(error_msg)
            raise Exception(error_msg)
        except Exception as e:
            db.rollback()
            error_msg = f"Unexpected error uploading '{filename}': {e}"
            logger.error(error_msg)
            raise Exception(error_msg)

    def delete_file(self, db: Session, resource_id: str) -> bool:
        """
        Delete a file from S3 and database.
        """
        try:
            resource = db.query(Resource).filter(Resource.id == resource_id).first()
            if not resource:
                logger.warning(f"Resource not found: {resource_id}")
                return False
            
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=resource.s3_key
            )
            
            db.delete(resource)
            db.commit()
            
            logger.info(f"File deleted successfully: {resource.s3_key}")
            return True
            
        except ClientError as e:
            logger.error(f"Error deleting file: {e}")
            return False

    def list_folder_contents(self, topic_slug: str) -> list:
        """
        List all files in a topic folder directly from S3.
        """
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=f"{topic_slug}/"
            )
            
            files = []
            for obj in response.get('Contents', []):
                files.append({
                    's3_key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat()
                })
            
            return files
            
        except ClientError as e:
            logger.error(f"Error listing folder '{topic_slug}': {e}")
            return []

    def generate_presigned_url(self, s3_key: str, expiration: int = 3600) -> Optional[str]:
        """
        Generate a presigned URL for temporary access.
        """
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key
                },
                ExpiresIn=expiration
            )
            return url
        except ClientError as e:
            logger.error(f"Error generating presigned URL for '{s3_key}': {e}")
            return None

    def upload_file_simple(
        self,
        file_content: bytes,
        filename: str,
        topic_name: str,
        content_type: str = 'application/octet-stream'
    ) -> dict:
        """
        Simple upload without database integration.
        
        For use in routes that don't need Resource tracking.
        Files are organized into topic folders.
        
        Args:
            file_content: File content as bytes
            filename: Original filename
            topic_name: Topic name for folder (e.g., "Toán Cao Cấp")
            content_type: MIME type
            
        Returns:
            dict with file_id, web_view_link, topic_slug, filename
        """
        import uuid
        
        if not topic_name or not topic_name.strip():
            topic_name = "general"
        
        try:
            # Generate topic slug for folder
            topic_slug = slugify(topic_name)
            
            # Sanitize filename
            safe_filename = sanitize_filename(filename)
            
            # Generate unique file ID
            file_id = str(uuid.uuid4())[:8]
            
            # Construct S3 key: {topic_slug}/{filename}
            # Add file_id prefix to avoid collisions
            s3_key = f"{topic_slug}/{file_id}-{safe_filename}"
            
            logger.info(f"Uploading '{filename}' to S3 with key: {s3_key}")
            
            # Upload to S3 with public-read ACL
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_content,
                ContentType=content_type,
                ACL='public-read'
            )
            
            # Construct public URL
            web_view_link = f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{s3_key}"
            
            logger.info(f"File uploaded successfully: {web_view_link}")
            
            return {
                'file_id': file_id,
                'web_view_link': web_view_link,
                'topic_slug': topic_slug,
                'filename': filename,
                's3_key': s3_key
            }
            
        except NoCredentialsError as e:
            error_msg = f"AWS credentials not found: {e}"
            logger.error(error_msg)
            raise Exception(error_msg)
        except ClientError as e:
            error_msg = f"AWS S3 error: {e}"
            logger.error(error_msg)
            raise Exception(error_msg)


# Singleton instance (lazy initialization)
_s3_service_instance: S3Service | None = None


def get_s3_service() -> S3Service:
    """
    Get the S3 service instance (singleton).
    """
    global _s3_service_instance
    
    if _s3_service_instance is None:
        _s3_service_instance = S3Service()
    
    return _s3_service_instance
