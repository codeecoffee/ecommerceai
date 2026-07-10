# Scalable E-Commerce Platform with AI-Powered Recommendations

A production-oriented e-commerce backend designed to handle 10,000+ concurrent users, using Redis caching, Dockerized microservices, and an AI recommendation engine that suggests related items based on customer purchase history.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Entity Models](#entity-models)
5. [Frontend](#frontend)
6. [Project Structure](#project-structure)
7. [Core Functionality](#core-functionality)
8. [Getting Started](#getting-started)
9. [Scaling & Performance Strategy](#scaling--performance-strategy)
10. [Roadmap](#roadmap)

---

## Overview

This platform is split into three independently deployable services:

- **Frontend** — a single Next.js (TypeScript) application serving both the customer-facing storefront and an auth-gated admin dashboard.
- **Core API** — handles products, cart, orders, users, and payments. Optimized for high-concurrency I/O-bound request handling.
- **Recommendation Service** — a Python-based AI microservice that analyzes purchase history to suggest related products.

All three communicate over HTTP (or an async message queue between API and recommendation service, depending on load requirements), and are deployed as separate Docker containers behind a reverse proxy / load balancer.

---

## Tech Stack

| Layer | Technology | Reasoning |
|---|---|---|
| Frontend | **Next.js + TypeScript (App Router)** | Built-in SSR/SSG/ISR solves SEO and first-load performance for public product pages; same language as the backend enables shared types. Single app serves both storefront and admin via route groups. |
| Core API | **Node.js + TypeScript + NestJS** | Non-blocking I/O model suits high-concurrency, I/O-bound e-commerce workloads (DB/cache/API calls). NestJS provides DI, module boundaries, and structure out of the box. |
| ORM | **Prisma** | Schema-first, generates fully-typed client — closest TypeScript equivalent to compile-time safety patterns like EF Core. |
| Database | **PostgreSQL** | Relational integrity for transactional data (orders, payments) where consistency is non-negotiable. |
| Cache | **Redis** | Cache-aside pattern for hot paths (product listings, category pages, session data). |
| AI / Recommendations | **Python + FastAPI** | Dominant ML ecosystem (scikit-learn, implicit, PyTorch) for collaborative filtering and embedding-based recommendations. |
| Messaging (optional, for async recompute) | **Kafka or RabbitMQ** | Decouples "purchase happened" events from recommendation recomputation. |
| Containerization | **Docker + Docker Compose** | Independent service scaling; each service has its own Dockerfile. |
| Reverse Proxy / Load Balancer | **Nginx** | Routes traffic, terminates SSL, load-balances across API instances. |
| Load Testing | **k6** | Validates concurrency targets against the full Dockerized stack, not just localhost processes. |

### Why this combination

- **Next.js for the frontend**: e-commerce storefronts depend heavily on SEO and first-load speed, both of which measurably affect conversion. Next.js solves this natively via SSG/ISR for product pages, while still supporting a fully client-rendered, auth-gated admin section in the same codebase.
- **Node/TypeScript for the core API**: I/O-bound workloads (product lookups, cart mutations, order creation) benefit from Node's event loop, and TypeScript gives compile-time type safety close to what languages like C# offer natively, once paired with Prisma and runtime validation.
- **Python for recommendations**: regardless of which language the core API uses, the ML ecosystem advantage Python offers here is decisive — this is a service worth isolating regardless.
- **Postgres over NoSQL**: orders and payments need ACID guarantees; a relational model with proper transactions avoids a whole class of consistency bugs that a document store would require workarounds for.

---

## Architecture

```
                        ┌─────────────┐
                        │    Nginx    │
                        │ (LB / SSL)  │
                        └──────┬──────┘
                               │
              ┌────────────────┴──────────────────────────┐
              │                                           │
      ┌───────▼─────────┐                                 │
      │  Next.js App    │                                 │
      │ (storefront +   │                                 │
      │  admin, TS/SSR) │                                 │
      └───────┬─────────┘                                 │
              │ REST                                      │
              │                                           │
      ┌───────▼─────────┐                       ┌─────────▼──────────┐
      │   Core API      │  ◄─────────────────►  │  Recommendation    │
      │  (NestJS/TS)    │       HTTP/Queue      │   Service (FastAPI)│
      └───────┬─────────┘                       └─────────┬──────────┘
              │                                           │
      ┌───────▼─────────┐                       ┌─────────▼──────────┐
      │  PostgreSQL     │                       │   PostgreSQL       │
      │  (transactional)│                       │  (read replica /   │
      └───────┬─────────┘                       │  purchase history) │
              │                                 └────────────────────┘
      ┌───────▼─────────┐
      │     Redis       │
      │  (cache layer)  │
      └─────────────────┘
```

The Next.js app talks to the NestJS API for all data — either at request/build time (Server Components, for SSG/ISR product pages) or from the browser (client-side interactions like add-to-cart). Transactional consistency (orders, payments) stays in Postgres. Recommendation data is treated as eventually consistent and can be cached aggressively in Redis without risk to checkout integrity.

---

## Entity Models

### Core Entities

- **User** — account info; has many Orders, CartItems, Reviews, PurchaseHistory records.
- **Product** — belongs to a Category; has many Reviews and OrderItems.
- **Category** — supports subcategories via self-referencing `parent_category_id`.
- **Cart / CartItem** — active shopping session state.
- **Order / OrderItem** — finalized transactional records; immutable once paid.
- **Payment** — linked 1:1 with an Order.
- **Review** — user-submitted product feedback.
- **PurchaseHistory** — denormalized, append-only log feeding the recommendation engine.
- **Recommendation** — cached output from the AI service (user_id, recommended_product_id, score, generated_at).

### Design Principle: Separation of Transactional vs. Derived Data

`PurchaseHistory` and `Recommendation` are deliberately kept separate from `Order`/`OrderItem`. Transactional data requires strict consistency; recommendation data is fine being minutes stale. This separation means the AI service can read purchase data (or consume an event stream) without ever touching critical checkout tables, and recommendation results can be cached and regenerated on a schedule with zero risk to order integrity.

---

## Frontend

A single Next.js (TypeScript) application serves both the customer-facing storefront and the admin dashboard, kept apart via **route groups** rather than separate apps — one codebase, one deploy pipeline, but with each section applying its own layout, auth rules, and rendering strategy.

```
app/
├── (storefront)/              # public, SEO-critical
│   ├── page.tsx               # homepage
│   ├── products/
│   │   ├── page.tsx           # listing — SSG/ISR
│   │   └── [id]/page.tsx      # detail — SSG/ISR
│   ├── cart/page.tsx          # client-rendered, no SEO need
│   └── layout.tsx
│
├── (admin)/                   # auth-gated, no SEO
│   └── admin/
│       ├── dashboard/page.tsx
│       ├── products/page.tsx  # CRUD UI
│       ├── orders/page.tsx
│       └── layout.tsx
│
└── layout.tsx                 # root layout
```

### Rendering strategy per route

| Route | Strategy | Why |
|---|---|---|
| `/products/[id]` | ISR (revalidate every N seconds) | SEO + fast load, tolerates slight staleness |
| `/cart` | Client-side rendered | User-specific, no SEO value |
| `/admin/*` | Server-rendered per-request, no caching | Always needs fresh data, behind auth |

### Auth boundary

Since admin routes live in the same app rather than a separate deployment, Next.js **middleware** gates `/admin/*` at the edge before a page renders:

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const token = request.cookies.get('session')?.value;
    if (!token || !isAdmin(token)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*'] };
```

### Notes and tradeoffs

- **Bundle size**: Next.js code-splits per route automatically, so storefront visitors generally won't download admin-only JS — worth periodically verifying with `@next/bundle-analyzer` rather than assuming, since shared dependencies (e.g. a chart library used only in `/admin/dashboard`) can leak into shared chunks.
- **Shared types with the backend**: since the whole stack is TypeScript, a `packages/shared-types` workspace package (Turborepo/Nx monorepo) can let Prisma-derived DTOs flow straight into frontend types, so a backend schema change surfaces as a frontend type error immediately. This is easiest to set up at project start rather than retrofitted later.
- **Two caching layers to be deliberate about**: Next.js ISR caches rendered pages/data at the edge, while Redis caches on the API side. Decide which layer owns which data early — e.g., ISR owns "rendered product page HTML," Redis owns "raw product data used to render it" — to avoid confusing invalidation bugs where the two disagree.

Reference docs:
- Route groups: https://nextjs.org/docs/app/building-your-application/routing/route-groups
- Middleware: https://nextjs.org/docs/app/building-your-application/routing/middleware
- ISR: https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration
- Data fetching patterns: https://nextjs.org/docs/app/building-your-application/data-fetching

---

## Project Structure

```
ecommerce-platform/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── README.md
│
├── frontend/                          # single Next.js app (storefront + admin)
│   ├── app/
│   │   ├── (storefront)/
│   │   │   ├── page.tsx
│   │   │   ├── products/
│   │   │   ├── cart/
│   │   │   └── layout.tsx
│   │   ├── (admin)/
│   │   │   └── admin/
│   │   │       ├── dashboard/
│   │   │       ├── products/
│   │   │       └── orders/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── storefront/
│   │   └── admin/
│   ├── lib/
│   │   ├── api-client.ts             # typed fetch wrapper for the NestJS API
│   │   └── auth.ts
│   ├── middleware.ts
│   ├── Dockerfile
│   ├── next.config.js
│   └── package.json
│
├── api/                              # Node/NestJS core service
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── products/
│   │   ├── cart/
│   │   ├── orders/
│   │   │   └── payment/
│   │   ├── users/
│   │   │   └── auth/
│   │   ├── recommendations/          # thin client calling the Python service
│   │   ├── common/
│   │   │   ├── cache/                # Redis wrapper
│   │   │   ├── prisma/               # DB client module
│   │   │   ├── filters/
│   │   │   ├── interceptors/
│   │   │   └── decorators/
│   │   └── config/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── test/
│   ├── Dockerfile
│   └── package.json
│
├── recommendation-service/           # Python/FastAPI AI microservice
│   ├── app/
│   │   ├── main.py
│   │   ├── models/
│   │   │   └── collaborative_filter.py
│   │   ├── routers/
│   │   └── db/
│   ├── requirements.txt
│   └── Dockerfile
│
├── packages/
│   └── shared-types/                 # optional: DTOs shared between api/ and frontend/
│
├── nginx/
│   └── nginx.conf
│
└── scripts/
    ├── migrate.sh
    └── seed.ts
```

Each top-level feature (Products, Cart, Orders, Users, Recommendations) is its own NestJS module with its own controller, service, and DTOs — a self-contained boundary that could be extracted into a separate microservice later without major rework. The frontend follows the same principle via route groups: storefront and admin sections stay logically separate within one deployable app.

---

## Core Functionality

1. **Product Catalog** — browsing, search, category filtering; cached aggressively via Redis cache-aside pattern.
2. **Cart Management** — add/remove/update items, persisted per user session.
3. **Order & Checkout** — inventory decrement, payment processing, order status lifecycle (pending → paid → shipped → delivered).
4. **Authentication** — JWT-based auth with guards protecting user- and admin-scoped routes.
5. **Reviews** — per-product user ratings and comments.
6. **AI Recommendations**:
   - Baseline: SQL-based co-occurrence ("customers who bought X also bought Y").
   - Iteration 2: collaborative filtering via matrix factorization (`implicit` library).
   - Iteration 3: embedding-based similarity for cold-start users with no purchase history.
   - Results cached in Redis and refreshed on a schedule or triggered by purchase events.

---

## Getting Started

```bash
# Clone and configure environment
cp .env.example .env

# Start the full stack locally
docker compose up --build

# Run database migrations
docker compose exec api npx prisma migrate deploy

# Seed sample data (optional)
docker compose exec api npm run seed
```

Services will be available at:
- Frontend (storefront + admin): `http://localhost:3001`
- Core API: `http://localhost:3000`
- Recommendation Service: `http://localhost:8000`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

---

## Scaling & Performance Strategy

1. Establish correctness first — core CRUD and checkout flow without caching or AI.
2. Introduce Redis caching only on identified hot paths (product detail, category listing) using cache-aside with sensible TTLs.
3. Bring in the recommendation service only after the core flow is stable, starting with the simplest viable approach (co-occurrence counting) before investing in more complex models.
4. Load test the full Dockerized stack with k6 before claiming any concurrency target — the real bottleneck is usually the database connection pool, not the application server.
5. Horizontally scale the API service behind Nginx once load testing identifies where throughput actually caps out.

---

## Roadmap

- [ ] Finalize Prisma schema and initial migration
- [ ] Docker Compose skeleton (API + Postgres + Redis)
- [ ] Core CRUD: Products, Cart, Orders, Auth
- [ ] Redis cache-aside on product/category endpoints
- [ ] Next.js app scaffold with storefront/admin route groups
- [ ] Storefront product listing + detail pages (ISR)
- [ ] Admin dashboard CRUD screens + middleware auth gate
- [ ] Recommendation service v1 (co-occurrence baseline)
- [ ] Load testing pass with k6, identify bottlenecks
- [ ] Recommendation service v2 (collaborative filtering)
- [ ] Production Docker Compose / deployment hardening