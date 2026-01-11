"""
Exam Management API Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timedelta
import random
import uuid as uuid_lib

from app.core.database import get_db
from app.models import (
    User, Exam, ExamResult, ExamAccess, ExamClassAssignment, 
    ExamEmailWhitelist, ClassStudent, Class
)
from app.schemas import (
    ExamCreate, ExamUpdate, ExamResponse, ExamListResponse,
    ExamPublicResponse, ExamTakeResponse, ExamSubmit,
    ExamResultResponse, ExamResultDetailResponse, LeaderboardEntry,
    ParseResponse
)
from app.services.parser import parse_document
from app.services.s3_service import get_s3_service
from app.api.deps import get_current_user, get_current_user_optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/exams", tags=["Exams"])


@router.post("/parse", response_model=ParseResponse)
async def parse_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Parse uploaded Word/Excel file and extract questions.
    Also saves the original file to S3 for Knowledge Base.
    
    This is the "Magic" file parser feature.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided"
        )
    
    # Validate file type
    allowed_extensions = ['.docx', '.xlsx', '.xls', '.txt']
    file_ext = '.' + file.filename.split('.')[-1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Read file content
    content = await file.read()
    
    # Parse document
    questions, error = parse_document(content, file.filename)
    
    if error:
        return ParseResponse(
            success=False,
            error=error,
            questions=[],
            total_parsed=0
        )
    
    # Save file to S3 (Knowledge Base) - auto-organize into "de-thi" folder
    file_url = None
    file_id = None
    topic_slug = None
    
    try:
        s3_service = get_s3_service()
        s3_result = s3_service.upload_file_simple(
            file_content=content,
            filename=file.filename,
            topic_name="Đề thi",  # Auto-categorize exam files
            content_type=file.content_type or 'application/octet-stream'
        )
        file_url = s3_result.get('web_view_link')
        file_id = s3_result.get('file_id')
        topic_slug = s3_result.get('topic_slug')
        logger.info(f"File saved to S3: {file_url}")
    except Exception as e:
        # Log error but don't fail the parse operation
        logger.error(f"Failed to save file to S3: {e}")
    
    return ParseResponse(
        success=True,
        questions=questions,
        total_parsed=len(questions),
        file_url=file_url,
        file_id=file_id,
        topic_slug=topic_slug
    )


@router.get("", response_model=List[ExamListResponse])
async def get_exams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50
):
    """Get all exams created by current user with pagination"""
    exams = db.query(Exam).filter(
        Exam.creator_id == current_user.id
    ).order_by(Exam.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for exam in exams:
        result.append(ExamListResponse(
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
    
    return result


@router.post("", response_model=ExamResponse)
async def create_exam(
    exam_data: ExamCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new exam"""
    # Validate class_id if provided
    if exam_data.config.class_id:
        class_obj = db.query(Class).filter(
            Class.id == exam_data.config.class_id,
            Class.teacher_id == current_user.id
        ).first()
        if not class_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Class not found or you don't have permission"
            )
    
    # Convert questions to dict for JSON storage
    questions_json = [q.model_dump() for q in exam_data.questions]
    
    # If assigned to class, set is_public to False
    is_public = exam_data.config.is_public if not exam_data.config.class_id else False
    
    exam = Exam(
        title=exam_data.title,
        description=exam_data.description,
        creator_id=current_user.id,
        questions=questions_json,
        mode=exam_data.config.mode,
        shuffle_questions=exam_data.config.shuffle_questions,
        shuffle_answers=exam_data.config.shuffle_answers,
        time_limit=exam_data.config.time_limit,
        password=exam_data.config.password,
        is_public=is_public
    )
    
    db.add(exam)
    db.commit()
    db.refresh(exam)
    
    # Create class assignment if class_id provided
    if exam_data.config.class_id:
        assignment = ExamClassAssignment(
            exam_id=exam.id,
            class_id=exam_data.config.class_id
        )
        db.add(assignment)
        db.commit()
    
    return ExamResponse(
        id=exam.id,
        public_id=exam.public_id,
        title=exam.title,
        description=exam.description,
        creator_id=exam.creator_id,
        mode=exam.mode,
        shuffle_questions=exam.shuffle_questions,
        shuffle_answers=exam.shuffle_answers,
        time_limit=exam.time_limit,
        is_public=exam.is_public,
        has_password=bool(exam.password),
        class_id=exam_data.config.class_id,
        questions=exam.questions,
        total_attempts=exam.total_attempts,
        created_at=exam.created_at
    )


