from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

engine = create_engine(get_settings().database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create extensions + tables. Safe to run on every start."""
    from . import models  # noqa: F401  (register tables)

    with engine.begin() as conn:
        conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS btree_gist")
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.exec_driver_sql("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address text")
        conn.exec_driver_sql("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT true")
        conn.exec_driver_sql("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verification_token_hash varchar(64)")
        conn.exec_driver_sql("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verification_expires_at timestamp with time zone")
        conn.exec_driver_sql("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS extra_document_1_path text")
        conn.exec_driver_sql("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS extra_document_2_path text")
        conn.exec_driver_sql("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rejection_reason text")
        conn.exec_driver_sql("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS description text")
