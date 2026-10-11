from email.message import EmailMessage
from html import escape
import smtplib
import ssl

import httpx

from ..config import get_settings
from ..models import Booking


class EmailNotConfigured(Exception):
    pass


class EmailDeliveryFailed(Exception):
    pass


def _deliver_email(recipient: str, subject: str, text: str, html: str) -> None:
    settings = get_settings()
    smtp_configured = bool(settings.smtp_host and settings.smtp_from)
    resend_configured = bool(settings.resend_api_key and settings.email_from)
    if not smtp_configured and not resend_configured:
        raise EmailNotConfigured("Email is not configured. Set SMTP_HOST and SMTP_FROM (or RESEND_API_KEY and EMAIL_FROM) on the API server.")

    if smtp_configured:
        message = EmailMessage()
        message["From"] = settings.smtp_from
        message["To"] = recipient
        message["Subject"] = subject
        message.set_content(text)
        message.add_alternative(html, subtype="html")
        transport = smtplib.SMTP_SSL if settings.smtp_ssl else smtplib.SMTP
        try:
            with transport(settings.smtp_host, settings.smtp_port, timeout=15) as client:
                if settings.smtp_starttls and not settings.smtp_ssl:
                    client.starttls(context=ssl.create_default_context())
                if settings.smtp_username:
                    client.login(settings.smtp_username, settings.smtp_password or "")
                client.send_message(message)
        except (OSError, smtplib.SMTPException) as exc:
            raise EmailDeliveryFailed(f"Could not send email through SMTP: {exc}") from exc
        return

    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
            json={"from": settings.email_from, "to": [recipient], "subject": subject, "text": text, "html": html},
            timeout=15,
        )
    except httpx.HTTPError as exc:
        raise EmailDeliveryFailed(f"Could not reach the email provider: {exc}") from exc
    if response.status_code >= 400:
        raise EmailDeliveryFailed(f"Email provider rejected the message: {response.text}")


def send_notification_email(recipient: str, subject: str, text: str) -> str:
    paragraphs = "".join(f"<p>{escape(line)}</p>" for line in text.split("\n\n") if line)
    _deliver_email(recipient, subject, text, paragraphs)
    return recipient


def send_booking_approved_email(booking: Booking) -> str:
    """Send the booking approval email through configured SMTP or Resend."""
    settings = get_settings()
    customer = booking.customer
    if not customer.email:
        raise EmailDeliveryFailed("Customer email is missing")

    name = customer.full_name or "Customer"
    vehicle = f"{booking.vehicle.make or 'Vehicle'} {booking.vehicle.model or ''}".strip()
    pickup = f" at {booking.pickup_time.strftime('%H:%M')}" if booking.pickup_time else ""
    ret = f" at {booking.return_time.strftime('%H:%M')}" if booking.return_time else ""
    schedule = f"{booking.start_date}{pickup} to {booking.end_date}{ret}"
    address = settings.rental_address

    text = (
        f"Hello {name},\n\nYour booking requirements have been approved and verified.\n\n"
        f"Vehicle: {vehicle}\nSchedule: {schedule}\n\n"
        f"Please visit Pardz Car Rental at {address}. Submit one physical ID to our staff for vehicle release; "
        "it will be returned to you when the vehicle is returned.\n\nPardz Car Rental"
    )
    html = (
        f"<p>Hello {escape(name)},</p><p>Your booking requirements have been approved and verified.</p>"
        f"<p><strong>Vehicle:</strong> {escape(vehicle)}<br><strong>Schedule:</strong> {escape(schedule)}</p>"
        f"<p>Please visit Pardz Car Rental at <strong>{escape(address)}</strong>. Submit one physical ID to our staff "
        "for vehicle release; it will be returned to you when the vehicle is returned.</p><p>Pardz Car Rental</p>"
    )
    _deliver_email(customer.email, "Your Pardz Car Rental booking is approved", text, html)
    return customer.email