# i-WASTE Community Dashboard

A React SPA for resident waste collection, route tracking, environmental service requests, recyclable sales, and clean-up events. The frontend includes resident login and registration connected to the backend; its other dashboard and service methods still use mock API data.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The production bundle can be checked with:

git re
```sh
npm run build
npm run preview
```
## ------------------------------------------------------------------------------------------ ##

Stack
Frontend

- React (Vite)
- React Router
- Axios
- TailwindCSS
- Leaflet/OpenStreetMap
Backend

- Node.js
- Express.js
- PostgreSQL
- Prisma ORM
- JWT Authentication
- bcrypt
- Zod

## Run locallyFrontend

npm install
npm run dev
Backend
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm start

## ------------------------------------------------------------------------------------------ ##

Environment
Frontend
VITE_API_BASE_URL=http://localhost:4000/api
Backend
DATABASE_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
PORT=4000

## ------------------------------------------------------------------------------------------ ##

Features

- Resident, Admin, and Superadmin roles
- Truck route tracking
- Waste pickup requests
- Tree cutting/pruning requests
- Waterway cleaning requests
- Environmental reporting
- Notifications
- Dashboard analytics
Security

- Prisma ORM
- JWT Authentication
- bcrypt Password Hashing
- Zod Validation
- Rate Limiting
- Helmet
- CORS
See backend/API.md for API endpoints and deployment details.

## ------------------------------------------------------------------------------------------ ##