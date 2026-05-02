import sys

from loguru import logger

from app.config.settings import get_settings


settings = get_settings()

logger.remove()
logger.add(
    sys.stdout,
    level=settings.log_level.upper(),
    format='{time:YYYY-MM-DD HH:mm:ss} | {level} | {extra[request_id]} | {message}',
    backtrace=False,
    diagnose=False,
)


def get_logger(request_id: str = '-'):
    return logger.bind(request_id=request_id)
