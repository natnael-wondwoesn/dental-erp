from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        env_prefix="BACKEND_",
        extra="ignore",
    )

    app_name: str = "DentalERP"
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://dental:dental@localhost:15432/dental_erp"
    jwt_secret: str = Field(default="development-only-change-this-secret", min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 480
    cors_origins: str = "http://localhost:3000"
    license_enforcement: Literal["disabled", "audit", "required"] = "disabled"
    license_product_id: str = "dental-erp"
    license_state_dir: Path = Path(".license-state")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
