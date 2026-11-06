import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .db import Base, SessionLocal, engine
from .routers import auth, chat, deals, disputes, listings, users
from .security import SecurityMiddleware
from .seed import seed_database

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("accord")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize schema
    log.info("Ensuring database tables exist...")
    Base.metadata.create_all(bind=engine)

    # Seed demo data if enabled
    if settings.seed_demo_data:
        log.info("Checking and seeding realistic demo accounts, listings, and deals...")
        db = SessionLocal()
        try:
            seed_database(db)
        finally:
            db.close()
    yield


app = FastAPI(
    title="Accord API",
    description="Conversational marketplace platform where every promise made in conversation becomes part of the deal.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if settings.is_prod else "/docs",
    redoc_url=None if settings.is_prod else "/redoc",
)

# CORS configuration
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Retry-After"],
)

# Defense in depth security middleware
app.add_middleware(SecurityMiddleware)

# API Routers
app.include_router(auth.router)
app.include_router(listings.router)
app.include_router(deals.router)
app.include_router(disputes.router)
app.include_router(chat.router)
app.include_router(users.router)


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "Accord",
        "nexconn_live": settings.nexconn_enabled,
        "ai_live": settings.ai_enabled,
        "environment": settings.environment,
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Never leak stack traces in production
    log.error("Unhandled error processing %s: %s", request.url.path, exc, exc_info=not settings.is_prod)
    if settings.is_prod:
        return JSONResponse(status_code=500, content={"detail": "An internal server error occurred."})
    return JSONResponse(status_code=500, content={"detail": str(exc)})
