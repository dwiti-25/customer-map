# 🚗 Mowito Customer Travel Planner

A customer visualization and travel-planning application built for **Mowito Robotics**. It maps every customer/lead, plans optimized multi-stop visit routes with real road routing, and is backed by a proper multi-user database instead of static spreadsheets.

---

## 🌐 Live Application

https://customer-map-theta.vercel.app

Log in with an account created via the backend (see [Authentication](#-authentication) below).

## 📂 GitHub Repository

https://github.com/dwiti-25/customer-map

---

# Features

### 📊 Dashboard
- Total Leads
- Cities Covered

### 🗺 Interactive Customer Map
- Interactive Leaflet map with marker clustering
- Customer popups showing company, contact, industry, and location type (Corporate HQ / Plant)
- Real, geocoded coordinates where researched; a deterministic city-center fallback (with a small randomized offset to de-overlap markers) where not

### 🔍 Search & Filters
Search by company name or contact person. Filter by city and by industry (OEM, System Integrator, Machine Builder, Packaging, Automotive, Electronics, Food, Pharma, Logistics, Other).

### 📋 Customer List
Company, contact person, city, industry — supports multi-select for route planning.

### 📍 Route Planning
Select multiple customers to generate an optimized visit order with:
- **Real road routing** within a city (via OpenRouteService), not a straight-line guess
- Total distance and estimated travel time
- The route drawn on the map as an actual road-following path

### ➕ Add / Edit Lead
Add or edit a customer directly from the app: company, contact, designation, industry, email, phone, application notes, city, location type, address, and exact map position — set via:
- **Locate on Map** — geocodes the typed address
- **Pasting a Google Maps link** — extracts exact coordinates directly from the URL (place links, `@lat,lng` links, `?q=` links, and `maps.app.goo.gl` short links), moves the pin, and recenters the map automatically
- Manually dragging the pin

If neither the link nor the address can be resolved, the app says so explicitly rather than silently guessing a location.

### 📤 Export
Export the full customer list as CSV.

### 🔐 Authentication
- Login required for the whole app (no public data).
- Any user can change their own password from the header (**Change Password**) — no database access needed.
- New accounts are created by an admin via the API (`POST /api/auth/register`); there's no public sign-up.

---

# Architecture

Two independently deployed services:

```
customer-map/
├── src/                  # Frontend - React + Vite + Leaflet
│   ├── api/              # All network calls to the backend go through here
│   ├── auth/             # Login form, change-password modal
│   ├── leads/            # Add/edit lead modal, map location picker
│   ├── routing/          # Route-building + optimization logic
│   └── utils/            # City coordinates, marker jitter, legacy Excel loader (unused)
│
├── server/               # Backend - Express + Prisma + PostgreSQL
│   ├── prisma/           # Schema + migrations
│   ├── scripts/          # One-off scripts (admin bootstrap, legacy data import, enrichment import)
│   └── src/
│       ├── routes/       # auth, customers, locations, industries, routes (directions/geocode)
│       ├── middleware/   # requireAuth, requireRole
│       └── lib/          # Prisma client, JWT, OpenRouteService client, Google Maps URL parser
│
└── public/               # Legacy Excel files - kept for reference only, no longer read by the app
```

### Data model (PostgreSQL via Prisma)
- **User** — email, hashed password, role (`ADMIN` / `EMPLOYEE`), `isActive` (re-checked on every request for instant revocation)
- **Industry** — fixed lookup table, seeded once
- **Customer** — company + contact info, optional industry, soft-deletable, tagged if it came from the legacy Excel import
- **Location** — one or more per customer (`PLANT` / `CORPORATE_HQ`), address, coordinates, Google Maps URL

### Real road routing & geocoding
[OpenRouteService](https://openrouteservice.org/) powers both:
- `POST /api/routes/directions` — real driving route between waypoints in the same city (falls back to a straight-line estimate if unavailable)
- `POST /api/routes/geocode` — turns a typed address into coordinates
- `POST /api/routes/resolve-maps-url` — extracts coordinates directly from a pasted Google Maps URL, resolving `maps.app.goo.gl` short links server-side first

---

# Tech Stack

**Frontend:** React, Vite, Leaflet / React-Leaflet, PapaParse (CSV export)
**Backend:** Node.js, Express, Prisma, PostgreSQL, JWT (jsonwebtoken + bcryptjs), Zod (validation)
**External API:** OpenRouteService (routing + geocoding)
**Deployment:** Vercel (frontend), Railway (backend + PostgreSQL)

---

# Running Locally

### Frontend
```bash
git clone https://github.com/dwiti-25/customer-map.git
cd customer-map
npm install
cp .env.example .env   # set VITE_API_URL to your local backend
npm run dev
```
Runs at `http://localhost:5173`.

### Backend
```bash
cd server
npm install
cp .env.example .env   # set DATABASE_URL, JWT_SECRET, ORS_API_KEY
npx prisma migrate deploy
node prisma/seed.js                          # seeds the fixed industry list
ADMIN_EMAIL=you@mowito.in ADMIN_PASSWORD=... ADMIN_NAME="Your Name" node scripts/createAdmin.js
npm run dev
```
Runs at `http://localhost:4000`. Requires a PostgreSQL database and an [OpenRouteService API key](https://openrouteservice.org/dev/#/signup) (free tier is enough).

---

# Deployment

- **Frontend** — Vercel, auto-builds from `main` (`vercel --prod` or the GitHub integration).
- **Backend** — Railway, deployed via `railway up` from `server/`; runs `prisma generate` on install and needs `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `ORS_API_KEY`, `PORT` set as environment variables.
- **Database** — Railway-hosted PostgreSQL. Run `npx prisma migrate deploy` against it after any schema change.

---

# Future Improvements

- Self-service "Add User" admin panel (today, creating a new named account requires an admin to call the API directly)
- Per-user audit trail on customer/location edits
- Code-splitting the frontend bundle (currently a single ~700KB chunk)
- Notes & follow-up tracking per customer visit

---

# Developed By

**Dwiti Suchak**
BITS Pilani — Electrical & Electronics Engineering + M.Sc. Economics
Developed during internship at **Mowito Robotics**.
