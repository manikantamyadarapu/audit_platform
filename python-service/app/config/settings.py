from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_SERVICE_ROOT = Path(__file__).resolve().parents[2]
_ENV_FILE = _SERVICE_ROOT / '.env'


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE if _ENV_FILE.is_file() else None,
        env_file_encoding='utf-8',
        extra='ignore',
    )

    app_name: str = 'HAA — Excel Validation & Auditing Service'
    app_env: str = Field(default='development', alias='APP_ENV')
    app_port: int = Field(default=8000, alias='APP_PORT')
    log_level: str = Field(default='INFO', alias='LOG_LEVEL')
    chunk_size: int = Field(default=2500, alias='CHUNK_SIZE')
    gross_weight_tolerance: float = Field(default=0.5, alias='GROSS_WEIGHT_TOLERANCE')
    gross_weight_match_epsilon: float = Field(default=0.001, alias='GROSS_WEIGHT_MATCH_EPSILON')
    sales_debug_export: bool = Field(default=False, alias='SALES_DEBUG_EXPORT')
    audit_debug_export: bool = Field(default=False, alias='AUDIT_DEBUG_EXPORT')

    def debug_exports_enabled(self) -> bool:
        """When false (default), skip slow on-disk debug workbooks during API validation."""
        return bool(self.audit_debug_export or self.sales_debug_export)


@lru_cache
def get_settings() -> Settings:
    return Settings()
