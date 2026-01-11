"""
Dashboard API Routes
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List, Literal
import pytz

from app.core.database import get_db
from app.models import User, Exam, Class, ClassStudent, ExamAccess, ExamResult
from app.schemas import DashboardResponse, DashboardStats, TrafficData
from app.api.deps import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    period: Literal["day", "week", "month", "year"] = Query(default="day")
):
    """Get dashboard statistics and traffic data - Optimized"""
    
    # Get all counts in fewer queries using subqueries
    total_exams = db.query(func.count(Exam.id)).filter(
        Exam.creator_id == current_user.id
    ).scalar() or 0
    
    total_classes = db.query(func.count(Class.id)).filter(
        Class.teacher_id == current_user.id
    ).scalar() or 0
    
    # Count unique students across all classes - single query
    total_students = db.query(func.count(ClassStudent.id)).join(Class).filter(
        Class.teacher_id == current_user.id
    ).scalar() or 0
    
    # Total attempts on user's exams - single query
    total_attempts = db.query(func.count(ExamResult.id)).join(Exam).filter(
        Exam.creator_id == current_user.id
    ).scalar() or 0
    
    stats = DashboardStats(
        total_exams=total_exams,
        total_classes=total_classes,
        total_students=total_students,
        total_attempts=total_attempts
    )
    
    # Get traffic data based on period
    # Use Asia/Ho_Chi_Minh timezone to match database timezone
    vn_tz = pytz.timezone('Asia/Ho_Chi_Minh')
    now = datetime.now(vn_tz)
    
    # Get user's exam IDs - single query
    user_exam_ids = [e.id for e in db.query(Exam.id).filter(
        Exam.creator_id == current_user.id
    ).all()]
    
    traffic_24h = []
    
    if not user_exam_ids:
        # Return empty traffic if no exams
        if period == "day":
            for i in range(24):
                traffic_24h.append(TrafficData(hour=f"{i:02d}:00", count=0))
        elif period == "week":
            weekday = now.weekday()
            week_start = (now - timedelta(days=weekday)).replace(hour=0, minute=0, second=0, microsecond=0)
            for i in range(7):
                day = week_start + timedelta(days=i)
                traffic_24h.append(TrafficData(hour=day.strftime("%d/%m"), count=0))
        elif period == "month":
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if now.month == 12:
                next_month = month_start.replace(year=now.year + 1, month=1)
            else:
                next_month = month_start.replace(month=now.month + 1)
            days_in_month = (next_month - month_start).days
            for i in range(days_in_month):
                day = month_start + timedelta(days=i)
                traffic_24h.append(TrafficData(hour=day.strftime("%d/%m"), count=0))
        else:  # year
            for month in range(1, 13):
                traffic_24h.append(TrafficData(hour=f"T{month}", count=0))
    else:
        if period == "day":
            # Today from 00:00 to 23:59, group by hour
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            traffic_data = db.query(
                func.date_trunc('hour', ExamResult.completed_at).label('time_bucket'),
                func.count(ExamResult.id).label('count')
            ).filter(
                ExamResult.exam_id.in_(user_exam_ids),
                ExamResult.completed_at >= today_start,
                ExamResult.completed_at <= today_end
            ).group_by('time_bucket').all()
            
            # Build dict with normalized keys (remove timezone for comparison)
            time_counts = {}
            for row in traffic_data:
                # Normalize to timezone-aware datetime in VN timezone
                if row.time_bucket.tzinfo is None:
                    # If naive, assume it's already in VN time
                    key = vn_tz.localize(row.time_bucket)
                else:
                    # If aware, convert to VN timezone
                    key = row.time_bucket.astimezone(vn_tz)
                time_counts[key.replace(tzinfo=None)] = row.count
            
            # Generate 24 hours from 00:00 to 23:00
            for i in range(24):
                hour_start = today_start.replace(hour=i, tzinfo=None)
                count = time_counts.get(hour_start, 0)
                traffic_24h.append(TrafficData(hour=f"{i:02d}:00", count=count))
                
        elif period == "week":
            # Current week from Monday to Sunday, group by day
            # Get start of week (Monday)
            weekday = now.weekday()  # Monday is 0, Sunday is 6
            week_start = (now - timedelta(days=weekday)).replace(hour=0, minute=0, second=0, microsecond=0)
            week_end = (week_start + timedelta(days=6)).replace(hour=23, minute=59, second=59, microsecond=999999)
            
            traffic_data = db.query(
                func.date_trunc('day', ExamResult.completed_at).label('time_bucket'),
                func.count(ExamResult.id).label('count')
            ).filter(
                ExamResult.exam_id.in_(user_exam_ids),
                ExamResult.completed_at >= week_start,
                ExamResult.completed_at <= week_end
            ).group_by('time_bucket').all()
            
            time_counts = {}
            for row in traffic_data:
                if row.time_bucket.tzinfo is None:
                    key = vn_tz.localize(row.time_bucket)
                else:
                    key = row.time_bucket.astimezone(vn_tz)
                # Reset to midnight after timezone conversion
                naive_key = key.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
                time_counts[naive_key] = row.count
            
            # Generate 7 days from Monday to Sunday
            for i in range(7):
                day_start = (week_start + timedelta(days=i)).replace(tzinfo=None)
                count = time_counts.get(day_start, 0)
                traffic_24h.append(TrafficData(hour=day_start.strftime("%d/%m"), count=count))
                
        elif period == "month":
            # Current month from day 1 to last day, group by day
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            # Get last day of month
            if now.month == 12:
                next_month = month_start.replace(year=now.year + 1, month=1)
            else:
                next_month = month_start.replace(month=now.month + 1)
            month_end = (next_month - timedelta(days=1)).replace(hour=23, minute=59, second=59, microsecond=999999)
            days_in_month = (next_month - month_start).days
            
            traffic_data = db.query(
                func.date_trunc('day', ExamResult.completed_at).label('time_bucket'),
                func.count(ExamResult.id).label('count')
            ).filter(
                ExamResult.exam_id.in_(user_exam_ids),
                ExamResult.completed_at >= month_start,
                ExamResult.completed_at <= month_end
            ).group_by('time_bucket').all()
            
            time_counts = {}
            for row in traffic_data:
                if row.time_bucket.tzinfo is None:
                    key = vn_tz.localize(row.time_bucket)
                else:
                    key = row.time_bucket.astimezone(vn_tz)
                # Reset to midnight after timezone conversion
                naive_key = key.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
                time_counts[naive_key] = row.count
            
            # Generate all days in current month
            for i in range(days_in_month):
                day_start = (month_start + timedelta(days=i)).replace(tzinfo=None)
                count = time_counts.get(day_start, 0)
                traffic_24h.append(TrafficData(hour=day_start.strftime("%d/%m"), count=count))
                
        else:  # year
            # Current year from Jan to Dec, group by month
            year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            year_end = now.replace(month=12, day=31, hour=23, minute=59, second=59, microsecond=999999)
            
            traffic_data = db.query(
                func.date_trunc('month', ExamResult.completed_at).label('time_bucket'),
                func.count(ExamResult.id).label('count')
            ).filter(
                ExamResult.exam_id.in_(user_exam_ids),
                ExamResult.completed_at >= year_start,
                ExamResult.completed_at <= year_end
            ).group_by('time_bucket').all()
            
            time_counts = {}
            for row in traffic_data:
                if row.time_bucket.tzinfo is None:
                    key = vn_tz.localize(row.time_bucket)
                else:
                    key = row.time_bucket.astimezone(vn_tz)
                # Reset to first day of month after timezone conversion
                naive_key = key.replace(day=1, hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
                time_counts[naive_key] = row.count
            
            # Generate 12 months from January to December
            for month in range(1, 13):
                month_start = year_start.replace(month=month, tzinfo=None)
                count = time_counts.get(month_start, 0)
                traffic_24h.append(TrafficData(hour=f"T{month}", count=count))
    
    return DashboardResponse(
        stats=stats,
        traffic_24h=traffic_24h
    )
