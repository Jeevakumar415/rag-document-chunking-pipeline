from pydantic import BaseModel, Field, field_validator


class RAGQueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)

    @field_validator("question")
    @classmethod
    def question_must_not_be_blank(cls, question: str) -> str:
        question = question.strip()
        if not question:
            raise ValueError("Question must not be blank.")
        return question


class SourceChunkCitation(BaseModel):
    chunk_index: int
    text: str
    score: float | None = None
    page_number: int | None = None


class SourceCitation(BaseModel):
    document_id: int
    filename: str
    chunk_indices: list[int]
    chunks: list[SourceChunkCitation] = Field(default_factory=list)


class RAGQueryResponse(BaseModel):
    answer: str
    sources: list[SourceCitation]
