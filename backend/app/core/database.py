"""
Database connection and session management
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool
from app.core.config import settings

# Create engine with SSL mode for NeonDB
# Optimized connection pool settings
engine = create_engine(
    settings.database_url,
    poolclass=QueuePool,
    pool_pre_ping=True,      # Check connection before use
    pool_size=5,             # Base connections
    max_overflow=10,         # Extra connections when needed
    pool_timeout=30,         # Wait time for connection
    pool_recycle=1800,       # Recycle connections after 30 mins
    echo=False               # Disable SQL logging for performance
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
