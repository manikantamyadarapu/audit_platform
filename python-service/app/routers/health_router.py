from fastapi import APIRouter

from app.config.settings import get_settings
from app.schemas.base import HealthResponse

router = APIRouter(prefix='/api', tags=['health'])


@router.get('/health', response_model=HealthResponse)
def health_check() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(service=settings.app_name)
