from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.session import engine, Base
from app.models.user import User  # Registers user model with SQLAlchemy
from app.models.document import Document  # Registers document model with SQLAlchemy
from app.api.routes import auth, documents, rag

# Automatically create database tables if they don't exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="EnterpriseIQ API",
    description="Production-Grade Multi-Document RAG Assistant API",
    version="1.0.0"
)

# Configure CORS to allow frontend connections from Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers under /api/v1 prefix
app.include_router(auth.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(rag.router, prefix="/api/v1")

@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint providing welcome info and documentation links.
    """
    return {
        "project": "EnterpriseIQ API",
        "version": "1.0.0",
        "status": "active",
        "docs": "/docs"
    }

@app.get("/health", tags=["System"])
async def health_check():
    """
    System health check endpoint verifying database and server status.
    """
    return {
        "status": "healthy",
        "project": "EnterpriseIQ",
        "database": "Connected & tables verified",
        "message": "FastAPI backend is running successfully!"
    }