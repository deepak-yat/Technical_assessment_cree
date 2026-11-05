# Hotel Reservation & Front Desk Management System

A full-stack hotel reservation and front-desk management application built with **MongoDB, Express, React, Node.js, and TypeScript**. The application supports guest room discovery and booking, plus staff workflows for room inventory, reservation management, check-in, and check-out.

> **Assessment project:** This repository was created for the Full Stack Developer take-home assignment. It is designed for a single hotel and uses a REST API as the source of truth for reservation and inventory rules.

## Contents

- [Features](#features)
- [Technology stack](#technology-stack)
- [Architecture and project structure](#architecture-and-project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Seed data and demo accounts](#seed-data-and-demo-accounts)
- [Reservation rules and consistency](#reservation-rules-and-consistency)
- [API overview](#api-overview)
- [Pagination, filtering, and sorting](#pagination-filtering-and-sorting)
- [Indexes](#indexes)
- [Tests and concurrency demonstration](#tests-and-concurrency-demonstration)
- [Security and operational considerations](#security-and-operational-considerations)
- [Known limitations and future improvements](#known-limitations-and-future-improvements)
- [AI tools disclosure](#ai-tools-disclosure)

## Features

### Guest experience

- Browse active room types with descriptions, facilities, capacity, nightly price, and images.
- Search availability using check-in date, check-out date, and guest count.
- View room details and a server-calculated reservation price.
- Register, sign in, refresh an access session, and sign out.
- Create reservations and view a paginated list of personal reservations.
- View reservation details and cancel reservations when their status permits it.

### Staff and front desk

- Protected staff dashboard with operational summary counts, including arrivals, departures, occupied rooms, pending reservations, and occupancy information.
- Create, update, activate, deactivate, and delete room types subject to business rules.
- Manage room capacity/inventory and room information.
- Search, filter, sort, and paginate reservations.
- Confirm eligible pending reservations and perform guest check-in/check-out through protected endpoints.
- Enforce role-based access control on the backend, not only in the React application.

### Engineering features

- TypeScript across the client and server.
- REST API with request validation, centralized error handling, and consistent response helpers.
- Password hashing with Argon2.
- JWT-based authentication with access and refresh token handling.
- MongoDB transactions for booking and inventory consistency; a replica-set deployment is required.
- Idempotency-key support for reservation creation.
- Server-side pagination, filtering, and stable sorting.
- Automated unit and integration tests using Vitest and Supertest.
- Docker Compose configuration for a local MongoDB replica set.

## Technology stack

| Area | Technologies |
|---|---|
| Frontend | React 18, TypeScript, Vite, React Router, TanStack Query, Axios |
| Forms and validation | React Hook Form, Zod, `@hookform/resolvers` |
| Styling and UI | Tailwind CSS, Lucide React |
| Backend | Node.js, Express 4, TypeScript |
| Database / ODM | MongoDB 7, Mongoose 8 |
| Authentication | JWT, Argon2, HTTP-only refresh-token cookie handling |
| Backend validation | Zod |
| Logging and security | Pino, pino-http, Helmet, CORS, express-rate-limit |
| Testing | Vitest, Supertest, mongodb-memory-server |
| Local database | Docker Compose, MongoDB replica set |

## Architecture and project structure

The repository uses npm workspaces to manage the frontend and backend from the root package.

```text
.
├── client/
│   ├── src/
│   │   ├── api/             # Typed API client and endpoint functions
│   │   ├── components/      # Shared UI and layout components
│   │   ├── context/         # Authentication and toast contexts
│   │   ├── hooks/           # React Query hooks
│   │   ├── pages/           # Guest, staff, and authentication pages
│   │   ├── routes/          # Protected route guards
│   │   └── types/           # Frontend API types
│   └── .env.example
├── server/
│   ├── src/
│   │   ├── common/          # Errors, middleware, state machine, utilities
│   │   ├── config/          # Environment and database configuration
│   │   ├── controllers/     # HTTP request/response orchestration
│   │   ├── models/          # Mongoose models and indexes
│   │   ├── repositories/    # Database queries and persistence
│   │   ├── routes/          # Versioned REST route definitions
│   │   ├── schemas/         # Zod request validation schemas
│   │   ├── scripts/         # Seed and concurrency demonstration scripts
│   │   ├── services/        # Business logic
│   │   └── types/           # Shared backend type definitions
│   ├── tests/               # Unit and integration tests
│   └── .env.example
├── docker-compose.yml
├── package.json
└── README.md
```

**Request flow:** React page/component → typed API function → Express route → authentication/authorization and validation middleware → controller → service → repository/Mongoose model → MongoDB.

Business rules such as price calculation, inventory checks, reservation ownership, and allowed status transitions are enforced by the backend. React is responsible for presenting data and collecting user input; it is not trusted to determine reservation totals or availability.

## Getting started

### Prerequisites

- Node.js 20 or a compatible current LTS release.
- npm (the repository includes a root `package-lock.json`).
- Docker Desktop / Docker Engine with the Docker Compose plugin, or a MongoDB replica-set deployment you manage yourself.
- Git.

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd <REPOSITORY_DIRECTORY>
```

### 2. Install dependencies

Run this from the repository root:

```bash
npm ci
```

### 3. Start MongoDB as a replica set

The application uses MongoDB transactions. A standalone MongoDB server is not sufficient; use a replica set, including for local development.

Start the provided MongoDB service:

```bash
npm run docker:db:up
```

The Compose configuration starts MongoDB 7 on `localhost:27017` and initializes the single-node replica set named `rs0` through its health check. Check its status with:

```bash
docker compose ps
docker compose logs mongodb
```

The default connection string in the server environment example is configured for this local replica set.

### 4. Configure the backend environment

Copy the example file:

```bash
cp server/.env.example server/.env
```

Open `server/.env` and set your own long, random secrets for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. Each secret must contain at least 32 characters. Do not commit `server/.env` or share production secrets.

### 5. Configure the frontend environment

```bash
cp client/.env.example client/.env
```

The default `VITE_API_URL=/api/v1` works with the Vite development proxy, which forwards `/api` requests to `http://localhost:5000`.

### 6. Seed demo data

From the repository root, run:

```bash
npm run seed --workspace=server
```

The seed script creates demo users, room types, reservations, and the corresponding per-night inventory records. It uses find-or-create behavior for its seed records, so it can be run again without intentionally duplicating those records.

See [Seed data and demo accounts](#seed-data-and-demo-accounts) for the demo credentials. These accounts and passwords are for local evaluation only.

### 7. Start the application

From the repository root:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000/api/v1`
- Liveness check: `http://localhost:5000/health`
- Readiness check (includes MongoDB connectivity): `http://localhost:5000/ready`

You can also start each workspace separately:

```bash
npm run dev:server
npm run dev:client
```

### Production build

```bash
npm run build
```

Start the compiled backend with:

```bash
npm run start --workspace=server
```

For production, configure a managed MongoDB replica set, secure environment variables, an appropriate frontend hosting setup, and a production CORS allowlist. The Vite development proxy is intended for local development, not production deployment.

## Environment variables

Backend variables are loaded from `server/.env` when the backend is started from its workspace directory.

| Variable | Purpose | Default / example |
|---|---|---|
| `NODE_ENV` | Runtime environment | `development` |
| `PORT` | Express server port | `5000` |
| `API_PREFIX` | Versioned API prefix | `/api/v1` |
| `MONGODB_URI` | MongoDB connection URI | Local `rs0` replica-set URI in `.env.example` |
| `CORS_ORIGIN` | Allowed frontend origin(s), comma-separated | `http://localhost:5173` |
| `HOTEL_TIMEZONE` | IANA timezone used for hotel date behavior | `UTC` |
| `AUTO_CONFIRM` | Automatically confirm new reservations when `true`; otherwise create as `PENDING` | `true` |
| `JWT_ACCESS_SECRET` | Secret used to sign access tokens | Set a private value of at least 32 characters |
| `JWT_REFRESH_SECRET` | Secret used to sign refresh tokens | Set a different private value of at least 32 characters |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime | `7d` |

Frontend variable:

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_URL` | API base path used by the client | `/api/v1` |

Only placeholder values belong in `.env.example`. Use separate, randomly generated secrets outside local evaluation.

## Seed data and demo accounts

Run the seed command described above, then use one of these accounts to explore the application:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@grandhorizon.com` | `Admin@123456` |
| Staff | `staff@grandhorizon.com` | `Staff@123456` |
| Guest | `alice@example.com` | `Guest@123456` |
| Guest | `bob@example.com` | `Guest@123456` |

The seed data includes several room types with different capacities, prices, and inventory counts. One room type is inactive to help demonstrate that inactive room types are excluded from public browsing and availability results.

**Security note:** These are public demo credentials embedded in the seed script. Never use them in a deployed or production environment. Change or remove seeded accounts before exposing an instance publicly.

## Reservation rules and consistency

### Validation and pricing

- Check-out must be later than check-in; invalid or past stay dates are rejected by backend validation.
- Guest count is checked against the selected room type's capacity multiplied by the requested room count.
- Availability is evaluated for every night in the requested stay. The check-out date is treated as the end of the stay, not an occupied night.
- The server reads the current room-type price and calculates the number of nights and total amount. Client-submitted totals are not trusted.
- The reservation stores a price snapshot so later room price changes do not rewrite an existing reservation's recorded price.
- Guests can access and cancel only their own reservations. Staff-only routes are protected by backend authentication and role authorization.

### Reservation lifecycle

The state machine defines these statuses and allowed transitions:

```text
PENDING ───────> CONFIRMED ───────> CHECKED_IN ───────> CHECKED_OUT
   │                  │
   └──> CANCELLED     └──> CANCELLED
```

`CHECKED_OUT` and `CANCELLED` are terminal states. Invalid transitions are rejected. Check-in and check-out are available through staff-protected endpoints and apply eligibility checks.

### Availability and concurrent booking strategy

The application stores per-date inventory documents, identified by room type and calendar date. Reservation creation is performed in a MongoDB transaction:

1. Validate the requested stay and load the active room type.
2. Calculate the price snapshot and total on the server.
3. Ensure a per-night inventory document exists for every occupied night.
4. For each night, perform an atomic conditional update that increments `booked` only if the requested room count fits within the remaining capacity.
5. Create the reservation in the same transaction.
6. If any night cannot be updated, abort the transaction so earlier inventory increments in that transaction are rolled back.
7. Retry eligible transient transaction/write-conflict failures a bounded number of times with backoff. If inventory is no longer available, the losing request receives a conflict response rather than an overbooked reservation.

The transaction boundary keeps the per-night inventory updates and reservation document creation together. This relies on MongoDB transaction support, which requires a replica set or sharded cluster; the provided local setup uses a single-node replica set. The unique `{ roomTypeId, date }` inventory index ensures only one inventory document exists for a room type on a given date.

### Duplicate request handling

Reservation creation accepts an `Idempotency-Key` request header. The key is scoped to the authenticated guest and protected by a partial unique compound index on `{ guest, idempotencyKey }`. If a client retries the same request with the same key, the service can return the existing reservation rather than create a second one. Clients should reuse the same key for retries of the same logical booking and generate a new key for a new booking attempt.

### Cancellation and inventory release

Cancellation is restricted to eligible reservation states. The service uses a transaction and guarded state/inventory updates so concurrent cancellation attempts cannot release the same reserved inventory more than once.

## API overview

All application endpoints are versioned under `/api/v1`. Request and response bodies use JSON unless otherwise noted. Protected routes require a valid authenticated session/token as implemented by the API client and authentication middleware.

### Health

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| `GET` | `/health` | Liveness check | Public |
| `GET` | `/ready` | Readiness and MongoDB connectivity check | Public |

### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/auth/register` | Register a guest account |
| `POST` | `/auth/login` | Sign in |
| `POST` | `/auth/refresh` | Refresh authentication session/token |
| `POST` | `/auth/logout` | Sign out and clear/revoke refresh session |
| `GET` | `/auth/me` | Get the authenticated user's profile |

### Room types and availability

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| `GET` | `/room-types` | List active room types with pagination | Public |
| `GET` | `/room-types/:id` | Get room type details | Public |
| `GET` | `/room-types/availability` | Search availability for a date range and guest count | Public |
| `GET` | `/room-types/staff/all` | List room types including inactive ones | Staff/Admin |
| `POST` | `/room-types` | Create a room type | Staff/Admin |
| `PUT` | `/room-types/:id` | Update a room type | Staff/Admin |
| `PATCH` | `/room-types/:id/status` | Activate or deactivate a room type | Staff/Admin |
| `DELETE` | `/room-types/:id` | Delete a room type when business rules permit | Staff/Admin |

### Reservations

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| `POST` | `/reservations` | Create a reservation; supports `Idempotency-Key` | Authenticated guest |
| `GET` | `/reservations/mine` | List the current user's reservations | Authenticated user |
| `GET` | `/reservations/:id` | Get reservation details, with ownership enforcement for guests | Authenticated user |
| `POST` | `/reservations/:id/cancel` | Cancel an eligible reservation | Authenticated user, ownership enforced |

### Staff and front desk

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| `GET` | `/staff/dashboard` | Dashboard summary metrics | Staff/Admin |
| `GET` | `/staff/reservations` | Search, filter, sort, and paginate reservations | Staff/Admin |
| `PATCH` | `/staff/reservations/:id/status` | Update status using the state machine | Staff/Admin |
| `POST` | `/staff/reservations/:id/check-in` | Check in an eligible reservation | Staff/Admin |
| `POST` | `/staff/reservations/:id/check-out` | Check out an eligible reservation | Staff/Admin |

For exact request schemas, validation constraints, response fields, and error codes, refer to the Zod schemas, controllers, and service implementations under `server/src/`.

## Pagination, filtering, and sorting

Reservation lists are paginated on the server. The API validates pagination inputs, applies filters and stable sorting in the database query, and returns pagination metadata alongside the result items. The frontend sends pagination parameters and renders the page returned by the API; it does not download the entire reservation collection to paginate locally.

The repository uses stable sort keys, including `createdAt` and `_id`, to reduce inconsistent ordering when records share the same timestamp. Staff reservation queries support filtering and sorting through the validated query schema. Public room-type listing is also paginated.

Check the relevant query schemas and repository methods for the exact accepted query parameter names and defaults.

## Indexes

Mongoose schemas define indexes for common lookups and list operations. Important examples include:

| Collection | Index | Reason |
|---|---|---|
| Users | Unique email | Prevent duplicate accounts and support login lookup |
| Room types | `{ isActive: 1, capacity: 1 }` | Filter active room types by capacity during availability search |
| Room types | `{ createdAt: -1, _id: -1 }` | Stable room-type pagination |
| Room inventory | Unique `{ roomTypeId: 1, date: 1 }` | One inventory record per room type per night |
| Reservations | Unique reference | Reservation reference lookup and uniqueness |
| Reservations | Partial unique `{ guest: 1, idempotencyKey: 1 }` | Prevent duplicate idempotency keys per guest |
| Reservations | `{ guest: 1, createdAt: -1, _id: -1 }` | Guest reservation history pagination |
| Reservations | `{ status: 1, checkIn: 1, createdAt: -1 }` | Staff status/date filtering |
| Reservations | `{ checkIn: 1, status: 1 }` and `{ checkOut: 1, status: 1 }` | Front-desk arrival/departure queries |

Automatic index creation is enabled outside production in the database connection options. For production, manage index creation and changes through a controlled deployment/migration process and verify query plans against representative data.

## Tests and concurrency demonstration

Run the automated test suite from the repository root:

```bash
npm test
```

The server test suite uses Vitest and Supertest, with `mongodb-memory-server` available for isolated MongoDB test setup. It includes unit tests for utilities and business rules, as well as integration scenarios covering authentication, room types, reservations, and staff operations.

Other useful commands:

```bash
npm run build
npm run lint
npm run format:check
```

### Concurrency demonstration

Run:

```bash
npm run demo:concurrency
```

The demonstration creates a room type with one available room, fires ten concurrent reservation requests, and checks that only one booking succeeds. It also exercises simultaneous cancellation attempts and verifies that inventory is not released twice.

> **Important:** The demo script clears the `User`, `RoomType`, `RoomInventory`, and `Reservation` collections in the MongoDB database it connects to before running. Run it only against a disposable local/demo database. Do not point it at production or any database containing data you need to keep. If a local MongoDB URI is configured, the script attempts to use it; otherwise it can start an in-memory replica set.

## Security and operational considerations

- Passwords are stored as Argon2 hashes, not plaintext.
- Access and refresh token secrets are configured through environment variables and validated at startup.
- Staff operations are protected by authentication and role-based authorization middleware.
- Guest reservation reads and cancellation operations enforce ownership in the service layer.
- Request payloads are validated with Zod before reaching business logic.
- Helmet, CORS allowlisting, rate limiting on selected endpoints, and structured request logging are configured.
- Database connection settings include connection-pool and timeout options.
- Health and readiness endpoints support process monitoring and dependency checks.
- The API is designed to be stateless at the application-process level; critical booking state is persisted in MongoDB rather than process-local memory.

For a production deployment, use managed secrets, TLS, a managed replica set, database backups, centralized logs/metrics, alerting, rate-limit tuning, and a reviewed index-management process. Configure CORS to allow only the deployed frontend origin(s).

## Known limitations and future improvements

- The application is scoped to a single hotel; multi-property tenancy and property-specific staff permissions are outside the current scope.
- The local Docker Compose database is a single-node replica set for development and demonstration, not a highly available production topology.
- The project does not integrate a real payment gateway, email/SMS notification provider, or external property-management system.
- The frontend development proxy is local-development configuration; production frontend hosting and API routing must be configured separately.
- Production deployment automation, centralized observability, backup/restore procedures, and load testing would be additional hardening work.

## AI tools disclosure

AI assistance was used as a supporting learning and development aid to clarify assignment requirements, explain unfamiliar concepts, explore implementation approaches, and help troubleshoot issues/document the project. The application was reviewed and tested during development, and I am prepared to explain the architecture, implementation choices, trade-offs, and areas for improvement during the technical discussion.

This disclosure should be kept only if it accurately reflects the tools and assistance used during your development process. Add or remove tool names/details as appropriate before submission.

---

Thank you for reviewing this project.
