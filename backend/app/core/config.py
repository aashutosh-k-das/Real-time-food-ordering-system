from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Real-Time Food Ordering API"
    api_prefix: str = "/api/v1"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/food_ordering"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "dev-secret-change-me-please-keep-long"
    jwt_algorithm: str = "HS256"
    delivery_speed_kmh: float = 20.0
    prep_buffer_minutes: int = 12
    anthropic_api_key: str | None = None
    assistant_model: str = "claude-opus-5-5"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
