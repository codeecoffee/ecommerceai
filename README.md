# Scalable E-Commerce Platform with AI-Powered Recommendations

A production-oriented e-commerce backend designed to handle 10,000+ concurrent users, using Redis caching, Dockerized microservices, and an AI recommendation engine that suggests related items based on customer purchase history.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Entity Models](#entity-models)
5. [Project Structure](#project-structure)
6. [Core Functionality](#core-functionality)
7. [Getting Started](#getting-started)
8. [Scaling & Performance Strategy](#scaling--performance-strategy)
9. [Roadmap](#roadmap)

---

## Overview

This platform is split into two independently deployable services:

- **Core API** — handles products, cart, orders, users, and payments. Optimized for high-concurrency I/O-bound request handling.
- **Recommendation Service** — a Python-based AI microservice that analyzes purchase history to suggest related products.

The two communicate over HTTP (or an async message queue, depending on load requirements), and are deployed as separate Docker containers behind a reverse proxy / load balancer.

---

## Tech Stack

| Layer | Technology | Reasoning |
|---|---|---|
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
              ┌────────────────┴────────────────┐
              │                                  │
      ┌───────▼────────┐               ┌─────────▼─────────┐
      │   Core API      │◄─────────────►│  Recommendation    │
      │  (NestJS/TS)    │   HTTP/Queue   │  Service (FastAPI) │
      └───────┬─────────┘               └─────────┬──────────┘
              │                                    │
      ┌───────▼────────┐                 ┌─────────▼─────────┐
      │  PostgreSQL     │                 │   PostgreSQL       │
      │  (transactional)│                 │  (read replica /   │
      └───────┬─────────┘                 │  purchase history) │
              │                           └────────────────────┘
      ┌───────▼────────┐
      │     Redis       │
      │  (cache layer)  │
      └─────────────────┘
```

Transactional consistency (orders, payments) stays in Postgres. Recommendation data is treated as eventually consistent and can be cached aggressively in Redis without risk to checkout integrity.

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

## Project Structure

```
ecommerce-platform/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── README.md
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
├── nginx/
│   └── nginx.conf
│
└── scripts/
    ├── migrate.sh
    └── seed.ts
```

Each top-level feature (Products, Cart, Orders, Users, Recommendations) is its own NestJS module with its own controller, service, and DTOs — a self-contained boundary that could be extracted into a separate microservice later without major rework.

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
- [ ] Recommendation service v1 (co-occurrence baseline)
- [ ] Load testing pass with k6, identify bottlenecks
- [ ] Recommendation service v2 (collaborative filtering)
- [ ] Production Docker Compose / deployment hardening