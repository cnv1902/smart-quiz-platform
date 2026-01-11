"""
Pydantic Schemas for Smart Quiz Platform
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Any
from datetime import datetime


# ============== Auth Schemas ==============
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    role: str = "user"
    is_verified: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class RegisterResponse(BaseModel):
    message: str
    email: str
    requires_otp: bool = True


class VerifyRegisterOTPRequest(BaseModel):
    email: EmailStr
    otp: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str = Field(..., min_length=6)


# ============== Exam Schemas (partial - needed for forward references) ==============
class ExamListResponse(BaseModel):
    id: str
    public_id: str
    title: str
    description: Optional[str]
    mode: str
    time_limit: Optional[int]
    is_public: bool
    has_password: bool
    question_count: int
    total_attempts: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============== Class Schemas ==============
class ClassCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class ClassUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ClassStudentAdd(BaseModel):
    email: EmailStr


class ClassStudentResponse(BaseModel):
    id: str
    student_email: str
    is_verified: bool
    joined_at: datetime
    
    class Config:
        from_attributes = True


class ClassResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    teacher_id: str
    created_at: datetime
    students: List[ClassStudentResponse] = []
    exams: List[ExamListResponse] = []
    
    class Config:
        from_attributes = True


class ClassListResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    student_count: int
    created_at: datetime
    role: Optional[str] = "teacher"  # "teacher" or "student"
    
    class Config:
        from_attributes = True


# ============== Exam Schemas (continued) ==============
class QuestionOption(BaseModel):
    id: str
    text: str
    is_correct: bool = False


class Question(BaseModel):
    id: str
    text: str
    options: List[QuestionOption]
    explanation: Optional[str] = None


class ExamConfig(BaseModel):
    mode: str = Field(default="test")
    shuffle_questions: bool = False
    shuffle_answers: bool = False
    time_limit: Optional[int] = None  # minutes
    password: Optional[str] = None
    is_public: bool = True
    class_id: Optional[str] = None  # Assign to specific class
    
    @field_validator('mode')
    @classmethod
    def validate_mode(cls, v):
        if v not in ('practice', 'test'):
            raise ValueError('mode must be "practice" or "test"')
        return v
    
    @field_validator('password', 'class_id', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if v == '' or v == 'null':
            return None
        return v


class ExamCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    questions: List[Question]
    config: ExamConfig = Field(default_factory=ExamConfig)


class ExamUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    questions: Optional[List[Question]] = None
    config: Optional[ExamConfig] = None


class ExamResponse(BaseModel):
    id: str
    public_id: str
    title: str
    description: Optional[str]
    creator_id: str
    mode: str
    shuffle_questions: bool
    shuffle_answers: bool
    time_limit: Optional[int]
    is_public: bool
    has_password: bool
    class_id: Optional[str] = None
    questions: List[Question]
    total_attempts: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class ExamPublicResponse(BaseModel):
    """Response for public exam view (no correct answers)"""
    public_id: str
    title: str
    description: Optional[str]
    mode: str
    time_limit: Optional[int]
    has_password: bool
    requires_auth: bool = False  # True if exam is assigned to class
    question_count: int
    
    class Config:
        from_attributes = True


class ExamTakeResponse(BaseModel):
    """Response when starting an exam (questions without correct answers)"""
    public_id: str
    title: str
    description: Optional[str]
    mode: str
    time_limit: Optional[int]
    questions: List[dict]  # Questions with options but no is_correct flag


# ============== Exam Result Schemas ==============
class AnswerSubmit(BaseModel):
    question_id: str
    selected_option_id: str


class ExamSubmit(BaseModel):
    answers: List[AnswerSubmit]
    time_taken: Optional[int] = None  # seconds
    guest_name: Optional[str] = None
    guest_email: Optional[EmailStr] = None


class ExamResultResponse(BaseModel):
    id: str
    exam_id: str
    score: float
    correct_count: int
    total_questions: int
    time_taken: Optional[int]
    completed_at: datetime
    user_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class ExamResultDetailResponse(BaseModel):
    id: str
    exam_id: str
    score: float
    correct_count: int
    total_questions: int
    time_taken: Optional[int]
    answers: List[dict]
    completed_at: datetime
    
    class Config:
        from_attributes = True


class LeaderboardEntry(BaseModel):
    rank: int
    user_name: str
    score: float
    time_taken: Optional[int]
    completed_at: datetime


# ============== Dashboard Schemas ==============
class DashboardStats(BaseModel):
    total_exams: int
    total_classes: int
    total_students: int
    total_attempts: int


class TrafficData(BaseModel):
    hour: str
    count: int


class DashboardResponse(BaseModel):
    stats: DashboardStats
    traffic_24h: List[TrafficData]


# ============== File Parser Schemas ==============
class ParsedQuestionOption(BaseModel):
    id: str
    text: str
    is_correct: bool = False


class ParsedQuestion(BaseModel):
    id: str
    text: str
    options: List[ParsedQuestionOption]
    explanation: Optional[str] = None


class ParseResponse(BaseModel):
    success: bool
    questions: List[ParsedQuestion] = []
    error: Optional[str] = None
    total_parsed: int = 0
    # S3 file info (optional - only when file is saved)
    file_url: Optional[str] = None
    file_id: Optional[str] = None
    topic_slug: Optional[str] = None
