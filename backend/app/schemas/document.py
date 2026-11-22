from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    id: int
    user_id: int
    filename: str
    file_size: int
    file_type: str
    processing_status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
