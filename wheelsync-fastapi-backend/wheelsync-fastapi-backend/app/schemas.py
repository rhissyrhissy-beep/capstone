import uuid
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .models import BookingStatus, InspectionType, UserRole, VehicleStatus


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------------ auth / profiles
class SignupIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=50)
    password: str = Field(min_length=6, max_length=128)
    role: Literal["customer", "admin"] = "customer"

    @field_validator("full_name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Full name is required")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str
    # Which app is signing in; the server rejects accounts of another role.
    portal: Literal["admin", "customer", "staff"] | None = None


class EmailIn(BaseModel):
    email: EmailStr


class ProfileOut(ORM):
    id: uuid.UUID
    full_name: str
    email: str
    phone: str | None
    age: int | None
    address: str | None
    role: UserRole
    is_blacklisted: bool
    id_type: str | None
    id_number: str | None
    id_photo_path: str | None
    second_id_type: str | None
    second_id_number: str | None
    second_id_photo_path: str | None
    proof_of_address_path: str | None
    proof_of_income_path: str | None
    extra_document_1_path: str | None
    extra_document_2_path: str | None
    verification_status: str
    verification_notes: str | None
    verified_at: datetime | None
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: ProfileOut


class AgeIn(BaseModel):
    age: int = Field(ge=1, le=120)


class StaffCreateIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=50)
    password: str = Field(min_length=6, max_length=128)


class StaffOut(ORM):
    id: uuid.UUID
    full_name: str
    email: str
    phone: str | None
    created_at: datetime


class BlacklistIn(BaseModel):
    is_blacklisted: bool


class VerificationReviewIn(BaseModel):
    status: Literal["verified", "rejected"]
    reason: str | None = Field(default=None, max_length=2000)


# ------------------------------------------------------------------ vehicles
Category = Literal["sedan", "suv", "van", "pickup"]


class VehicleCreate(BaseModel):
    make: str = Field(min_length=1, max_length=100)
    model: str = Field(min_length=1, max_length=100)
    year: int = Field(ge=1900, le=2100)
    plate_number: str = Field(min_length=1, max_length=30)
    category: Category = "sedan"
    description: str | None = Field(default=None, max_length=4000)
    daily_rate: float = Field(ge=0)
    price_per_km: float = Field(default=0, ge=0)
    image_url: str | None = None
    status: VehicleStatus = VehicleStatus.available


class VehicleUpdate(BaseModel):
    make: str | None = Field(default=None, min_length=1, max_length=100)
    model: str | None = Field(default=None, min_length=1, max_length=100)
    year: int | None = Field(default=None, ge=1900, le=2100)
    plate_number: str | None = Field(default=None, min_length=1, max_length=30)
    category: Category | None = None
    description: str | None = Field(default=None, max_length=4000)
    daily_rate: float | None = Field(default=None, ge=0)
    price_per_km: float | None = Field(default=None, ge=0)
    image_url: str | None = None
    status: VehicleStatus | None = None


class VehicleAdminOut(ORM):
    id: uuid.UUID
    make: str
    model: str
    year: int
    plate_number: str
    category: str
    description: str | None
    daily_rate: float
    price_per_km: float
    status: VehicleStatus
    image_url: str | None
    created_at: datetime


class VehicleCustomerOut(ORM):
    """Customers never see pricing columns (same as the old customer_vehicles view)."""

    id: uuid.UUID
    make: str
    model: str
    year: int
    plate_number: str
    category: str
    description: str | None
    status: VehicleStatus
    image_url: str | None
    created_at: datetime


class UnavailableDateOut(BaseModel):
    vehicle_id: uuid.UUID
    start_date: date
    end_date: date


# ------------------------------------------------------------------ bookings
ServiceType = Literal["self_drive", "with_driver", "pickup_dropoff"]


class BookingCreate(BaseModel):
    vehicle_id: uuid.UUID
    start_date: date
    end_date: date
    pickup_time: time | None = None
    return_time: time | None = None
    pickup_location: str | None = Field(default=None, max_length=500)
    service_type: ServiceType = "self_drive"
    distance_km: float = Field(default=0, ge=0)
    notes: str | None = Field(default=None, max_length=2000)


class AcceptIn(BaseModel):
    staff_id: uuid.UUID


class RejectIn(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)

    @field_validator("reason")
    @classmethod
    def _reason_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Enter a reason so the customer knows what to correct.")
        return value


class InspectionCreate(BaseModel):
    type: InspectionType
    checklist: dict = Field(default_factory=dict)
    odometer_reading: int | None = Field(default=None, ge=0)
    fuel_level: str | None = Field(default=None, max_length=20)
    damage_notes: str | None = Field(default=None, max_length=4000)
    damage_fee: float = Field(default=0, ge=0)


class InspectionOut(ORM):
    id: uuid.UUID
    booking_id: uuid.UUID
    staff_id: uuid.UUID
    type: InspectionType
    checklist: dict
    damage_notes: str | None
    damage_fee: float
    odometer_reading: int | None
    fuel_level: str | None
    created_at: datetime


class _VehicleBrief(ORM):
    make: str
    model: str
    plate_number: str


class _CustomerAdminBrief(ORM):
    id: uuid.UUID
    full_name: str
    email: str
    phone: str | None
    age: int | None
    address: str | None
    id_type: str | None
    id_number: str | None
    second_id_type: str | None
    second_id_number: str | None
    verification_status: str


class _CustomerStaffBrief(ORM):
    full_name: str
    phone: str | None


# NOTE: the nested keys are called `profiles` / `vehicles` on purpose. They keep the exact
# JSON shape the three front-ends were already written against, so no UI code had to change.
class BookingBase(ORM):
    id: uuid.UUID
    customer_id: uuid.UUID
    vehicle_id: uuid.UUID
    assigned_staff_id: uuid.UUID | None
    start_date: date
    end_date: date
    pickup_time: time | None
    return_time: time | None
    pickup_location: str | None
    service_type: str
    distance_km: float
    status: BookingStatus
    total_amount: float | None
    notes: str | None
    rejection_reason: str | None
    created_at: datetime
    vehicles: _VehicleBrief = Field(validation_alias="vehicle")


class BookingAdminOut(BookingBase):
    actual_return_date: date | None
    late_return: bool
    decided_by: uuid.UUID | None
    decided_at: datetime | None
    profiles: _CustomerAdminBrief = Field(validation_alias="customer")
    inspections: list[InspectionOut]


class BookingStaffOut(BookingBase):
    actual_return_date: date | None
    profiles: _CustomerStaffBrief = Field(validation_alias="customer")


class BookingCustomerOut(BookingBase):
    pass


# ------------------------------------------------------------------ notifications
class NotificationOut(ORM):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    body: str | None
    is_read: bool
    created_at: datetime
