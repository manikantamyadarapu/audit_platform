from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    app_name: str = 'HAA — Excel Validation & Auditing Service'
    app_env: str = Field(default='development', alias='APP_ENV')
    app_port: int = Field(default=8000, alias='APP_PORT')
    log_level: str = Field(default='INFO', alias='LOG_LEVEL')
    chunk_size: int = Field(default=2500, alias='CHUNK_SIZE')
    gross_weight_tolerance: float = Field(default=0.5, alias='GROSS_WEIGHT_TOLERANCE')
    gross_weight_match_epsilon: float = Field(default=0.001, alias='GROSS_WEIGHT_MATCH_EPSILON')
    sales_debug_export: bool = Field(default=False, alias='SALES_DEBUG_EXPORT')


@lru_cache
def get_settings() -> Settings:
    return Settings()
