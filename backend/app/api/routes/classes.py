"""
Class Management API Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.config import settings
from app.models import User, Class, ClassStudent, ExamClassAssignment, Exam
from app.schemas import (
    ClassCreate, ClassUpdate, ClassResponse, ClassListResponse,
    ClassStudentAdd, ClassStudentResponse
)
from app.services.email import email_service
from app.api.deps import get_current_user

router = APIRouter(prefix="/classes", tags=["Classes"])


@router.get("", response_model=List[ClassListResponse])
async def get_classes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50
):
    """Get all classes for current user (as teacher or student) with pagination"""
    # Get classes where user is the teacher
    teacher_classes = db.query(Class).filter(
        Class.teacher_id == current_user.id
    ).order_by(Class.created_at.desc()).offset(skip).limit(limit).all()
    
    # Get classes where user is a student
    student_class_ids = db.query(ClassStudent.class_id).filter(
        ClassStudent.student_email == current_user.email,
        ClassStudent.is_verified == True
    ).all()
    student_class_ids = [c[0] for c in student_class_ids]
    
    student_classes = []
    if student_class_ids:
        student_classes = db.query(Class).filter(
            Class.id.in_(student_class_ids)
        ).order_by(Class.created_at.desc()).all()
    
    # Combine both lists
    all_classes = teacher_classes + student_classes
    
    # Optimize: Get student counts in a single query
    class_ids = [cls.id for cls in all_classes]
    
    from sqlalchemy import func
    student_counts = {}
    if class_ids:
        counts = db.query(
            ClassStudent.class_id, 
            func.count(ClassStudent.id)
        ).filter(
            ClassStudent.class_id.in_(class_ids)
        ).group_by(ClassStudent.class_id).all()
        student_counts = {c[0]: c[1] for c in counts}
    
    result = []
    for cls in all_classes:
        # Determine role
        role = "teacher" if cls.teacher_id == current_user.id else "student"
        
        result.append(ClassListResponse(
            id=cls.id,
            name=cls.name,
            description=cls.description,
            student_count=student_counts.get(cls.id, 0),
            created_at=cls.created_at,
            role=role
        ))
    
    return result


@router.post("", response_model=ClassResponse)
async def create_class(
    class_data: ClassCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new class"""
    new_class = Class(
        name=class_data.name,
        description=class_data.description,
        teacher_id=current_user.id
    )
    
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    
    return ClassResponse(
        id=new_class.id,
        name=new_class.name,
        description=new_class.description,
        teacher_id=new_class.teacher_id,
        created_at=new_class.created_at,
        students=[]
    )


