from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    environment: str = "development"  # development | production | test
    database_url: str = "sqlite:///./accord.db"
    jwt_secret: str = Field(default="dev-only-insecure-secret-change-me-0000000000")
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    cors_origins: str = "http://localhost:5173"
    seed_demo_data: bool = True

    # Nexconn — App Secret is server-side only and never serialized to clients.
    nexconn_app_key: str = ""
    nexconn_app_secret: str = ""
    nexconn_api_base: str = "https://api.sg-light-api.com"
    nexconn_area: str = "SG"

    # AI provider abstraction (OpenAI-compatible chat completions). Empty = deterministic mode.
    ai_provider: str = "none"  # none | openai_compatible
    ai_base_url: str = ""
    ai_api_key: str = ""
    ai_model: str = ""
    commitment_min_confidence: float = 0.6
    commitment_auto_confidence: float = 0.9

    upload_dir: str = "./uploads"
    max_upload_bytes: int = 5 * 1024 * 1024
    max_body_bytes: int = 64 * 1024
    rate_limit_per_minute: int = 120
    auth_rate_limit_per_minute: int = 10

    @property
    def is_prod(self) -> bool:
        return self.environment == "production"

    @property
    def nexconn_enabled(self) -> bool:
        return bool(self.nexconn_app_key and self.nexconn_app_secret)

    @property
    def ai_enabled(self) -> bool:
        return self.ai_provider == "openai_compatible" and bool(self.ai_api_key and self.ai_model)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.is_prod and (s.jwt_secret.startswith("dev-only") or len(s.jwt_secret) < 32):
        raise RuntimeError("JWT_SECRET must be set to a strong value (>=32 chars) in production")
    return s
