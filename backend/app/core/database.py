"""
Async SQLAlchemy database engine and session factory.
Uses aiosqlite for non-blocking SQLite access.
"""
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
import os

# Ensure storage directory exists
os.makedirs(settings.STORAGE_BASE, exist_ok=True)

DATABASE_URL = f"sqlite+aiosqlite:///{settings.STORAGE_BASE}/afterlight.db"

engine = create_async_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=settings.DEBUG,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency: yields a fresh async DB session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables on startup."""
    async with engine.begin() as conn:
        from app.models import all_models  # noqa — ensures models are imported
        await conn.run_sync(Base.metadata.create_all)
