from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    app_name: str = 'Excel Validation & Auditing Service'
    app_env: str = Field(default='development', alias='APP_ENV')
    app_port: int = Field(default=8000, alias='APP_PORT')
    log_level: str = Field(default='INFO', alias='LOG_LEVEL')
    chunk_size: int = Field(default=2500, alias='CHUNK_SIZE')
    gross_weight_tolerance: float = Field(default=0.5, alias='GROSS_WEIGHT_TOLERANCE')
    # 0 = unlimited. If set, processors stop at this row and set rowStats.scanCapTruncated.
    excel_max_rows: int = Field(default=0, alias='EXCEL_MAX_ROWS')
    # Rows scanned from the top when locating PAN / tabular headers (title rows above header).
    excel_pan_header_probe_rows: int = Field(default=80, alias='EXCEL_PAN_HEADER_PROBE_ROWS')


@lru_cache
def get_settings() -> Settings:
    return Settings()
