"""
Smart Quiz Platform - FastAPI Main Application
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.core.database import engine, Base
from app.api.routes import auth, classes, exams, dashboard, files
from app.api.routes.admin_routes import router as admin_router

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - create tables on startup"""
    # Create all tables
    Base.metadata.create_all(bind=engine)
    yield
    # Cleanup on shutdown


app = FastAPI(
    title=settings.app_name,
    description="A smart quiz platform with file parsing capabilities",
    version="1.0.0",
    lifespan=lifespan
)


# Validation error handler - shows detailed validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    logger.error(f"Validation error: {errors}")
    return JSONResponse(
        status_code=422,
        content={"detail": errors, "body": str(exc.body)[:500] if exc.body else None}
    )

# CORS Middleware - Support cross-origin requests from frontend subdomain
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(classes.router, prefix="/api")
app.include_router(exams.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(admin_router, prefix="/api", tags=["admin"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Welcome to Smart Quiz Platform API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.route("/api/health", methods=["GET", "HEAD"])
async def health_check(request: Request):
    """Health check endpoint supporting GET and HEAD"""
    return {"status": "healthy"}
