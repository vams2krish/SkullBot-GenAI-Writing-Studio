from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DETECTION_", env_file=".env", extra="ignore")
    database: str = "./data/detection.sqlite3"
    # JSON entries: {"token":"...", "tenant":"...", "role":"admin|member"}.
    credentials_json: str = "[]"
    max_characters: int = 200_000
    max_upload_bytes: int = 10_000_000
    max_pages: int = 200
    shingle_words: int = Field(default=5, ge=3, le=10)
    winnow_window: int = Field(default=4, ge=1, le=10)
    max_sources: int = 500
    max_candidates: int = 100
    workers: int = Field(default=2, ge=1, le=8)
    queue_capacity: int = Field(default=16, ge=1, le=100)
    requests_per_minute: int = 30
    read_requests_per_minute: int = 600
    retention_hours: int = 24
    allow_member_indexing: bool = False
    embedding_model: str = ""
    embedding_revision: str = "main"
    semantic_threshold: float = Field(default=.83, ge=0, le=1)
    ai_model: str = ""
    ai_revision: str = "main"
    ai_positive_label: str = "Fake"
    ai_min_words: int = Field(default=300, ge=100, le=3000)
    ai_threshold: float = Field(default=.8, ge=0, le=1)
    reference_lm: str = ""
    reference_lm_revision: str = "main"
    inference_threads: int = Field(default=2, ge=1, le=8)
    crawler_allow_hosts: str = ""


@lru_cache
def settings() -> Settings:
    return Settings()
