# i-WASTE Backend API

Base URL: `/api`. All dates are ISO-8601 UTC. JSON errors use `{ "error": { "code": "...", "message": "..." } }`; paginated responses use `{ "data": [], "pagination": { "page", "limit", "total", "pages" } }`.

## Database design

PostgreSQL is the source of truth. Prisma models include `users`, refresh/reset tokens, audit logs, trucks, routes and ordered route checkpoints, trip tickets and checkpoints, pickup/tree/waterway/environmental/recyclables requests, accredited junkshops and monthly material reports, private attachments, announcements, event RSVPs, and notifications. Completed pickup and recyclable collections store measured kilograms; environmental reports can be assigned to an active admin. Request records carry UUID primary keys and unique human-readable reference numbers.

Trip location is derived exclusively from an administrator's trip ticket/checkpoint events; the service does not collect GPS coordinates. Map-ready route coordinates are optional.

## Authentication and access

- `POST /auth/register` — create a resident; requires full name, email, and a 12+ character password. Email verification is currently optional and is not required for sign-in.
- `POST /auth/guest` — describes guest-accessible public features; does not issue credentials.
- `POST /auth/login` — resident or administrator email/password login; returns a short-lived access JWT and sets an HttpOnly refresh cookie.
- `POST /auth/admin/login` — admin-only login endpoint for the single `/admin/login` page; successful roles redirect to `/admin` or `/super-admin`.
- `POST /auth/refresh` — rotates the refresh token cookie and returns a new access JWT.
- `POST /auth/logout` — revokes the refresh token and clears its cookie.
- `POST /auth/email/verify` — consumes a single-use, expiring email verification token.
- `POST /auth/password/change` — authenticated; body: `currentPassword`, `newPassword`.
- `POST /auth/password/reset` — privacy-preserving reset preparation response. A mail provider must be configured before this can deliver a reset link; this endpoint never returns a reset token.
- `GET /auth/profile`, `PATCH /auth/profile` — authenticated user's own name and contact details; email and role are read-only.
- `GET /auth/profile/photo`, `PUT /auth/profile/photo` — authenticated user's private profile picture; JPG, PNG, or WebP, up to 5 MB.
- `GET /users/roles` — super-admin-only paginated user list.
- `PATCH /users/:id/role` — super-admin-only; set a non-super-admin account to `RESIDENT` or `ADMIN`. Self-role changes and edits to super-admin accounts are rejected. Role changes revoke the user's refresh sessions; demoting an admin also clears their truck assignments and report-investigator assignments.

Send short-lived access tokens as `Authorization: Bearer <token>`; they remain in frontend memory. Refresh cookies are HttpOnly, SameSite=Strict, path-scoped, and Secure in production. Refresh, logout, and login requests validate the trusted Origin. Roles are `RESIDENT`, `ADMIN`, and `SUPER_ADMIN`. Admin permissions are checked on the API for request management, status updates, reports, junkshop recording, announcements, and private attachments. Super-admins can access operational dashboard and reporting endpoints, manage user roles, and configure the full truck fleet and collection routes; they do not inherit admin request-management or announcement permissions. Five consecutive invalid password attempts lock resident and admin accounts for 15 minutes. Super-admin accounts are exempt from account lockout; the API's IP-based rate limits still apply.

Email verification is currently not required for login. The verification endpoint and token model remain available for compatibility, but new resident and admin accounts do not require verification to sign in.

## Services and tracking

