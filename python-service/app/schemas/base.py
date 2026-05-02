from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    success: bool = False
    detail: str


class HealthResponse(BaseModel):
    status: str = Field(default='ok')
    service: str
