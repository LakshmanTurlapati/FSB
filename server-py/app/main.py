import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import close_pool, init_pool
from .routers import agents, auth, sse, stats


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_pool()
    print(f"[FSB Server] Running on port {settings.PORT}")
    if settings.FSB_SERVER_SECRET == "fsb-default-secret-change-me":
        print("[FSB Server] WARNING: Using default secret. Set FSB_SERVER_SECRET for production.")
    yield
    # Shutdown
    await close_pool()
    print("[FSB Server] Shut down.")


app = FastAPI(title="FSB Server", version="1.0.0", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-FSB-Hash-Key"],
)


# Request logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = int((time.time() - start) * 1000)
    path = request.url.path
    if path != "/api/sse":
        print(f"{request.method} {path} {response.status_code} {duration}ms")
    return response


# Routers
app.include_router(auth.router)
app.include_router(agents.router)
app.include_router(stats.router)
app.include_router(sse.router)


@app.get("/")
async def root():
    return {"status": "ok", "service": "FSB Server", "version": "1.0.0"}
