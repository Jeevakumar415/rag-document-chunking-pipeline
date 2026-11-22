import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "EnterpriseIQ"
    API_V1_STR: str = "/api/v1"
    
    # PostgreSQL Database URL (Make sure to update password if needed)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/enterpriseiq_db"
    )
    
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    QDRANT_URL: str | None = os.getenv("QDRANT_URL", "http://localhost:6333")
    QDRANT_PATH: str | None = os.getenv("QDRANT_PATH")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()