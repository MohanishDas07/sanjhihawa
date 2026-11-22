"""
SAANS FastAPI Main Application.
Provides deterministic air quality, exposure calculation, and simulation endpoints.
"""

import logging
import os
import sys
from contextlib import asynccontextmanager

# Ensure apps/api directory is in sys.path for serverless container execution
_current_dir = os.path.dirname(os.path.abspath(__file__))
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from retrieval.index import get_retrieval_index
from routers import air, chat, community, geocode, health, plan, simulate

# Load environment variables from .env file if present
load_dotenv()

# Structured Logging - Strict Rule: NO personal health data in logs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("saans.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up retrieval index in memory to avoid per-request cold-start disk I/O
    try:
        get_retrieval_index()
        logger.info("Authoritative guidance corpus pre-warmed in memory.")
    except (OSError, ValueError) as e:
        logger.warning(f"Could not pre-warm retrieval index: {e}")
    yield


app = FastAPI(
    title="SanjhiHawa API - Clean Air Intelligence & Breath Budget Engine",
    description="Deterministic exposure engine, CPCB AQI calculator, and AI tool interface.",
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
)


# Security Headers ASGI Middleware (pure ASGI to avoid BaseHTTPMiddleware overhead)
class SecurityHeadersMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                # Inject security headers directly
                headers = list(message.get("headers", []))
                headers.append((b"x-content-type-options", b"nosniff"))
                headers.append((b"x-frame-options", b"DENY"))
                headers.append((b"x-xss-protection", b"1; mode=block"))
                headers.append((b"referrer-policy", b"strict-origin-when-cross-origin"))
                headers.append(
                    (b"permissions-policy", b"camera=(), microphone=(), geolocation=(self)")
                )
                headers.append(
                    (
                        b"content-security-policy",
                        b"default-src 'self'; frame-ancestors 'none';",
                    )
                )
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)


# Request Body Size Limiter ASGI Middleware (clamps incoming JSON to max 64 KB to prevent payload flooding)
class RequestBodyLimitMiddleware:
    def __init__(self, app, max_bytes: int = 65536):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            content_length = headers.get(b"content-length")
            if content_length:
                try:
                    if int(content_length) > self.max_bytes:
                        await send({
                            "type": "http.response.start",
                            "status": 413,
                            "headers": [(b"content-type", b"application/json")],
                        })
                        await send({
                            "type": "http.response.body",
                            "body": b'{"detail": "Request entity too large (max 64 KB)."}',
                        })
                        return
                except ValueError:
                    pass
        await self.app(scope, receive, send)


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestBodyLimitMiddleware)

# Strict CORS Allowlist (Read from environment for containerized & hosted deployments)
raw_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000",
)
ALLOWED_ORIGINS = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Mount API Routers under /api/v1 and /v1 for seamless direct, reverse-proxy, and Vercel routing
for prefix in ["/api/v1", "/v1"]:
    app.include_router(health.router, prefix=prefix)
    app.include_router(geocode.router, prefix=prefix)
    app.include_router(air.router, prefix=prefix)
    app.include_router(plan.router, prefix=prefix)
    app.include_router(simulate.router, prefix=prefix)
    app.include_router(community.router, prefix=prefix)
    app.include_router(chat.router, prefix=prefix)


@app.get("/")
async def root():
    return {
        "app": "SanjhiHawa API",
        "version": "1.0.0",
        "status": "operational",
        "endpoints": "/docs",
    }
