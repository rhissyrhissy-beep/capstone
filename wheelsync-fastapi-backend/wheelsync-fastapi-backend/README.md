# WheelSync API (FastAPI + PostgreSQL)

Backend for the three WheelSync apps (admin web, customer web, staff mobile) of **Pardz Car Rental**.
It is the only backend: apps talk to it over REST + one WebSocket, and it owns PostgreSQL directly.

| Old BaaS piece                                | Now                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------- |
| Auth (`auth.users`, JWT sessions)            | `profiles.password_hash` (bcrypt) + JWT bearer tokens (`/auth/*`)    |
| PostgREST + Row Level Security               | REST endpoints with per-role checks in code (`app/routers/*`)        |
| SQL triggers (booking rules, notifications…) | Python services (`app/services/bookings.py`, `notifications.py`)     |
| Overlap trigger                              | Same check in Python **plus** a PostgreSQL `EXCLUDE` constraint      |
| Edge Function `create-staff`                 | `POST /admin/staff`                                                  |
| Edge Function `send-booking-accepted-email`  | `POST /bookings/{id}/send-approval-email` (SMTP / Resend)             |
| Storage buckets                              | Local disk, `UPLOAD_DIR` (`app/services/storage.py`)                 |
| Realtime (`postgres_changes`)                | WebSocket `/ws?token=…` (`app/realtime.py`)                          |

## Quick start (Docker)

```bash
cp .env.example .env            # then set JWT_SECRET (and PUBLIC_BASE_URL / CORS_ORIGINS if needed)
docker compose up --build
```

API on <http://localhost:8000>, interactive docs on <http://localhost:8000/docs>.
Tables are created automatically on start-up.

## Quick start (without Docker)

```bash
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                  # point DATABASE_URL at your PostgreSQL
uvicorn app.main:app --reload --port 8000
```

You need a PostgreSQL 13+ database that the user in `DATABASE_URL` can use, and the `btree_gist`
extension (ships with the standard `postgresql-contrib` package; the API runs
`CREATE EXTENSION IF NOT EXISTS btree_gist` itself, which needs a role allowed to create extensions).
Prefer to provision by hand? `psql "$DATABASE_URL" -f db/schema.sql`.

## First admin

Either open the admin web app → **Create the admin account** (works **only while no admin exists**),
or from the command line:

```bash
python -m scripts.create_admin "Juan Dela Cruz" admin@pardzcarrental.com 'a-strong-password'
```

Set `ALLOW_ADMIN_SIGNUP=false` to disable the web route entirely. Staff accounts are made by an admin
(Staff page). Customers self-register.

## Tests

```bash
pip install -r requirements-dev.txt
# needs an empty PostgreSQL database; defaults to postgresql://wheelsync:wheelsync@localhost:5432/wheelsync_test
DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/wheelsync_test pytest
```

The suite (20 tests) runs against a real PostgreSQL: auth + portals, role isolation, the full
pending → accepted → ongoing → completed lifecycle, overlap protection, verification + signed
document links, notifications, email, and WebSocket events. **It drops and recreates all tables in
that database — never point it at real data.**

## Configuration

See `.env.example`. The ones that matter:

* `DATABASE_URL`, `JWT_SECRET` (required for production; the app refuses to start in
  `ENVIRONMENT=production` with the default secret).
* `CORS_ORIGINS` – every URL the web apps are served from.
* `PUBLIC_BASE_URL` – the address **browsers** use to reach this API. It is embedded in vehicle-image
  URLs and document links, so set it to your public HTTPS URL when deployed.
* `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_STARTTLS`, and
  `SMTP_SSL` – approval, rejection, and new-requirements emails. SMTP is preferred when `SMTP_HOST` and
  `SMTP_FROM` are set. Port `587` normally uses STARTTLS; port `465` normally uses implicit TLS
  (`SMTP_SSL=true`, `SMTP_STARTTLS=false`). Keep credentials in `.env`, never in source control.
  For Gmail, use `smtp.gmail.com` and a Google app password (not the normal account password).
  `RESEND_API_KEY` / `EMAIL_FROM` remain an optional fallback. Without either provider, in-app
  notifications still work and email delivery is skipped.

