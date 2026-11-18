# i-WASTE Community Dashboard

A frontend-only React SPA for resident waste collection, route tracking, environmental service requests, recyclable sales, and clean-up events. The app opens directly on the dashboard and has no authentication flow.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The production bundle can be checked with:

```sh
npm run build
npm run preview
```

## Project layout

- `src/App.jsx` — React Router setup for the dashboard and service pages.
- `frontend/Home.jsx` — resident dashboard, map entry points, and service shortcuts.
- `frontend/Module3PickupPage.jsx` — unified normal waste, special waste, and cooking-oil pickup request.
- `frontend/Module4TreeWaterwayPage.jsx` — tree maintenance and public waterway-cleaning requests.
- `frontend/Module5RecyclablesPage.jsx` — recyclable materials sale and pickup/drop-off request.
- `src/components/ServicePageLayout.jsx` — service-module tabs, attachment controls, and request status confirmation.
- `src/components/RouteMap.jsx` — Leaflet/OpenStreetMap collection map.
- `src/services/api.js` — asynchronous mock API methods and typed JSON request payloads.
- `src/utils/validation.js` — allowlist-based validation for search and service request inputs.

The mock dashboard refreshes its data timestamp every 30 seconds. Search, event participation, and service requests use local mock services and do not send data to a server. Selected attachments are validated in the browser; the mock service records their metadata only and does not upload or persist file contents. Recyclable valuation and volume are indicative demo estimates, not official junkshop rates. Client-side checks are for input quality and user experience only; a future backend must independently validate inputs, use parameterized database queries, and handle file storage securely.
