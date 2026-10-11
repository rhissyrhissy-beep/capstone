from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..deps import get_current_user
from ..models import Profile, UserRole
from ..schemas import LoginIn, ProfileOut, SignupIn, TokenOut
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

PORTAL_ROLE = {"admin": UserRole.admin, "customer": UserRole.customer, "staff": UserRole.staff}
PORTAL_MESSAGE = {
    "admin": "This account is not an admin account.",
    "customer": "This login is for customer accounts only.",
    "staff": "This app is for staff accounts only. Ask your admin for a staff login.",
}


@router.post("/signup", response_model=ProfileOut, status_code=status.HTTP_201_CREATED)
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
    )
    db.add(user)
    db.commit()
    return user


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(Profile).where(Profile.email == data.email.strip().lower()))
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid login credentials")
    if data.portal and user.role != PORTAL_ROLE[data.portal]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, PORTAL_MESSAGE[data.portal])
    if user.role == UserRole.customer and user.is_blacklisted:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is currently restricted. Please contact Pardz Car Rental.")
    return TokenOut(access_token=create_access_token(user.id), user=user)


@router.get("/me", response_model=ProfileOut)
def me(user: Profile = Depends(get_current_user)):
    return user
