from datetime import datetime, timedelta, timezone
import hashlib
import html
import secrets

from fastapi import APIRouter, Depends, Form, HTTPException, status
from fastapi.responses import HTMLResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..deps import get_current_user
from ..models import Profile, UserRole
from ..schemas import EmailIn, LoginIn, ProfileOut, SignupIn, TokenOut
from ..services.email import EmailDeliveryFailed, EmailNotConfigured, send_verification_email
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
VERIFICATION_TOKEN_LIFETIME = timedelta(hours=24)

PORTAL_ROLE = {"admin": UserRole.admin, "customer": UserRole.customer, "staff": UserRole.staff}
PORTAL_MESSAGE = {
    "admin": "This account is not an admin account.",
    "customer": "This login is for customer accounts only.",
    "staff": "This app is for staff accounts only. Ask your admin for a staff login.",
}


def _new_verification_token() -> str:
    return secrets.token_urlsafe(32)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _send_activation_email(email: str, token: str) -> None:
    try:
        send_verification_email(email, token)
    except (EmailNotConfigured, EmailDeliveryFailed) as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "The account was saved, but its activation email could not be sent. Configure email and request another activation email.",
        ) from exc


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(data: SignupIn, db: Session = Depends(get_db)):
    """Customers can always self-register. An admin can self-register only while no admin exists yet.
    Staff accounts are created by an admin (POST /admin/staff)."""
    email = data.email.strip().lower()
    role = UserRole(data.role)

    if role == UserRole.admin:
        admin_count = db.scalar(select(func.count()).select_from(Profile).where(Profile.role == UserRole.admin))
        if not get_settings().allow_admin_signup or admin_count:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin sign-up is closed. Ask an existing admin to create your account.")

    if db.scalar(select(Profile.id).where(Profile.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "User already registered")

    user = Profile(
        full_name=data.full_name,
        email=email,
        phone=(data.phone or "").strip() or None,
        password_hash=hash_password(data.password),
        role=role,
        email_verified=False,
    )
    token = _new_verification_token()
    user.email_verification_token_hash = _token_hash(token)
    user.email_verification_expires_at = datetime.now(timezone.utc) + VERIFICATION_TOKEN_LIFETIME
    db.add(user)
    db.commit()
    _send_activation_email(email, token)
    return {"detail": "Account created. Check your email and activate your account before signing in."}


@router.get("/verify-email", response_class=HTMLResponse, include_in_schema=False)
def show_email_verification_form(token: str):
    safe_token = html.escape(token, quote=True)
    return HTMLResponse(
        "<!doctype html><html><head><meta charset='utf-8'><title>Activate WheelSync account</title></head>"
        "<body style='font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:1rem'>"
        "<h1>Activate your WheelSync account</h1>"
        "<p>Press the button below to confirm your email address.</p>"
        "<form method='post' action='/auth/verify-email'>"
        f"<input type='hidden' name='token' value='{safe_token}'>"
        "<button style='padding:.75rem 1rem' type='submit'>Activate account</button>"
        "</form></body></html>"
    )


@router.post("/verify-email", response_class=HTMLResponse)
def verify_email(token: str = Form(...), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    user = db.scalar(
        select(Profile).where(
            Profile.email_verification_token_hash == _token_hash(token),
            Profile.email_verification_expires_at > now,
            Profile.email_verified.is_(False),
        )
    )
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This activation link is invalid, expired, or already used.")

    user.email_verified = True
    user.email_verification_token_hash = None
    user.email_verification_expires_at = None
    db.commit()
    return HTMLResponse(
        "<!doctype html><html><head><meta charset='utf-8'><title>Email activated</title></head>"
        "<body style='font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:1rem'>"
        "<h1>Email confirmed</h1><p>Your WheelSync account is active. Return to the app and sign in.</p></body></html>"
    )


@router.post("/resend-verification")
def resend_verification(data: EmailIn, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    user = db.scalar(select(Profile).where(Profile.email == email))
    if user is None or user.email_verified:
        return {"detail": "If the account needs activation, an activation email will be sent."}

    token = _new_verification_token()
    user.email_verification_token_hash = _token_hash(token)
    user.email_verification_expires_at = datetime.now(timezone.utc) + VERIFICATION_TOKEN_LIFETIME
    db.commit()
    _send_activation_email(email, token)
    return {"detail": "If the account needs activation, an activation email will be sent."}


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(Profile).where(Profile.email == data.email.strip().lower()))
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid login credentials")
    if data.portal and user.role != PORTAL_ROLE[data.portal]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, PORTAL_MESSAGE[data.portal])
    if not user.email_verified:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Please activate your email address before signing in.")
    if user.role == UserRole.customer and user.is_blacklisted:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is currently restricted. Please contact Pardz Car Rental.")
    return TokenOut(access_token=create_access_token(user.id), user=user)


@router.get("/me", response_model=ProfileOut)
def me(user: Profile = Depends(get_current_user)):
    return user