- `GET /trucks`, `GET /routes`, `GET /trips/public`, `GET /trips/:id` — public tracking data. Public truck listings omit QR secrets and public trip history is capped at the latest 100 matching records.
- `GET /trucks/manage` — authenticated admin fleet data; admins see trucks assigned to them, while super-admins can manage the full fleet.
- `GET /trucks/qr/:code` — authenticated admin or super-admin QR verification.
- `POST /trucks`, `PUT /trucks/:id` — admin or super-admin fleet registration and updates. Admins remain limited to trucks assigned to their own account; super-admins can manage any truck and assign it to an active admin. Truck creation returns a QR data URL.
- `POST /routes`, `PUT /routes/:id` — admin or super-admin route/checkpoint maintenance. `GET /routes/manage` is super-admin-only and includes inactive routes; public `GET /routes` continues to list active routes only.
- `POST /trips`, `POST /trips/:id/checkpoints`, `POST /trips/:id/complete`, `GET /trips` — admin or super-admin trip-ticket operations and historical records. Admins remain limited to trips for trucks assigned to their account; super-admins can manage all trips. History accepts `truckId`, `from`, and `to` filters.
- `POST /pickup-requests` — resident, guest, or anonymous pickup submission.
- `POST /tree-requests` — tree cutting/pruning; multipart `photo` is required. Private-land submissions require a DENR reference or `denrDocument`.
- `POST /waterway-requests` — multipart `photo` is required.
- `POST /environmental-reports` — multipart `photo` is required; the resident selects illegal dumping or missed collection. `anonymous=true` omits reporter identity; identified reports require a phone number or email.
- `POST /recyclables-requests` — multipart `photos` (1-5) required; stores the resident's material, pickup address, fulfillment, and preferred date.
- `GET /{pickup-requests|tree-requests|waterway-requests|environmental-reports|recyclables-requests}` — authenticated, paginated list; residents see their own records, admins see all.
- `GET /{collection}/track/:referenceNo` — public status tracking; does not return reporter contact details.
- `GET /requests/track/:referenceNo` — public tracker resolving any supported request prefix and returning a status-only history timeline.
- `PATCH /{collection}/:id/status` — admin status transitions and completion proof uploads. Completing pickup requests requires actual `measuredWasteKg`, with optional `measuredRecyclablesKg` and `measuredCompostKg` (kilograms). Completing a recyclable request requires `actualCollectedKg`. Environmental reports can be assigned to an active admin with `assignedInvestigatorId`.
- `GET /notifications`, `PATCH /notifications/:id/read` — authenticated user's notifications.
- `GET /attachments/:id` — private attachment download; request owner, or an admin/super-admin with the relevant report or request permission.
- `GET /public/dashboard` — public aggregate dashboard metrics computed from database requests, trucks, trips, measurements, and resident accounts.
- `GET /dashboard/stats` — admin and super-admin operational request, pending-approval, complaint, and six-month activity counts, plus active-truck IDs and latest recorded streets.
- `GET /announcements` — public published events, activity schedules, greetings, announcements, memos, and ordinance references. Signed-in residents receive their RSVP status.
- `POST /announcements/:id/rsvp` — authenticated resident RSVP for a published community event or activity schedule.
- `GET /announcements/manage`, `POST /announcements`, `PATCH /announcements/:id`, `DELETE /announcements/:id` — admin-permission-protected announcement management.
- `GET /reports/volumes?month=YYYY-MM[&truckId=<uuid>&household=<address>]` — admin-permission-protected monthly measured-weight summary, grouped by household address and truck; the household filter matches part of an address without case sensitivity. Includes accredited junkshop material totals by category and shop.
- `GET /reports/export?type=volumes&month=YYYY-MM[&truckId=<uuid>&household=<address>]&format=csv|xlsx|pdf` — export the filtered monthly volumes. Landfill kilograms are total measured kilograms minus recyclable kilograms.
- `GET /reports/export?type=pickup|land|water|environmental|trips&format=csv|xlsx|pdf&from=<date>&to=<date>` — admin-permission-protected export, capped at 5,000 records; each export is audited. CSV is the default.
- `GET /junkshops` — active accredited junkshops, available only to admins with `reports:manage` and super-admins.
- `POST /junkshops` — register an accredited junkshop with its name, accreditation number, address, and optional contact details. Duplicate accreditation numbers are rejected and the action is audited.
- `GET /junkshop-reports?page=1&limit=10` — protected recent monthly reports, including material measurements and private supporting-document metadata.
- `POST /junkshop-reports` — protected multipart report submission. Fields: `junkshopId`, `month` (`YYYY-MM`), optional `truckId`, `householdAddress`, and `notes`, `materials` (JSON array of category, quantity/unit, weight in kg, and volume in m³), and 1–5 `supportingDocuments` files. Material rows and files are validated; records are audited and included in monthly reports and exports.

