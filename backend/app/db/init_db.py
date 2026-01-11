"""
Database Initialization Script

Creates all tables and seeds with default admin user.
Run: python -m app.db.init_db
"""
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.core.database import engine, Base, SessionLocal
from app.models.knowledge_base import KBUser, Topic, Resource, UserRole

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password for storing."""
    return pwd_context.hash(password)


def init_database():
    """
    Initialize database:
    1. Create all tables
    2. Create default admin user
    3. Create sample topics (optional)
    """
    print("=" * 60)
    print("SMART QUIZ PLATFORM - Database Initialization")
    print("=" * 60)
    
    # Create all tables
    print("\n[1/3] Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✓ Tables created successfully")
    
    # Create session
    db = SessionLocal()
    
    try:
        # Create default admin user
        print("\n[2/3] Creating default admin user...")
        
        admin_email = "admin@smartquiz.com"
        existing_admin = db.query(KBUser).filter(KBUser.email == admin_email).first()
        
        if existing_admin:
            print(f"✓ Admin user already exists: {admin_email}")
        else:
            admin_user = KBUser(
                email=admin_email,
                password_hash=hash_password("admin123"),  # Change in production!
                full_name="System Administrator",
                role=UserRole.ADMIN.value,
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            print(f"✓ Created admin user: {admin_email}")
            print("  Password: admin123 (CHANGE THIS IN PRODUCTION!)")
        
        # Create sample topics
        print("\n[3/3] Creating sample topics...")
        
        sample_topics = [
            {
                "name": "Toán Cao Cấp",
                "slug": "toan-cao-cap",
                "description": "Tài liệu môn Toán Cao Cấp"
            },
            {
                "name": "Lập Trình Web",
                "slug": "lap-trinh-web",
                "description": "Tài liệu lập trình web frontend và backend"
            },
            {
                "name": "Vật Lý Đại Cương",
                "slug": "vat-ly-dai-cuong",
                "description": "Tài liệu môn Vật Lý Đại Cương"
            },
            {
                "name": "Tiếng Anh Chuyên Ngành",
                "slug": "tieng-anh-chuyen-nganh",
                "description": "Tài liệu tiếng Anh chuyên ngành CNTT"
            }
        ]
        
        topics_created = 0
        for topic_data in sample_topics:
            existing = db.query(Topic).filter(Topic.slug == topic_data["slug"]).first()
            if not existing:
                topic = Topic(**topic_data)
                db.add(topic)
                topics_created += 1
        
        db.commit()
        
        if topics_created > 0:
            print(f"✓ Created {topics_created} sample topics")
        else:
            print("✓ Sample topics already exist")
        
        # Print summary
        print("\n" + "=" * 60)
        print("DATABASE INITIALIZATION COMPLETE")
        print("=" * 60)
        
        total_users = db.query(KBUser).count()
        total_topics = db.query(Topic).count()
        total_resources = db.query(Resource).count()
        
        print(f"\nDatabase Statistics:")
        print(f"  - Users: {total_users}")
        print(f"  - Topics: {total_topics}")
        print(f"  - Resources: {total_resources}")
        
        print(f"\nAdmin Login:")
        print(f"  - Email: admin@smartquiz.com")
        print(f"  - Password: admin123")
        
        print("\n⚠️  IMPORTANT: Change the admin password in production!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error during initialization: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def reset_database():
    """
    Drop all tables and recreate.
    WARNING: This will delete all data!
    """
    print("⚠️  WARNING: This will delete ALL data!")
    confirm = input("Type 'RESET' to confirm: ")
    
    if confirm != "RESET":
        print("Aborted.")
        return
    
    print("\nDropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("✓ Tables dropped")
    
    init_database()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Database initialization")
    parser.add_argument("--reset", action="store_true", help="Reset database (WARNING: deletes all data)")
    args = parser.parse_args()
    
    if args.reset:
        reset_database()
    else:
        init_database()