@router.get("/{exam_id}", response_model=ExamResponse)
async def get_exam(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get exam details (for creator only)"""
    exam = db.query(Exam).filter(
        Exam.id == exam_id,
        Exam.creator_id == current_user.id
    ).first()
    
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy đề thi"
        )
    
    # Get class_id if exam is assigned to a class
    class_assignment = db.query(ExamClassAssignment).filter(
        ExamClassAssignment.exam_id == exam_id
    ).first()
    
    return ExamResponse(
        id=exam.id,
        public_id=exam.public_id,
        title=exam.title,
        description=exam.description,
        creator_id=exam.creator_id,
        mode=exam.mode,
        shuffle_questions=exam.shuffle_questions,
        shuffle_answers=exam.shuffle_answers,
        time_limit=exam.time_limit,
        is_public=exam.is_public,
        has_password=bool(exam.password),
        class_id=class_assignment.class_id if class_assignment else None,
        questions=exam.questions,
        total_attempts=exam.total_attempts,
        created_at=exam.created_at
    )


@router.put("/{exam_id}", response_model=ExamResponse)
async def update_exam(
    exam_id: str,
    exam_data: ExamUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update exam"""
    exam = db.query(Exam).filter(
        Exam.id == exam_id,
        Exam.creator_id == current_user.id
    ).first()
    
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy đề thi"
        )
    
    if exam_data.title is not None:
        exam.title = exam_data.title
    if exam_data.description is not None:
        exam.description = exam_data.description
    if exam_data.questions is not None:
        exam.questions = [q.model_dump() for q in exam_data.questions]
    if exam_data.config is not None:
        exam.mode = exam_data.config.mode
        exam.shuffle_questions = exam_data.config.shuffle_questions
        exam.shuffle_answers = exam_data.config.shuffle_answers
        exam.time_limit = exam_data.config.time_limit
        exam.password = exam_data.config.password
        exam.is_public = exam_data.config.is_public
    
    db.commit()
    db.refresh(exam)
    
    # Get class_id if exam is assigned to a class
    class_assignment = db.query(ExamClassAssignment).filter(
        ExamClassAssignment.exam_id == exam_id
    ).first()
    
    return ExamResponse(
        id=exam.id,
        public_id=exam.public_id,
        title=exam.title,
        description=exam.description,
        creator_id=exam.creator_id,
        mode=exam.mode,
        shuffle_questions=exam.shuffle_questions,
        shuffle_answers=exam.shuffle_answers,
        time_limit=exam.time_limit,
        is_public=exam.is_public,
        has_password=bool(exam.password),
        class_id=class_assignment.class_id if class_assignment else None,
        questions=exam.questions,
        total_attempts=exam.total_attempts,
        created_at=exam.created_at
    )


