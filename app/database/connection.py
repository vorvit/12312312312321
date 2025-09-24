from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings

# Create database engine with optimized pool settings
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=10,           # Увеличиваем размер пула
    max_overflow=20,        # Увеличиваем overflow
    pool_timeout=60,        # Увеличиваем timeout
    pool_recycle=3600,      # Переподключение каждый час
    pool_pre_ping=True      # Проверка соединения перед использованием
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base class for models
Base = declarative_base()

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


