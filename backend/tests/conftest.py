import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base, get_db
from app.main import app
from app.seed import seed_database
from app.security import limiter

# Shared persistent test database across all test modules
test_engine = create_engine("sqlite:///./test_suite.db", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True, scope="session")
def setup_test_suite_db():
    import os
    test_engine.dispose()
    if os.path.exists("./test_suite.db"):
        try:
            os.remove("./test_suite.db")
        except Exception:
            pass
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    seed_database(db)
    db.close()
    yield
    test_engine.dispose()
    try:
        if os.path.exists("./test_suite.db"):
            os.remove("./test_suite.db")
    except Exception:
        pass


@pytest.fixture(autouse=True)
def reset_rate_limits():
    limiter.hits.clear()