## Endpoints

Everything except `/auth/signup`, `/auth/login`, `/health`, `/files/vehicle-images/*` needs
`Authorization: Bearer <token>`. Full, testable list at `/docs`.

| Method & path                                  | Who               | Purpose |
| ---------------------------------------------- | ----------------- | ------- |
| `POST /auth/signup`                            | public            | Customer sign-up (admin only while none exists) |
| `POST /auth/login`                             | public            | `{email,password,portal?}` → `{access_token,user}`; `portal` rejects wrong-role accounts |
| `GET /auth/me`                                 | any               | Current profile |
| `PUT /me/age`                                  | customer          | Set age |
| `POST /me/verification`                        | customer          | multipart: ID details + `first_id`,`second_id`,`proof_of_address`,`proof_of_income` |
| `GET /vehicles`                                | any               | Admin: whole fleet + pricing. Others: available vehicles, no pricing |
| `GET /vehicles/unavailable-dates`              | any               | Occupied date ranges per vehicle |
| `POST /vehicles`, `PATCH`/`DELETE /vehicles/{id}`, `POST /vehicles/images` | admin | Fleet management |
| `GET /bookings`                                | any (role-scoped) | Filters: `status` (`all`/one/comma list), `start_from`, `start_to`, `sort`, `limit` |
| `POST /bookings`                               | customer          | Request a booking (price is computed server-side) |
| `POST /bookings/{id}/accept` `{staff_id}` / `/reject` | admin      | Decide a pending booking |
| `POST /bookings/{id}/send-approval-email`      | admin             | Resend approval email |
| `POST /bookings/{id}/start` / `/complete`      | assigned staff    | Start rental / finish (needs a post-rental inspection) |
| `POST /bookings/{id}/inspections`              | assigned staff    | Save pre/post-rental inspection |
| `GET /notifications`, `/notifications/unread-count`, `POST /notifications/{id}/read` | any | Own notifications |
| `GET /admin/customers`, `…/booking-history`, `PATCH …/{id}/blacklist`, `POST …/{id}/verification`, `GET …/{id}/documents` | admin | Customer management |
| `GET /admin/staff`, `POST /admin/staff`        | admin             | Staff accounts |
| `GET /admin/dashboard`                         | admin             | Dashboard numbers |
| `WS /ws?token=…`                               | any               | `{"table":"bookings"}` / `{"table":"notifications"}` change pings |

Bookings are returned with nested `profiles` (customer) and `vehicles` keys — deliberately the same
JSON shape the front-ends already used, so the UI code stayed almost unchanged. What each role sees inside
`profiles` differs (admin: ID details; staff: name + phone only; customer: no customer block).

## Behaviour notes / decisions you may want to review

* **Single worker.** The realtime hub is in-process, so run one uvicorn worker. To scale out, publish
  through Redis or PostgreSQL `LISTEN/NOTIFY` inside `RealtimeHub.publish`.
* **Sessions** are 12-hour access tokens (`ACCESS_TOKEN_EXPIRE_MINUTES`); there is no refresh token, users sign in again after expiry.
* **Files** live on local disk. Back up `UPLOAD_DIR` (or the Docker `uploads` volume) together with the database.
  Customer documents are private and only open through 5-minute signed links minted for admins.
* **Stricter than before:** accepting a booking now *requires* a verified customer on the server (it was
  only a UI check), and status changes follow `pending → accepted → ongoing → completed` only.
* **New:** `late_return` is now set automatically when a rental is completed after its end date (nothing
  populated it before, which starved the churn model).
* **Moving data from the old hosted backend:** not automated. Its auth table stores bcrypt hashes, which this API can
  verify as-is, so users *can* keep their passwords if you copy `auth.users.encrypted_password` into
  `profiles.password_hash` when exporting — but that migration is untested here; try it on a copy first.
  Files must be copied out of the Storage buckets into `UPLOAD_DIR/vehicle-images/` and
  `UPLOAD_DIR/customer-documents/<user-id>/`, and the `*_path` / `image_url` values updated to match.
