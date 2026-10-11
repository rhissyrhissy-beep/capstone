from datetime import date
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, parse_uuid, require_admin, require_admin_or_staff, require_customer, require_staff
from ..config import get_settings
from ..models import Booking, BookingStatus, Profile, UserRole
from ..schemas import (
    AcceptIn, BookingAdminOut, BookingCustomerOut, BookingCreate, BookingStaffOut, RejectIn,
    InspectionCreate, InspectionOut,
)
from ..services import bookings as svc
from ..services.email import (
    EmailDeliveryFailed, EmailNotConfigured, send_booking_approved_email, send_notification_email,
)
from ..security import create_document_token
from ..services import storage
from ..services.agreement import RENTAL_AGREEMENT_TERMS

router = APIRouter(prefix="/bookings", tags=["bookings"])
logger = logging.getLogger(__name__)

STAFF_VISIBLE = (BookingStatus.accepted, BookingStatus.ongoing, BookingStatus.completed)
SORTS = {
    "created_desc": lambda: Booking.created_at.desc(),
    "start_asc": lambda: Booking.start_date.asc(),
    "start_desc": lambda: Booking.start_date.desc(),
}


def serialize(booking: Booking, user: Profile):
    if user.role == UserRole.admin:
        return BookingAdminOut.model_validate(booking)
    if user.role == UserRole.staff:
        return BookingStaffOut.model_validate(booking)
    return BookingCustomerOut.model_validate(booking)


def _parse_statuses(raw: str | None) -> list[BookingStatus] | None:
    if not raw or raw == "all":
        return None
    try:
        return [BookingStatus(s.strip()) for s in raw.split(",") if s.strip()]
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown booking status filter.")


