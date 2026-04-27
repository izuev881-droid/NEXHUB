
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import declarative_base
from dotenv import load_dotenv


load_dotenv()


SQLALCHEMY_DATABASE_URI = "sqlite:///./sql_app.db"
# SQLALCHEMY_DATABASE_URL = f"postgresql+psycopg://{settings.db_user}:{settings.db_password}@{settings.db_host}:{settings.db_port}/{settings.db_name}"

engine = create_engine(SQLALCHEMY_DATABASE_URI, echo=False, pool_pre_ping=True)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)





Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)



from backend.db.models import *


def force_create():
    print(f"Таблиц в метаданных: {len(Base.metadata.tables)}")

    for table_name, table in Base.metadata.tables.items():
        print(f"  - {table_name}")

    Base.metadata.create_all(engine)
    print("Готово")


if __name__ == "__main__":
    force_create()