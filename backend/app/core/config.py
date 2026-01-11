"""
Smart Quiz Platform - Configuration Settings
"""
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://localhost/smartquiz"
    
    # JWT
    secret_key: str = "your-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours
    
    # Brevo Email
    brevo_api_key: str = ""
    brevo_sender_email: str = "noreply@smartquiz.com"
    brevo_sender_name: str = "Smart Quiz Platform"
    
    # App
    frontend_url: str = "http://localhost:5173"
    app_name: str = "Smart Quiz Platform"
    
    # CORS - Comma separated list of allowed origins
    # Example: "http://localhost:5173,https://iamchuong.id.vn,https://www.iamchuong.id.vn"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    
    # AWS S3 Configuration
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    aws_bucket_name: str = ""
    
    # Gemini AI Configuration
    gemini_api_key: str = ""
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string"""
        origins = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        # Always include frontend_url
        if self.frontend_url not in origins:
            origins.append(self.frontend_url)
        return origins
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