Volume reports include only collections with measurements recorded at completion; historical requests without measurements are not backfilled. Monthly junkshop reports contribute their recorded recyclable weight to diversion totals and, when provided, household/truck breakdowns. Landfill disposal is never reported as a negative value; an overage warning is included when recyclable measurements exceed the recorded collection weight. Household grouping uses the recorded pickup address or report household address.

Request statuses are `SUBMITTED`, `UNDER_REVIEW`, `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, and `REJECTED`. Truck statuses are `ACTIVE`, `IDLE`, `MAINTENANCE`, and `ROUTE_COMPLETED`. Query list endpoints with `page` (1-based), `limit` (1-100), and optional `status`.

New request references contain 64 bits of random entropy. Existing 48-bit references remain trackable. Status history starts at submission for new records; for records created before this migration, only submission and the latest known status can be reconstructed because intermediate updates were not stored.

## Attachments

Multipart files are held in memory only for validation, checked against allowed MIME types and magic bytes, then written with random names and restrictive file permissions. Uploads are not served statically. Local disk is suitable only when the deployment provides a durable private volume and backups; production multi-instance deployments should replace `src/utils/attachments.js` with private object storage and expiring authorized downloads. Maximum size is configured with `MAX_UPLOAD_BYTES`.

## Local setup

1. Use Node.js 20+ and PostgreSQL. From `backend`, copy `.env.example` to `.env`; set `SERVER_URL`, `CLIENT_URL`, a TLS-enabled `DATABASE_URL`, a strong random `JWT_ACCESS_SECRET` (32+ characters), and initial superadmin values. `FRONTEND_ORIGINS` remains supported for existing environments; `CLIENT_URL` is preferred.
2. Install dependencies with `npm install`.
3. Generate the client and apply migrations with `npm run prisma:generate` and `npm run prisma:migrate`.
4. Bootstrap the initial superadmin using `npm run db:seed`, then remove the seed credentials from the environment.
5. Start with `npm run dev`; health check is `GET /health`.

## Production deployment

- Terminate HTTPS at a trusted reverse proxy/load balancer; production requests without HTTPS are rejected. Set `SERVER_URL` to the public HTTPS API origin, `CLIENT_URL` to the exact HTTPS frontend origins, and `COOKIE_SECURE=true`.
- If deployed behind a proxy, set `TRUST_PROXY_HOPS` to the exact number of trusted hops; do not trust arbitrary forwarded headers.
- Use a managed PostgreSQL instance with TLS (`sslmode=require` or stronger), least-privilege database credentials, automated backups, and tested restore procedures.
- Inject secrets from a secret manager, never commit `.env`; rotate JWT/database credentials and remove bootstrap seed variables after initialization. Production startup requires HTTPS origins, TLS database connections, and an absolute upload-volume path.
- Run `npm run prisma:migrate` as a controlled release step before rolling out application instances. Run multiple stateless API instances behind a load balancer; use private durable/object storage for attachments.
- Configure outbound email and implement delivery/consumption for password-reset tokens before enabling account recovery in production.
- Monitor structured application logs, database health, rate-limit events, disk usage, and failed authentication; avoid logging credentials, tokens, or report contents.
- Consider malware scanning for uploads, retention/deletion policies, a formal privacy notice, and a government-approved incident response process.

Email delivery, real-time push delivery, and production object storage require deployment integrations; the API provides audited CSV/XLSX/PDF exports and persisted in-app notifications.
