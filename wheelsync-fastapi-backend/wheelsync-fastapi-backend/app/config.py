from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_JWT_SECRET = "change-me-to-a-long-random-string"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg2://wheelsync:wheelsync@localhost:5432/wheelsync"

    jwt_secret: str = DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 720
    environment: str = "development"

    cors_origins: str = "http://localhost:5173,http://localhost:5174"
    public_base_url: str = "http://localhost:8000"

    upload_dir: str = "./uploads"
    max_upload_mb: int = 10

    timezone: str = "Asia/Manila"
    rental_address: str = "Zone 7, Kauswagan Highway, Cagayan de Oro City"

    resend_api_key: str | None = None
    email_from: str | None = None
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    smtp_starttls: bool = True
    smtp_ssl: bool = False

    allow_admin_signup: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