@router.get("/{class_id}", response_model=ClassResponse)
async def get_class(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get class details"""
    cls = db.query(Class).filter(Class.id == class_id).first()
    
    if not cls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    # Check if user is teacher or student
    is_teacher = cls.teacher_id == current_user.id
    is_student = db.query(ClassStudent).filter(
        ClassStudent.class_id == class_id,
        ClassStudent.student_email == current_user.email,
        ClassStudent.is_verified == True
    ).first() is not None
    
    if not (is_teacher or is_student):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this class"
        )
    
    students = db.query(ClassStudent).filter(
        ClassStudent.class_id == class_id
    ).all()
    
    # Get exams assigned to this class
    from app.schemas import ExamListResponse
    exam_assignments = db.query(ExamClassAssignment).filter(
        ExamClassAssignment.class_id == class_id
    ).all()
    
    exams_data = []
    for assignment in exam_assignments:
        exam = db.query(Exam).filter(Exam.id == assignment.exam_id).first()
        if exam:
            exams_data.append(ExamListResponse(
                id=exam.id,
                public_id=exam.public_id,
                title=exam.title,
                description=exam.description,
                mode=exam.mode,
                time_limit=exam.time_limit,
                is_public=exam.is_public,
                has_password=bool(exam.password),
                question_count=len(exam.questions) if exam.questions else 0,
                total_attempts=exam.total_attempts,
                created_at=exam.created_at
            ))
    
    return ClassResponse(
        id=cls.id,
        name=cls.name,
        description=cls.description,
        teacher_id=cls.teacher_id,
        created_at=cls.created_at,
        students=[ClassStudentResponse.model_validate(s) for s in students],
        exams=exams_data
    )


@router.put("/{class_id}", response_model=ClassResponse)
async def update_class(
    class_id: str,
    class_data: ClassUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update class details"""
    cls = db.query(Class).filter(
        Class.id == class_id,
        Class.teacher_id == current_user.id
    ).first()
    
    if not cls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    if class_data.name is not None:
        cls.name = class_data.name
    if class_data.description is not None:
        cls.description = class_data.description
    
    db.commit()
    db.refresh(cls)
    
    students = db.query(ClassStudent).filter(
        ClassStudent.class_id == class_id
    ).all()
    
    return ClassResponse(
        id=cls.id,
        name=cls.name,
        description=cls.description,
        teacher_id=cls.teacher_id,
        created_at=cls.created_at,
        students=[ClassStudentResponse.model_validate(s) for s in students]
    )


@router.delete("/{class_id}")
async def delete_class(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a class"""
    cls = db.query(Class).filter(
        Class.id == class_id,
        Class.teacher_id == current_user.id
    ).first()
    
    if not cls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    # Delete related records
    db.query(ClassStudent).filter(ClassStudent.class_id == class_id).delete()
    db.query(ExamClassAssignment).filter(ExamClassAssignment.class_id == class_id).delete()
    db.delete(cls)
    db.commit()
    
    return {"message": "Class deleted successfully"}


@router.post("/{class_id}/students", response_model=ClassStudentResponse)
async def add_student(
    class_id: str,
    student_data: ClassStudentAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a student to class via email"""
    cls = db.query(Class).filter(
        Class.id == class_id,
        Class.teacher_id == current_user.id
    ).first()
    
    if not cls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    # Check if student already in class
    existing = db.query(ClassStudent).filter(
        ClassStudent.class_id == class_id,
        ClassStudent.student_email == student_data.email
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student already in class"
        )
    
    # Generate verification token
    verification_token = email_service.generate_verification_token()
    
    # Create student record
    student = ClassStudent(
        class_id=class_id,
        student_email=student_data.email,
        verification_token=verification_token,
        is_verified=False
    )
    
    db.add(student)
    db.commit()
    db.refresh(student)
    
    # Send invitation email
    verification_link = f"{settings.frontend_url}/join-class/{verification_token}"
    await email_service.send_class_invitation(
        to_email=student_data.email,
        class_name=cls.name,
        teacher_name=current_user.full_name or current_user.email,
        verification_link=verification_link
    )
    
    return ClassStudentResponse.model_validate(student)


@router.delete("/{class_id}/students/{student_id}")
async def remove_student(
    class_id: str,
    student_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a student from class"""
    cls = db.query(Class).filter(
        Class.id == class_id,
        Class.teacher_id == current_user.id
    ).first()
    
    if not cls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    student = db.query(ClassStudent).filter(
        ClassStudent.id == student_id,
        ClassStudent.class_id == class_id
    ).first()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    db.delete(student)
    db.commit()
    
    return {"message": "Student removed successfully"}


@router.get("/join/{token}")
async def verify_class_join(token: str, db: Session = Depends(get_db)):
    """Verify class join token and add student"""
    student = db.query(ClassStudent).filter(
        ClassStudent.verification_token == token
    ).first()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired invitation"
        )
    
    student.is_verified = True
    student.verification_token = None
    db.commit()
    
    cls = db.query(Class).filter(Class.id == student.class_id).first()
    
    return {
        "message": "Successfully joined the class",
        "class_name": cls.name if cls else "Unknown"
    }
