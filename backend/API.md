# i-WASTE Backend API

Base URL: `/api`. All dates are ISO-8601 UTC. JSON errors use `{ "error": { "code": "...", "message": "..." } }`; paginated responses use `{ "data": [], "pagination": { "page", "limit", "total", "pages" } }`.

## Database design

PostgreSQL is the source of truth. Prisma models include `users`, refresh/reset tokens, audit logs, trucks, routes and ordered route checkpoints, trip tickets and recorded trip checkpoints, pickup/tree/waterway requests, environmental reports, private attachments, and notifications. Request and operational records carry UUID primary keys and unique human-readable reference numbers. Foreign keys use restrictive deletion for completed trip history and cascading deletion only for subordinate tokens/checkpoints/attachments. Indexed search paths include email, role, status, reference numbers, timestamps, plates, and truck IDs.

Trip location is derived exclusively from an administrator's trip ticket/checkpoint events; the service does not collect GPS coordinates. Map-ready route coordinates are optional.

## Authentication and access

- `POST /auth/register` — create a resident; requires full name, email, and a 12+ character password.
- `POST /auth/guest` — describes guest-accessible public features; does not issue credentials.
- `POST /auth/login` — email/password login; returns a short-lived access JWT and sets an HttpOnly refresh cookie.
- `POST /auth/refresh` — rotates the refresh token cookie and returns a new access JWT.
- `POST /auth/logout` — revokes the refresh token and clears its cookie.
- `POST /auth/password/change` — authenticated; body: `currentPassword`, `newPassword`.
- `POST /auth/password/reset` — privacy-preserving reset preparation response. A mail provider must be configured before this can deliver a reset link; this endpoint never returns a reset token.
- `GET /admins`, `POST /admins`, `PATCH /admins/:id` — superadmin only. Admin creation receives the initial password once in the request body; the API does not return it.

Send access tokens as `Authorization: Bearer <token>`. Roles are `RESIDENT`, `ADMIN`, and `SUPERADMIN`. Superadmins inherit admin access.

## Services and tracking

- `GET /trucks`, `GET /trucks/qr/:code`, `GET /routes`, `GET /trips/:id` — public tracking data.
- `POST /trucks`, `PUT /trucks/:id` — admin/superadmin fleet registration and updates. Truck creation returns a QR data URL.
- `POST /routes`, `PUT /routes/:id` — admin/superadmin route/checkpoint maintenance.
- `POST /trips`, `POST /trips/:id/checkpoints`, `POST /trips/:id/complete`, `GET /trips` — admin trip-ticket operations and historical records. An admin can dispatch only trucks assigned to that account. History accepts `truckId`, `from`, and `to` filters.
- `POST /pickup-requests` — resident, guest, or anonymous pickup submission.
- `POST /tree-requests` — tree cutting/pruning; multipart `photo` is required. Private-land submissions require a DENR reference or `denrDocument`.
- `POST /waterway-requests` — multipart `photo` is required.
- `POST /environmental-reports` — illegal dumping, missed collection, or other report; `anonymous=true` omits reporter identity.
- `GET /{pickup-requests|tree-requests|waterway-requests|environmental-reports}` — authenticated, paginated list; residents see their own records, admins see all.
- `GET /{collection}/track/:referenceNo` — public status tracking; does not return reporter contact details.
- `PATCH /{collection}/:id/status` — admin/superadmin status transitions and completion proof uploads. Multipart proof field: `proofOfCompletion`.
- `GET /notifications`, `PATCH /notifications/:id/read` — authenticated user's notifications.
- `GET /attachments/:id` — private attachment download; request owner or admin/superadmin only.
- `GET /dashboard/stats` — admin/superadmin request, fleet, environmental, and six-month activity metrics.
- `GET /reports/export?type=pickup|land|water|environmental|trips&format=csv|xlsx|pdf&from=<date>&to=<date>` — admin/superadmin export, capped at 5,000 rows; each export is audited. CSV is the default.

Request statuses are `SUBMITTED`, `UNDER_REVIEW`, `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, and `REJECTED`. Truck statuses are `ACTIVE`, `IDLE`, `MAINTENANCE`, and `ROUTE_COMPLETED`. Query list endpoints with `page` (1-based), `limit` (1-100), and optional `status`.

## Attachments

Multipart files are held in memory only for validation, checked against allowed MIME types and magic bytes, then written with random names and restrictive file permissions. Uploads are not served statically. Local disk is suitable only when the deployment provides a durable private volume and backups; production multi-instance deployments should replace `src/utils/attachments.js` with private object storage and expiring authorized downloads. Maximum size is configured with `MAX_UPLOAD_BYTES`.

## Local setup

1. Use Node.js 20+ and PostgreSQL. From `backend`, copy `.env.example` to `.env`; set a strong random `JWT_ACCESS_SECRET` (32+ characters), database URL, frontend origins, and initial superadmin values.
2. Install dependencies with `npm install`.
3. Generate the client and apply migrations with `npm run prisma:generate` and `npm run prisma:migrate`.
4. Bootstrap the initial superadmin using `npm run db:seed`, then remove the seed credentials from the environment.
5. Start with `npm run dev`; health check is `GET /health`.

## Production deployment

- Terminate HTTPS at a trusted reverse proxy/load balancer; set `COOKIE_SECURE=true` and restrict `FRONTEND_ORIGINS` to the actual HTTPS origins.
- If deployed behind a proxy, set `TRUST_PROXY_HOPS` to the exact number of trusted hops; do not trust arbitrary forwarded headers.
- Use a managed PostgreSQL instance with TLS, least-privilege database credentials, automated backups, and tested restore procedures.
- Inject secrets from a secret manager, never commit `.env`; rotate JWT/database credentials and remove bootstrap seed variables after initialization.
- Run `npm run prisma:migrate` as a controlled release step before rolling out application instances. Run multiple stateless API instances behind a load balancer; use private durable/object storage for attachments.
- Configure outbound email and implement delivery/consumption for password-reset tokens before enabling account recovery in production.
- Monitor structured application logs, database health, rate-limit events, disk usage, and failed authentication; avoid logging credentials, tokens, or report contents.
- Consider malware scanning for uploads, retention/deletion policies, a formal privacy notice, and a government-approved incident response process.

Email delivery, real-time push delivery, and production object storage require deployment integrations; the API provides audited CSV/XLSX/PDF exports and persisted in-app notifications.