@router.delete("/{exam_id}")
async def delete_exam(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an exam"""
    exam = db.query(Exam).filter(
        Exam.id == exam_id,
        Exam.creator_id == current_user.id
    ).first()
    
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy đề thi"
        )
    
    # Delete related records
    db.query(ExamResult).filter(ExamResult.exam_id == exam_id).delete()
    db.query(ExamAccess).filter(ExamAccess.exam_id == exam_id).delete()
    db.query(ExamClassAssignment).filter(ExamClassAssignment.exam_id == exam_id).delete()
    db.query(ExamEmailWhitelist).filter(ExamEmailWhitelist.exam_id == exam_id).delete()
    db.delete(exam)
    db.commit()
    
    return {"message": "Exam deleted successfully"}


# ============== Public Exam Access ==============

@router.get("/public/{public_id}", response_model=ExamPublicResponse)
async def get_public_exam(
    public_id: str,
    db: Session = Depends(get_db)
):
    """Get public exam info (without questions)"""
    exam = db.query(Exam).filter(Exam.public_id == public_id).first()
    
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy đề thi"
        )
    
    # Check if exam is assigned to any class
    has_class_assignment = db.query(ExamClassAssignment).filter(
        ExamClassAssignment.exam_id == exam.id
    ).first() is not None
    
    # Check access rules:
    # - If public: always accessible
    # - If has class assignment: show info (auth required to start)
    # - If has password: show info (password required to start)
    # - If none of the above: completely private, only creator can access
    if not exam.is_public and not has_class_assignment and not exam.password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Đề thi này không được công khai"
        )
    
    return ExamPublicResponse(
        public_id=exam.public_id,
        title=exam.title,
        description=exam.description,
        mode=exam.mode,
        time_limit=exam.time_limit,
        has_password=bool(exam.password),
        requires_auth=has_class_assignment,
        question_count=len(exam.questions) if exam.questions else 0
    )


@router.post("/public/{public_id}/start", response_model=ExamTakeResponse)
async def start_exam(
    public_id: str,
    password: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Start taking an exam - returns questions without correct answers"""
    exam = db.query(Exam).filter(Exam.public_id == public_id).first()
    
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy đề thi"
        )
    
    # Check if exam is assigned to any class
    assigned_classes = db.query(ExamClassAssignment).filter(
        ExamClassAssignment.exam_id == exam.id
    ).all()
    
    has_class_assignment = len(assigned_classes) > 0
    
    # LOGIC XÁC THỰC:
    # 1. Nếu đề được giao cho lớp: Phải đăng nhập và tự động thêm vào lớp
    if has_class_assignment:
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Bạn cần đăng nhập để làm bài thi này"
            )
        
        user_email = current_user.email
        is_in_class = False
        is_creator = exam.creator_id == current_user.id
        teacher_email = None
        
        # Check if user is creator
        if is_creator:
            is_in_class = True
        else:
            # Auto-join user to all assigned classes if not already in them
            for assignment in assigned_classes:
                # Get teacher email
                class_obj = db.query(Class).filter(Class.id == assignment.class_id).first()
                if class_obj:
                    teacher = db.query(User).filter(User.id == class_obj.teacher_id).first()
                    if teacher:
                        teacher_email = teacher.email
                
                # Check if user is already in class
                student = db.query(ClassStudent).filter(
                    ClassStudent.class_id == assignment.class_id,
                    ClassStudent.student_email == user_email
                ).first()
                
                if student:
                    # Update verification status if not verified yet
                    if not student.is_verified:
                        student.is_verified = True
                        student.verification_token = None
                        db.commit()
                    is_in_class = True
                else:
                    # Auto-add user to class
                    new_student = ClassStudent(
                        class_id=assignment.class_id,
                        student_email=user_email,
                        is_verified=True,
                        verification_token=None
                    )
                    db.add(new_student)
                    db.commit()
                    is_in_class = True
        
        if not is_in_class:
            contact_msg = f"Liên hệ giáo viên ({teacher_email}) để được hỗ trợ" if teacher_email else "Liên hệ giáo viên để được hỗ trợ"
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bạn không có quyền thực hiện đề thi này. {contact_msg}"
            )
    
    # 2. Nếu có mật khẩu: Kiểm tra mật khẩu
    elif exam.password:
        if exam.password != password:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Mật khẩu không đúng"
            )
    
    # 3. Nếu KHÔNG công khai và KHÔNG có class assignment và KHÔNG có password
    # -> Chỉ creator mới có quyền truy cập
    elif not exam.is_public:
        if not current_user or current_user.id != exam.creator_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Đề thi này không được công khai"
            )
    
    # 4. Nếu công khai (is_public=True): Cho phép truy cập
    
    # Record access
    access = ExamAccess(exam_id=exam.id)
    db.add(access)
    db.commit()
    
    # Prepare questions
    questions = exam.questions.copy() if exam.questions else []
    
    # Shuffle if enabled
    if exam.shuffle_questions:
        random.shuffle(questions)
    
    # In practice mode, keep correct answers; in test mode, remove them
    clean_questions = []
    for q in questions:
        options = q.get('options', [])
        if exam.shuffle_answers:
            random.shuffle(options)
        
        if exam.mode == 'practice':
            # Keep is_correct in practice mode
            clean_options = [
                {'id': opt['id'], 'text': opt['text'], 'is_correct': opt.get('is_correct', False)}
                for opt in options
            ]
        else:
            # Remove is_correct in test mode
            clean_options = [
                {'id': opt['id'], 'text': opt['text']}
                for opt in options
            ]
        
        clean_questions.append({
            'id': q['id'],
            'text': q['text'],
            'options': clean_options
        })
    
    return ExamTakeResponse(
        public_id=exam.public_id,
        title=exam.title,
        description=exam.description,
        mode=exam.mode,
        time_limit=exam.time_limit,
        questions=clean_questions
    )