@router.get("")
def list_bookings(
    status_filter: str | None = Query(default=None, alias="status", description="all | one status | comma-separated statuses"),
    start_from: date | None = None,
    start_to: date | None = None,
    sort: str = "created_desc",
    limit: int | None = Query(default=None, ge=1, le=1000),
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Role-scoped: admin = every booking, customer = own bookings, staff = bookings assigned to them."""
    stmt = svc.booking_query()
    if user.role == UserRole.customer:
        stmt = stmt.where(Booking.customer_id == user.id)
    elif user.role == UserRole.staff:
        stmt = stmt.where(Booking.assigned_staff_id == user.id, Booking.status.in_(STAFF_VISIBLE))

    wanted = _parse_statuses(status_filter)
    if wanted:
        stmt = stmt.where(Booking.status.in_(wanted))
    if start_from:
        stmt = stmt.where(Booking.start_date >= start_from)
    if start_to:
        stmt = stmt.where(Booking.start_date <= start_to)
    if sort not in SORTS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"sort must be one of {', '.join(SORTS)}")
    stmt = stmt.order_by(SORTS[sort](), Booking.id)
    if limit:
        stmt = stmt.limit(limit)
    return [serialize(b, user) for b in db.scalars(stmt).all()]


@router.post("", response_model=BookingCustomerOut, status_code=status.HTTP_201_CREATED)
def create_booking(data: BookingCreate, user: Profile = Depends(require_customer), db: Session = Depends(get_db)):
    return svc.create_booking(db, user, data)


@router.put("/{booking_id}/resubmit", response_model=BookingCustomerOut)
def resubmit_rejected_booking(
    booking_id: str,
    data: BookingCreate,
    user: Profile = Depends(require_customer),
    db: Session = Depends(get_db),
):
    return svc.resubmit_rejected_booking(db, parse_uuid(booking_id, "Booking"), user, data)


@router.get("/{booking_id}")
def get_booking(booking_id: str, user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = svc.get_booking_or_404(db, parse_uuid(booking_id, "Booking"))
    allowed = (
        user.role == UserRole.admin
        or (user.role == UserRole.customer and booking.customer_id == user.id)
        or (user.role == UserRole.staff and booking.assigned_staff_id == user.id)
    )
    if not allowed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
    return serialize(booking, user)


# ---- admin decisions
@router.post("/{booking_id}/accept", response_model=BookingAdminOut)
def accept(booking_id: str, data: AcceptIn, admin: Profile = Depends(require_admin), db: Session = Depends(get_db)):
    return svc.accept_booking(db, parse_uuid(booking_id, "Booking"), data.staff_id, admin)


@router.post("/{booking_id}/reject", response_model=BookingAdminOut)
def reject(booking_id: str, data: RejectIn, admin: Profile = Depends(require_admin), db: Session = Depends(get_db)):
    booking = svc.reject_booking(db, parse_uuid(booking_id, "Booking"), admin, data.reason)
    try:
        send_notification_email(
            booking.customer.email,
            "Your Pardz Car Rental booking needs changes",
            f"Your booking was rejected. Reason: {booking.rejection_reason} Please edit and resubmit the booking in My bookings for another review.",
        )
    except (EmailNotConfigured, EmailDeliveryFailed) as exc:
        logger.warning("Booking rejection email was not sent: %s", exc)
    return booking


@router.post("/{booking_id}/send-approval-email", dependencies=[Depends(require_admin)])
def send_approval_email(booking_id: str, db: Session = Depends(get_db)):
    booking = svc.get_booking_or_404(db, parse_uuid(booking_id, "Booking"))
    if booking.status != BookingStatus.accepted:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only accepted bookings can receive an approval email")
    try:
        sent_to = send_booking_approved_email(booking)
    except EmailNotConfigured as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))
    except EmailDeliveryFailed as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))
    return {"sent": True, "email": sent_to}


# ---- staff workflow
@router.post("/{booking_id}/start", response_model=BookingStaffOut)
def start(booking_id: str, user: Profile = Depends(require_admin_or_staff), db: Session = Depends(get_db)):
    return svc.start_rental(db, parse_uuid(booking_id, "Booking"), user)


@router.post("/{booking_id}/complete", response_model=BookingStaffOut)
def complete(booking_id: str, user: Profile = Depends(require_admin_or_staff), db: Session = Depends(get_db)):
    return svc.complete_rental(db, parse_uuid(booking_id, "Booking"), user)


@router.post("/{booking_id}/inspections", response_model=InspectionOut, status_code=status.HTTP_201_CREATED)
def create_inspection(booking_id: str, data: InspectionCreate, staff: Profile = Depends(require_staff), db: Session = Depends(get_db)):
    return svc.add_inspection(db, parse_uuid(booking_id, "Booking"), staff, data)


@router.get("/{booking_id}/inspections", response_model=list[InspectionOut])
def list_inspections(booking_id: str, user: Profile = Depends(require_admin_or_staff), db: Session = Depends(get_db)):
    booking = svc.get_booking_or_404(db, parse_uuid(booking_id, "Booking"))
    if user.role == UserRole.staff and booking.assigned_staff_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
    return booking.inspections


@router.get("/{booking_id}/print-pack")
def booking_print_pack(booking_id: str, admin: Profile = Depends(require_admin), db: Session = Depends(get_db)):
    booking = svc.get_booking_or_404(db, parse_uuid(booking_id, "Booking"))
    customer = booking.customer
    vehicle = booking.vehicle
    base = get_settings().public_base_url.rstrip("/")

    def document_link(path: str | None) -> str:
        if not path:
            return ""
        token = create_document_token(path)
        return f"{base}/files/{storage.DOCUMENT_BUCKET}/{path}?token={token}"

    return {
        "booking": {
            "id": str(booking.id), "start_date": booking.start_date, "end_date": booking.end_date,
            "pickup_time": booking.pickup_time, "return_time": booking.return_time,
            "pickup_location": booking.pickup_location, "service_type": booking.service_type,
            "distance_km": float(booking.distance_km), "total_amount": float(booking.total_amount or 0),
            "status": booking.status.value,
        },
        "customer": {
            "full_name": customer.full_name, "email": customer.email, "phone": customer.phone,
            "age": customer.age, "address": customer.address, "id_type": customer.id_type,
            "id_number": customer.id_number, "second_id_type": customer.second_id_type,
            "second_id_number": customer.second_id_number,
        },
        "vehicle": {
            "make": vehicle.make, "model": vehicle.model, "year": vehicle.year,
            "plate_number": vehicle.plate_number, "daily_rate": float(vehicle.daily_rate),
            "price_per_km": float(vehicle.price_per_km),
        },
        "agreement_terms": RENTAL_AGREEMENT_TERMS,
        "documents": {
            "Primary ID": document_link(customer.id_photo_path),
            "Second ID": document_link(customer.second_id_photo_path),
            "Proof of address": document_link(customer.proof_of_address_path),
            "Proof of income": document_link(customer.proof_of_income_path),
            "Additional document 1": document_link(customer.extra_document_1_path),
            "Additional document 2": document_link(customer.extra_document_2_path),
        },
        "inspections": [
            {
                "type": inspection.type.value, "checklist": inspection.checklist,
                "damage_notes": inspection.damage_notes, "damage_fee": float(inspection.damage_fee or 0),
                "odometer_reading": inspection.odometer_reading, "fuel_level": inspection.fuel_level,
                "created_at": inspection.created_at,
            }
            for inspection in booking.inspections
        ],
    }
