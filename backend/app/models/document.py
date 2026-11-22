from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.db.session import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(1024), nullable=False, unique=True)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String(16), nullable=False)
    processing_status = Column(String(32), nullable=False, default="processing")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
