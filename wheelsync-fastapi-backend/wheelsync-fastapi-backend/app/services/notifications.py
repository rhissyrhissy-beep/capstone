import uuid

from sqlalchemy.orm import Session

from ..models import Booking, BookingStatus, Notification
from ..realtime import hub


def add_notification(db: Session, user_id: uuid.UUID, title: str, body: str | None) -> Notification:
    n = Notification(user_id=user_id, title=title, body=body)
    db.add(n)
    return n


def notify_booking_created(db: Session, booking: Booking) -> list[uuid.UUID]:
    add_notification(
        db, booking.customer_id,
        "Booking request received",
        "Your booking request has been submitted for administrator review.",
    )
    return [booking.customer_id]


def notify_booking_status_change(db: Session, booking: Booking, rental_address: str) -> list[uuid.UUID]:
    """Customer notification for a status change (mirrors the old notify_booking_change trigger)."""
    if booking.status == BookingStatus.accepted:
        title = "Booking approved"
        body = (
            "Your booking requirements are approved and verified. "
            f"Please visit Pardz Car Rental at {rental_address}. "
            "Bring one physical ID for vehicle release; it will be returned to you when the vehicle is returned."
        )
    elif booking.status == BookingStatus.rejected and booking.rejection_reason:
        title = "Booking needs changes"
        body = f"Your booking was rejected. Reason: {booking.rejection_reason} Please review your details and contact Pardz Car Rental if you need to update your requirements."
    else:
        title = "Booking status updated"
        body = f"Your booking is now {booking.status.value.replace('_', ' ')}."
    add_notification(db, booking.customer_id, title, body)
    return [booking.customer_id]


def notify_staff_assigned(db: Session, booking: Booking) -> list[uuid.UUID]:
    if booking.assigned_staff_id is None:
        return []
    add_notification(
        db, booking.assigned_staff_id,
        "Booking assigned",
        "A booking has been assigned to you. Open My jobs for the inspection details.",
    )
    return [booking.assigned_staff_id]


def publish_after_commit(booking_changed: bool, notified_users: list[uuid.UUID]) -> None:
    """Call AFTER db.commit() so clients that refetch immediately see the new rows."""
    if booking_changed:
        hub.publish("bookings")
    for uid in set(notified_users):
        hub.publish("notifications", uid)