@router.post("/public/{public_id}/submit", response_model=ExamResultDetailResponse)
async def submit_exam(
    public_id: str,
    submission: ExamSubmit,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Submit exam answers and get results"""
    exam = db.query(Exam).filter(Exam.public_id == public_id).first()
    
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy đề thi"
        )
    
    # Calculate score
    questions = exam.questions or []
    total_questions = len(questions)
    correct_count = 0
    
    # Create answer mapping
    answer_map = {a.question_id: a.selected_option_id for a in submission.answers}
    
    # Check answers
    detailed_answers = []
    for q in questions:
        selected = answer_map.get(q['id'])
        correct_option = next(
            (opt for opt in q.get('options', []) if opt.get('is_correct')),
            None
        )
        correct_option_id = correct_option['id'] if correct_option else None
        
        is_correct = selected == correct_option_id
        if is_correct:
            correct_count += 1
        
        detailed_answers.append({
            'question_id': q['id'],
            'question_text': q['text'],
            'selected_option_id': selected,
            'correct_option_id': correct_option_id,
            'is_correct': is_correct
        })
    
    # Calculate score (0-10 scale)
    score = (correct_count / total_questions * 10) if total_questions > 0 else 0
    score = round(score, 2)
    
    # Create result record
    result = ExamResult(
        exam_id=exam.id,
        user_id=current_user.id if current_user else None,
        guest_email=submission.guest_email if not current_user else None,
        guest_name=submission.guest_name if not current_user else None,
        score=score,
        correct_count=correct_count,
        total_questions=total_questions,
        time_taken=submission.time_taken,
        answers=detailed_answers
    )
    
    db.add(result)
    
    # Update exam attempt count
    exam.total_attempts += 1
    
    db.commit()
    db.refresh(result)
    
    return ExamResultDetailResponse(
        id=result.id,
        exam_id=result.exam_id,
        score=result.score,
        correct_count=result.correct_count,
        total_questions=result.total_questions,
        time_taken=result.time_taken,
        answers=detailed_answers,
        completed_at=result.completed_at
    )


# ============== Leaderboard ==============

@router.get("/public/{public_id}/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard(
    public_id: str,
    db: Session = Depends(get_db)
):
    """Get exam leaderboard"""
    exam = db.query(Exam).filter(Exam.public_id == public_id).first()
    
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy đề thi"
        )
    
    # Get all results ordered by score desc, time asc
    results = db.query(ExamResult).filter(
        ExamResult.exam_id == exam.id
    ).order_by(
        ExamResult.score.desc(),
        ExamResult.time_taken.asc()
    ).limit(100).all()
    
    leaderboard = []
    for i, result in enumerate(results, 1):
        user_name = "Anonymous"
        if result.user_id:
            user = db.query(User).filter(User.id == result.user_id).first()
            if user:
                user_name = user.full_name or user.email.split('@')[0]
        elif result.guest_name:
            user_name = result.guest_name
        
        leaderboard.append(LeaderboardEntry(
            rank=i,
            user_name=user_name,
            score=result.score,
            time_taken=result.time_taken,
            completed_at=result.completed_at
        ))
    
    return leaderboard


# ============== Exam Statistics ==============

@router.get("/{exam_id}/results", response_model=List[ExamResultResponse])
async def get_exam_results(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all results for an exam (creator or student in assigned class)"""
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy đề thi"
        )
    
    # Check if user is creator or student in assigned class
    is_creator = exam.creator_id == current_user.id
    is_student_in_class = False
    
    if not is_creator:
        # Check if exam is assigned to any class where user is a student
        assigned_classes = db.query(ExamClassAssignment).filter(
            ExamClassAssignment.exam_id == exam_id
        ).all()
        
        for assignment in assigned_classes:
            student = db.query(ClassStudent).filter(
                ClassStudent.class_id == assignment.class_id,
                ClassStudent.student_email == current_user.email,
                ClassStudent.is_verified == True
            ).first()
            if student:
                is_student_in_class = True
                break
    
    if not (is_creator or is_student_in_class):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view these results"
        )
    
    results = db.query(ExamResult).filter(
        ExamResult.exam_id == exam_id
    ).order_by(ExamResult.completed_at.desc()).all()
    
    response = []
    for result in results:
        user_name = None
        if result.user_id:
            user = db.query(User).filter(User.id == result.user_id).first()
            if user:
                user_name = user.full_name or user.email
        else:
            user_name = result.guest_name or result.guest_email
        
        response.append(ExamResultResponse(
            id=result.id,
            exam_id=result.exam_id,
            score=result.score,
            correct_count=result.correct_count,
            total_questions=result.total_questions,
            time_taken=result.time_taken,
            completed_at=result.completed_at,
            user_name=user_name
        ))
    
    return response


# ============== Class Assignment ==============

@router.post("/{exam_id}/assign-class/{class_id}")
async def assign_exam_to_class(
    exam_id: str,
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Assign exam to a class"""
    exam = db.query(Exam).filter(
        Exam.id == exam_id,
        Exam.creator_id == current_user.id
    ).first()
    
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy đề thi"
        )
    
    # Check existing assignment
    existing = db.query(ExamClassAssignment).filter(
        ExamClassAssignment.exam_id == exam_id,
        ExamClassAssignment.class_id == class_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exam already assigned to this class"
        )
    
    assignment = ExamClassAssignment(
        exam_id=exam_id,
        class_id=class_id
    )
    
    db.add(assignment)
    db.commit()
    
    return {"message": "Exam assigned to class successfully"}
