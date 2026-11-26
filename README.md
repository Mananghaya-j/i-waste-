# i-WASTE

i-WASTE is a React single-page application with an Express API and PostgreSQL database for community waste services, collection tracking, environmental reports, and administration.

## Repository layout

```text
.
├── backend/
│   ├── prisma/              # Schema, migrations, and seed
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── database/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── validations/
│   ├── test/
│   ├── API.md
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── styles/
│   │   └── utils/
│   └── test/
├── public/                   # Static hosting configuration and public assets
├── package.json              # Vite scripts and frontend dependencies
└── vite.config.js
```

## Local development

Requirements: Node.js 20 or newer and a PostgreSQL database.

1. Copy the root `.env.example` to `.env.local`. For local development, set `VITE_API_URL=/api`; Vite proxies it to the backend at `API_PROXY_TARGET` (default `http://127.0.0.1:4000`).
2. Copy `backend/.env.example` to `backend/.env`. Set the database URL, a strong access-token secret, and the allowed client origin(s). For local development, set `NODE_ENV=development`, `COOKIE_SECURE=false`, and an upload directory writable by the backend.
3. Install frontend dependencies from the repository root with `npm ci`.
4. Install backend dependencies from `backend` with `npm ci`.
5. From `backend`, run `npm run prisma:generate`, `npm run prisma:migrate`, and, for a new database, `npm run db:seed`.
6. Start the API from `backend` with `npm run dev`, then start Vite from the repository root with `npm run dev`.

The root `VITE_API_URL` may be a relative `/api` path when the web host proxies that path to the API. For local development, Vite provides that proxy; set `API_PROXY_TARGET` if the backend listens somewhere other than `http://127.0.0.1:4000`. For a separate API deployment, set `VITE_API_URL` to the API's HTTPS base URL. Vite embeds `VITE_API_URL` at build time.

## Production deployment

### Frontend

- Build with `npm ci` and `npm run build`; publish the generated `dist/` directory.
- Set `VITE_API_URL` in the hosting provider's build environment before building. Use `/api` only when the production web host forwards `/api` to the backend; otherwise use the backend's HTTPS API base URL. Keep the frontend and API same-site (for example, sibling subdomains) or use a same-origin proxy so the `SameSite=Strict` refresh cookie can be sent.
- Configure the host's SPA fallback so direct visits to React Router paths return `index.html`. Netlify and Vercel fallback examples are included in this repository.
- Do not put database credentials, JWT secrets, or other private values in `VITE_*` variables; Vite variables are public in the generated bundle.

### Backend

- Use Node.js 20+ and `npm ci`. The Prisma CLI is a development dependency, so migrations/generation need the full install; deployments may prune development dependencies after client generation and migration.
- Set `NODE_ENV=production`, `SERVER_URL` to the public HTTPS API origin, and `CLIENT_URL` to the exact HTTPS frontend origin(s), comma-separated when needed.
- Provide `DATABASE_URL` from a secret manager or deployment secret store. Use a managed PostgreSQL database with TLS, least-privilege credentials, backups, and tested restore procedures.
- Set a unique random `JWT_ACCESS_SECRET` of at least 32 characters (for example, generate one with Node's `crypto.randomBytes`). Keep `.env` and all credentials out of Git.
- Set `COOKIE_SECURE=true`; if behind a reverse proxy, set `TRUST_PROXY_HOPS` to the exact number of trusted proxies.
- Set `UPLOAD_DIR` to an absolute, private, durable volume path. Local disk uploads are not shared across multiple API instances; multi-instance deployments need private shared/object storage before enabling that topology.
- Apply Prisma migrations as a controlled release step with `npm run prisma:migrate`. Set one-time super-admin seed credentials only when initializing a new database, then remove them.
- Configure outbound email before enabling password recovery. Email delivery and shared object storage require deployment integrations.

For detailed endpoints and operational limitations, see [backend/API.md](./backend/API.md).

## Validation

Run `npm run lint` and `npm run build` at the repository root. Run `npm test` from `backend`.
