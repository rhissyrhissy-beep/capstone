"""Booking business rules.

These used to live in Postgres triggers (enforce_booking_rules, prevent_vehicle_booking_overlap,
require_post_rental_inspection_before_completion, sync_vehicle_status_with_booking,
notify_booking_change). They now live here, with the overlap rule additionally enforced by an
exclusion constraint in the database as a final safety net.
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..config import get_settings
from ..models import (
    Booking, BookingStatus, Inspection, InspectionType, Profile, UserRole, Vehicle, VehicleStatus,
)
from ..schemas import BookingCreate, InspectionCreate
from . import notifications as notes

OVERLAP_MESSAGE = "This vehicle is already reserved for part of the selected dates."
ACTIVE = (BookingStatus.accepted, BookingStatus.ongoing)


def today_local() -> date:
    return datetime.now(ZoneInfo(get_settings().timezone)).date()


def rental_days(start: date, end: date) -> int:
    return max(1, (end - start).days + 1)


def compute_total(vehicle: Vehicle, start: date, end: date, distance_km: float | Decimal) -> Decimal:
    days = rental_days(start, end)
    per_day = Decimal(vehicle.daily_rate) + Decimal(str(distance_km)) * Decimal(vehicle.price_per_km)
    return (per_day * days).quantize(Decimal("0.01"))


def booking_query():
    return select(Booking).options(
        selectinload(Booking.customer), selectinload(Booking.vehicle), selectinload(Booking.inspections)
    )


def get_booking_or_404(db: Session, booking_id: uuid.UUID, *, lock: bool = False) -> Booking:
    stmt = booking_query().where(Booking.id == booking_id)
    if lock:
        stmt = stmt.with_for_update(of=Booking)
    booking = db.execute(stmt).scalar_one_or_none()
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
    return booking


def _assert_no_overlap(db: Session, booking: Booking) -> None:
    clash = db.execute(
        select(Booking.id).where(
            Booking.vehicle_id == booking.vehicle_id,
            Booking.id != booking.id,
            Booking.status.in_(ACTIVE),
            Booking.start_date <= booking.end_date,
            Booking.end_date >= booking.start_date,
        ).limit(1)
    ).first()
    if clash:
        raise HTTPException(status.HTTP_409_CONFLICT, OVERLAP_MESSAGE)


def _commit_or_conflict(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if "bookings_no_active_overlap" in str(exc.orig):
            raise HTTPException(status.HTTP_409_CONFLICT, OVERLAP_MESSAGE)
        raise


def _validate_booking_request(
    db: Session,
    customer: Profile,
    data: BookingCreate,
    *,
    current_booking_id: uuid.UUID | None = None,
) -> Vehicle:
    if data.start_date > data.end_date:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The booking end date must be on or after the start date.")
    if data.start_date < today_local():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bookings cannot start in the past.")
    if customer.is_blacklisted:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This customer is currently restricted from making bookings.")
    if data.start_date == data.end_date and data.pickup_time and data.return_time and data.return_time <= data.pickup_time:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Return time must be after pickup time for a same-day rental.")
    if data.service_type == "pickup_dropoff" and not (data.pickup_location or "").strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A pickup / drop-off location is required for this service.")

    vehicle = db.get(Vehicle, data.vehicle_id)
    if vehicle is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle not found")
    if vehicle.status == VehicleStatus.maintenance:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This vehicle is currently under maintenance.")
    if current_booking_id is not None:
        clash = db.execute(
            select(Booking.id).where(
                Booking.id != current_booking_id,
                Booking.vehicle_id == vehicle.id,
                Booking.status.in_(ACTIVE),
                Booking.start_date <= data.end_date,
                Booking.end_date >= data.start_date,
            ).limit(1)
        ).first()
        if clash:
            raise HTTPException(status.HTTP_409_CONFLICT, OVERLAP_MESSAGE)
    return vehicle


# ----------------------------------------------------------------- create
def create_booking(db: Session, customer: Profile, data: BookingCreate) -> Booking:
    vehicle = _validate_booking_request(db, customer, data)
    booking = Booking(
        customer_id=customer.id,
        vehicle_id=vehicle.id,
        start_date=data.start_date,
        end_date=data.end_date,
        pickup_time=data.pickup_time,
        return_time=data.return_time,
        pickup_location=(data.pickup_location or "").strip() or None,
        service_type=data.service_type,
        distance_km=Decimal(str(data.distance_km)),
        notes=data.notes,
        status=BookingStatus.pending,  # clients can never choose the initial status
        total_amount=compute_total(vehicle, data.start_date, data.end_date, data.distance_km),
    )
    db.add(booking)
    db.flush()
    users = notes.notify_booking_created(db, booking)
    db.commit()
    notes.publish_after_commit(True, users)
    return get_booking_or_404(db, booking.id)


def resubmit_rejected_booking(
    db: Session,
    booking_id: uuid.UUID,
    customer: Profile,
    data: BookingCreate,
) -> Booking:
    booking = get_booking_or_404(db, booking_id, lock=True)
    if booking.customer_id != customer.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
    if booking.status != BookingStatus.rejected:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only rejected bookings can be edited and resubmitted.")

    vehicle = _validate_booking_request(db, customer, data, current_booking_id=booking.id)
    booking.vehicle_id = vehicle.id
    booking.vehicle = vehicle
    booking.start_date = data.start_date
    booking.end_date = data.end_date
    booking.pickup_time = data.pickup_time
    booking.return_time = data.return_time
    booking.pickup_location = (data.pickup_location or "").strip() or None
    booking.service_type = data.service_type
    booking.distance_km = Decimal(str(data.distance_km))
    booking.notes = data.notes
    booking.total_amount = compute_total(vehicle, data.start_date, data.end_date, data.distance_km)
    booking.status = BookingStatus.pending
    booking.rejection_reason = None
    booking.assigned_staff_id = None
    booking.decided_by = None
    booking.decided_at = None

    admins = db.scalars(select(Profile).where(Profile.role == UserRole.admin)).all()
    for admin in admins:
        notes.add_notification(
            db,
            admin.id,
            "Customer updated rejected booking",
            f"{customer.full_name} edited and resubmitted rejected booking {booking.id} for "
            f"{vehicle.make} {vehicle.model} ({data.start_date} to {data.end_date}). Review it in Pending bookings.",
        )
    db.commit()
    notes.publish_after_commit(True, [admin.id for admin in admins])
    return get_booking_or_404(db, booking.id)


# ----------------------------------------------------------------- admin decisions
def accept_booking(db: Session, booking_id: uuid.UUID, staff_id: uuid.UUID, admin: Profile) -> Booking:
    booking = get_booking_or_404(db, booking_id, lock=True)
    if booking.status not in (BookingStatus.pending, BookingStatus.rejected):
        raise HTTPException(status.HTTP_409_CONFLICT, "This booking is no longer pending or rejected.")
    if booking.customer.verification_status != "verified":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Verify the customer's requirements before accepting this booking.")
    staff = db.get(Profile, staff_id)
    if staff is None or staff.role != UserRole.staff:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose a valid staff member to assign.")
    _assert_no_overlap(db, booking)

    booking.status = BookingStatus.accepted
    booking.assigned_staff_id = staff.id
    booking.decided_by = admin.id
    booking.decided_at = datetime.now(timezone.utc)
    db.flush()
    users = notes.notify_booking_status_change(db, booking, get_settings().rental_address)
    users += notes.notify_staff_assigned(db, booking)
    _commit_or_conflict(db)
    notes.publish_after_commit(True, users)
    return get_booking_or_404(db, booking.id)


def reject_booking(db: Session, booking_id: uuid.UUID, admin: Profile, reason: str) -> Booking:
    booking = get_booking_or_404(db, booking_id, lock=True)
    if booking.status not in (BookingStatus.pending, BookingStatus.rejected):
        raise HTTPException(status.HTTP_409_CONFLICT, "This booking is no longer pending or rejected.")
    booking.status = BookingStatus.rejected
    booking.rejection_reason = reason.strip()
    booking.decided_by = admin.id
    booking.decided_at = datetime.now(timezone.utc)
    db.flush()
    users = notes.notify_booking_status_change(db, booking, get_settings().rental_address)
    db.commit()
    notes.publish_after_commit(True, users)
    return get_booking_or_404(db, booking.id)


# ----------------------------------------------------------------- staff workflow
def _assert_can_work_on(booking: Booking, user: Profile) -> None:
    if user.role == UserRole.admin:
        return
    if user.role == UserRole.staff and booking.assigned_staff_id == user.id:
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "This booking is not assigned to you.")


def start_rental(db: Session, booking_id: uuid.UUID, user: Profile) -> Booking:
    booking = get_booking_or_404(db, booking_id, lock=True)
    _assert_can_work_on(booking, user)
    if booking.status != BookingStatus.accepted:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only accepted bookings can be started.")
    booking.status = BookingStatus.ongoing
    if booking.vehicle.status == VehicleStatus.available:
        booking.vehicle.status = VehicleStatus.rented
    db.flush()
    users = notes.notify_booking_status_change(db, booking, get_settings().rental_address)
    _commit_or_conflict(db)
    notes.publish_after_commit(True, users)
    return get_booking_or_404(db, booking.id)


def complete_rental(db: Session, booking_id: uuid.UUID, user: Profile) -> Booking:
    booking = get_booking_or_404(db, booking_id, lock=True)
    _assert_can_work_on(booking, user)
    if booking.status != BookingStatus.ongoing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only ongoing rentals can be completed.")
    if not any(i.type == InspectionType.post_rental for i in booking.inspections):
        raise HTTPException(status.HTTP_409_CONFLICT, "A post-rental inspection must be completed before releasing the vehicle.")

    returned_on = today_local()
    booking.status = BookingStatus.completed
    booking.actual_return_date = returned_on
    booking.late_return = returned_on > booking.end_date
    if booking.vehicle.status == VehicleStatus.rented:
        booking.vehicle.status = VehicleStatus.available
    db.flush()
    users = notes.notify_booking_status_change(db, booking, get_settings().rental_address)
    db.commit()
    notes.publish_after_commit(True, users)
    return get_booking_or_404(db, booking.id)


def add_inspection(db: Session, booking_id: uuid.UUID, staff: Profile, data: InspectionCreate) -> Inspection:
    booking = get_booking_or_404(db, booking_id, lock=True)
    if booking.assigned_staff_id != staff.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This booking is not assigned to you.")
    if booking.status not in (BookingStatus.accepted, BookingStatus.ongoing):
        raise HTTPException(status.HTTP_409_CONFLICT, "Inspections can only be recorded for accepted or ongoing bookings.")
    inspection = Inspection(
        booking_id=booking.id,
        staff_id=staff.id,
        type=data.type,
        checklist=data.checklist,
        odometer_reading=data.odometer_reading,
        fuel_level=data.fuel_level,
        damage_notes=data.damage_notes,
        damage_fee=Decimal(str(data.damage_fee)),
    )
    db.add(inspection)
    db.commit()
    notes.publish_after_commit(True, [])
    return inspection
