import asyncio
import logging
from contextlib import asynccontextmanager

import jwt
from fastapi import Depends, FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import DEFAULT_JWT_SECRET, get_settings
from .database import SessionLocal, get_db, init_db
from .models import Profile, UserRole
from .realtime import hub
from .routers import admin, auth, bookings, files, me, notifications, public, vehicles
from .security import decode_access_token

log = logging.getLogger("wheelsync")


@asynccontextmanager
async def lifespan(_: FastAPI):
    s = get_settings()
    if s.environment == "production" and s.jwt_secret == DEFAULT_JWT_SECRET:
        raise RuntimeError("Refusing to start in production with the default JWT_SECRET. Set a long random value.")
    if s.jwt_secret == DEFAULT_JWT_SECRET:
        log.warning("Using the default JWT_SECRET - fine for local development only.")
    init_db()
    hub.bind_loop(asyncio.get_running_loop())
    yield


app = FastAPI(
    title="WheelSync API",
    version="1.0.0",
    description="FastAPI + PostgreSQL backend for the WheelSync admin, customer and staff apps (Pardz Car Rental).",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, me.router, public.router, vehicles.router, bookings.router, notifications.router, admin.router, files.router):
    app.include_router(r)


@app.get("/health", tags=["meta"])
def health(db: Session = Depends(get_db)):
    db.execute(select(func.now()))
    return {"status": "ok"}


@app.websocket("/ws")
async def realtime_socket(ws: WebSocket, token: str = Query(...)):
    """Live "something changed" pings. See app/realtime.py."""
    try:
        user_id = decode_access_token(token)
    except (jwt.PyJWTError, ValueError, KeyError):
        await ws.close(code=4401)
        return
    with SessionLocal() as db:
        user = db.get(Profile, user_id)
        if user is None or (user.role == UserRole.customer and user.is_blacklisted):
            await ws.close(code=4403)
            return
    await hub.connect(ws, user_id)
    try:
        while True:
            await ws.receive_text()  # keep-alive; clients may send "ping"
    except WebSocketDisconnect:
        pass
    finally:
        hub.disconnect(ws)
