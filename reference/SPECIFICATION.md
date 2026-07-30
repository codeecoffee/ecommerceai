# E-Commerce Platform — Technical Specification

Version 1.0 — Draft

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Data Model](#4-data-model)
5. [Business Rules](#5-business-rules)
6. [API Design Conventions](#6-api-design-conventions)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Caching Strategy](#8-caching-strategy)
9. [AI Recommendation Engine](#9-ai-recommendation-engine)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Error Handling Standards](#11-error-handling-standards)
12. [Testing Requirements](#12-testing-requirements)
13. [Deployment & Operations](#13-deployment--operations)
14. [Production Readiness Checklist](#14-production-readiness-checklist)

---

## 1. Purpose & Scope

A scalable e-commerce platform designed to handle 10,000+ concurrent users, providing product browsing, cart management, order checkout, and AI-powered product recommendations based on purchase history. The system is composed of three independently deployable services: a Next.js frontend, a NestJS core API, and a Python/FastAPI recommendation service.

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | SSR/SSG/ISR for SEO and load performance; single app serves storefront + admin via route groups |
| Core API | Node.js + TypeScript + NestJS | Non-blocking I/O suited to concurrent, I/O-bound request handling; DI and module structure out of the box |
| ORM | Prisma | Schema-first, strong generated TypeScript types, transparent migration diffs |
| Database | PostgreSQL | ACID guarantees required for orders/payments |
| Cache | Redis | Cache-aside pattern for hot, read-heavy paths |
| Recommendation Service | Python + FastAPI | Access to mature ML ecosystem (scikit-learn, implicit, PyTorch) |
| Containerization | Docker + Docker Compose | Independent per-service scaling |
| Reverse Proxy | Nginx | SSL termination, load balancing |
| Load Testing | k6 | Validates concurrency targets against the full stack |

---

## 3. Architecture

Three independently deployable services communicate as follows:

- **Frontend (Next.js)** calls the Core API via REST, either server-side (Server Components, ISR) or client-side (interactive actions).
- **Core API (NestJS)** owns all transactional data (Postgres) and cache (Redis). It calls the Recommendation Service over HTTP for suggestion data.
- **Recommendation Service (FastAPI)** reads purchase history (directly or via a replica/event stream) and returns ranked product suggestions. It never writes to transactional tables.

Transactional consistency (orders, payments) is isolated in Postgres under the Core API. Recommendation data is treated as eventually consistent and cached aggressively.

---

## 4. Data Model

### 4.1 Entities

| Entity | Purpose | Owning relation |
|---|---|---|
| User | Account identity and credentials | — |
| Address | Physical address, shareable across users | Many-to-many with User (via `address_id` FK on User) |
| Category | Product taxonomy, self-referencing for subcategories | — |
| Product | Catalog item | Belongs to Category |
| Review | User rating/comment on a product | Belongs to User (author) and Product |
| Cart / CartItem | Pre-purchase state | Belongs to User |
| Order / OrderItem | Finalized transaction | Belongs to User; references Address |
| Payment | Payment record | One-to-one with Order |
| PurchaseHistory | Append-only record feeding recommendations | Belongs to User and Product |
| Recommendation | Cached AI output | Belongs to User and Product |

### 4.2 Key modeling decisions

- **Address is many-to-many with User.** The foreign key lives on `User.address_id`, not as a stored array on `Address`. Multiple users may share one address (e.g., members of the same household).
- **PurchaseHistory and Recommendation are separate from Order/OrderItem.** Transactional data requires strict consistency; recommendation data is eventually consistent and safe to cache aggressively without risk to checkout integrity.
- **Every table follows a base convention**: `id` (UUID), `created_at`, `updated_at` — enforced by convention, not schema inheritance (Prisma does not support model inheritance).
- **Product images are stored as `photo_url: String?`**, referencing external object storage (S3/Cloudinary/etc.) — binary image data is never stored in Postgres.

---

## 5. Business Rules

### 5.1 Address

- **BR-ADDR-01**: An address may be linked to multiple users. Deleting a user does not delete the address; the address simply stops referencing that user (no action required — the relation is computed from `User.address_id`, not a stored list).
- **BR-ADDR-02**: An address must not be deleted while any `User.address_id` or `Order.address_id` still references it. Deletion (automatic or admin-forced) is only permitted when reference counts on both are zero.
- **BR-ADDR-03**: When a user updates their address, the system creates a **new** Address record and repoints the user to it (clone-on-write), rather than mutating the shared record in place. This prevents one resident's edit from silently altering another resident's address data.
- **BR-ADDR-04**: After a user is repointed to a new address (BR-ADDR-03) or removes their address entirely, the system checks whether the previous address is now orphaned (no users, no orders) and deletes it if so. This check and the repointing/detachment must execute inside a single database transaction to prevent race conditions between concurrent requests.
- **BR-ADDR-05**: `Address.postal_code` maps to `postalCode` at the API boundary; all other Address fields carry the same name in both layers except `address_id` → `addressId`.

### 5.2 User

- **BR-USER-01**: Passwords are never stored or transmitted in plaintext beyond the initial request. `password_hash` is generated via bcrypt (cost factor 10) before persistence.
- **BR-USER-02**: `password_hash` must never appear in any API response, log line, or any DTO reachable from a controller. Only a small number of explicitly named, internal-only service methods (e.g., `findUserWithPasswordHash`) may return the raw entity, and only for password comparison during login/JWT validation.
- **BR-USER-03**: Users have a `role` of `USER` or `ADMIN`. Only an admin may change another user's role.
- **BR-USER-04**: A user may read and modify only their own resource (`GET/PATCH/DELETE /users/:id`), unless they hold the `ADMIN` role.
- **BR-USER-05**: Email is unique. Attempting to register a duplicate email returns `409 Conflict`, not a generic `500`.

### 5.3 Product & Category

- **BR-PROD-01**: Products have no individual owner; read access is public, write access (create/update/delete) is restricted to `ADMIN`.
- **BR-PROD-02**: `category_id` must reference an existing Category; category assignment is never a free-text field.
- **BR-PROD-03**: `stock_qty` must never go negative; order placement must decrement stock within the same transaction as order/order-item creation.

### 5.4 Cart & Order

- **BR-ORDER-01**: A cart belongs to exactly one user and is mutable up until checkout.
- **BR-ORDER-02**: An order, once created, is treated as an immutable record of what was purchased — `OrderItem.price_at_purchase` is snapshotted at checkout time and never recalculated from the current `Product.price`.
- **BR-ORDER-03**: Orders are not directly editable by clients via a generic `PATCH`; state changes occur only through specific, named actions (e.g., cancel, refund) that enforce valid state transitions (`pending → paid → shipped → delivered`, plus `cancelled`/`refunded` as terminal states from earlier stages).
- **BR-ORDER-04**: A user may access only their own orders; admins may access any order.
- **BR-ORDER-05**: Order creation must occur within a transaction covering: inventory decrement, order + order-item creation, and payment record creation. Any failure rolls back the entire operation.

### 5.5 Reviews

- **BR-REV-01**: A review is linked to both its author (`User`) and the reviewed `Product`.
- **BR-REV-02**: A user may edit or delete only their own review, unless acting as admin.

### 5.6 Recommendations & Purchase History

- **BR-REC-01**: `PurchaseHistory` records are created automatically as a side effect of order completion; they are never directly created, updated, or deleted by a client request.
- **BR-REC-02**: `Recommendation` records are system-generated and read-only from the client's perspective; there is no `Create`/`Update` DTO for this entity.
- **BR-REC-03**: Recommendation data may be stale by design (minutes to hours); this is an accepted tradeoff for cache performance and must not be treated as a data-integrity bug.

---

## 6. API Design Conventions

### 6.1 DTO layering

Every entity exposed via the API follows a consistent three (or four) DTO shape:

- `Create{Entity}Dto` — validated client input for creation. Required fields, strict validation via `class-validator`.
- `Update{Entity}Dto` — validated client input for partial updates. All fields optional (`PartialType(CreateDto)` where applicable). Never includes relation/ownership fields (see 6.3).
- `{Entity}ResponseDto` — the shape returned to clients. Excludes sensitive fields (e.g., `password_hash`) and excludes relations not relevant to the calling context.
- `{Entity}QueryDto` — optional query/filter/pagination parameters for list endpoints.

Not every entity requires all four — e.g., `Order` has no `UpdateOrderDto` (state changes go through named actions per BR-ORDER-03); `Recommendation` has no `Create`/`Update` DTO at all (BR-REC-02).

### 6.2 Mapper layer

Each module owns a static `{Entity}Mapper` class providing:

- `toCreateInput(dto): Prisma.{Entity}CreateInput`
- `toUpdateInput(dto): Prisma.{Entity}UpdateInput`
- `toResponseDto(entity): {Entity}ResponseDto`

Mappers are pure, stateless transformations — implemented as static methods, not injectable services, since they hold no dependencies and require no DI lifecycle management.

### 6.3 Relation fields are excluded from Update DTOs

Relationship changes (e.g., linking a user to an address, assigning a product to a category) are made through the entity that owns the foreign key, or through an explicitly named action endpoint — never as a side field on a general-purpose update DTO for an unrelated entity. This keeps exactly one code path responsible for mutating any given relationship.

### 6.4 Pagination

A single generic `PaginatedResponseDto<T>` is used across all list endpoints:

```typescript
class PaginatedResponseDto<T> {
  data: T[];
  metadata: { total: number; page: number; limit: number; totalPages: number } | null;
}
```

- Pagination parameters (`page`, `limit`) are optional at the DTO level but should default to sane values (`page = 1`, `limit = 20`) at the point of use.
- Any endpoint capable of returning unbounded result sets (e.g., "list all users") must either enforce pagination by default or be restricted to an explicitly named, admin-only, non-default route (e.g., `/users/export`) — an unbounded public list endpoint is a scaling risk at the target concurrency level and must not exist as a silent fallback.
- Swagger documentation for generic paginated responses uses the `ApiExtraModels` + `getSchemaPath` pattern, since TypeScript generics are erased at runtime and are not otherwise visible to the OpenAPI generator.

### 6.5 Naming convention

API-facing DTOs use camelCase field names regardless of the underlying Prisma schema's snake_case convention (e.g., `postal_code` → `postalCode`, `address_id` → `addressId`). The Prisma schema itself may remain snake_case internally.

---

## 7. Authentication & Authorization

### 7.1 Password handling

- Hashing is performed via a dedicated `HashingService`, located under `common/hashing/` (not inside `auth/`), so that both `UsersModule` and `AuthModule` may depend on it independently without creating a circular module dependency.
- Cost factor: 10 rounds (bcrypt), reassessed periodically against current hardware/security guidance.

### 7.2 Guards

| Guard | Purpose |
|---|---|
| `AuthGuard` (JWT) | Confirms the request carries a valid, authenticated session |
| `RolesGuard` + `@Roles()` | Restricts a route to one or more roles (e.g., `ADMIN`) |
| `OwnershipOrAdminGuard` + `@CheckOwnership()` | Generic ownership check: allows the resource owner or an admin. Resource-type-specific lookup logic (direct field match, many-to-many array check, or indirect relation traversal) is selected via metadata rather than duplicated per-module guard classes |
| `@Public()` | Explicitly marks a route as bypassing authentication |

### 7.3 Ownership resolution by entity

| Entity | Ownership shape | Resolution |
|---|---|---|
| User | Is itself the resource | Direct `id` match against the authenticated user |
| Address | Many-to-many | Authenticated user must appear in the address's linked `users` |
| Order | Direct FK | `Order.user_id` must equal the authenticated user's id |
| Review | Direct FK | `Review.author_id` must equal the authenticated user's id |
| OrderItem (if exposed) | Indirect FK | Traverse to parent Order, then apply the Order rule |
| Product | No owner | Not an ownership check — public read, `RolesGuard`-gated write |

### 7.4 Sensitive-data isolation

- `password_hash` is retrievable only via explicitly named internal methods (e.g., `findUserWithPasswordHash`), used exclusively by `AuthService` and the JWT strategy's `validate()` method. These methods must never be called from a controller or have their return value serialized into an API response.

---

## 8. Caching Strategy

- Redis is applied using the cache-aside pattern on identified hot, read-heavy paths (product detail, category/product listings) — not applied blanket-wide across all endpoints.
- Cache keys are invalidated or updated on the corresponding write path (e.g., a product update invalidates that product's cache entry).
- The frontend's Next.js ISR layer and the API's Redis cache are two distinct caching layers; ownership of what each layer caches must be explicit (e.g., ISR owns rendered page output, Redis owns raw entity data) to avoid conflicting invalidation logic between them.

---

## 9. AI Recommendation Engine

- **Phase 1 (baseline)**: SQL-based co-occurrence — "customers who purchased X also purchased Y" — computed directly against `PurchaseHistory`.
- **Phase 2**: Collaborative filtering via matrix factorization (e.g., the `implicit` library).
- **Phase 3**: Embedding-based similarity to address cold-start users with no purchase history.
- Recommendation results are cached in Redis and refreshed on a schedule or triggered by purchase events; staleness of a few minutes to hours is an accepted tradeoff (BR-REC-03).
- The recommendation service never writes to transactional tables and is treated as a read-only consumer of purchase data.

---

## 10. Non-Functional Requirements

- **Concurrency target**: 10,000+ concurrent users. Verified via k6 load testing against the full Dockerized stack (not against a single local process) before any concurrency claim is considered validated.
- **Database transactions**: Any operation that reads a count or state and then conditionally writes based on it — across one or more tables — must be wrapped in `prisma.$transaction`. Transactions must be kept as narrow as possible: only genuine database operations belong inside a transaction callback; external API calls, email sends, or other non-database work must never execute inside one, as this holds row locks for the duration of the external call.
- **Horizontal scaling**: The Core API is stateless and scalable behind Nginx; session state lives in the JWT and/or Redis, not in-process memory.
- **Observability**: Structured logging and error tracking are required before production launch (specific tooling TBD).

---

## 11. Error Handling Standards

- Known, expected failure conditions (duplicate email, record not found, invalid state transition) are translated into specific HTTP exceptions (`ConflictException`, `NotFoundException`, etc.) rather than allowed to surface as generic `500` errors.
- Prisma error codes are mapped explicitly where a specific client-facing meaning exists (e.g., `P2002` → `409 Conflict`, `P2025` → `404 Not Found`). Unrecognized errors are re-thrown rather than masked, so NestJS's global exception handling can process them — internal error details (stack traces, raw error codes) must not be exposed in client-facing response bodies.
- HTTP status codes documented via Swagger (`@ApiResponse`) must match actual runtime behavior — a documented `204` must correspond to a handler that truly returns no body via `@HttpCode(HttpStatus.NO_CONTENT)`.

---

## 12. Testing Requirements

- Unit tests for service-layer business logic, particularly: ownership resolution, transaction rollback behavior, and mapper correctness (no sensitive fields leak through `toResponseDto`).
- Integration tests for critical flows: signup/login, checkout (inventory decrement + order + payment atomicity), address reassignment/cleanup.
- Load testing (k6) against the full Docker Compose stack prior to any production concurrency claim.

---

## 13. Deployment & Operations

- Each service (`frontend`, `api`, `recommendation-service`) has its own `Dockerfile` and scales independently.
- Database migrations are applied via `prisma migrate deploy` as an explicit deployment step, never inferred implicitly at application startup in production.
- Environment configuration is injected via environment variables (`.env` in development, secret management in production — specific provider TBD).

---

## 14. Production Readiness Checklist

- [ ] All entities have complete Create/Update/Response DTOs matching section 6.1, with no sensitive fields reachable from a response
- [ ] `whitelist: true` (and ideally `forbidNonWhitelisted: true`) set on the global `ValidationPipe`
- [ ] All ownership and role guards applied and verified per section 7.3
- [ ] All multi-step, conditional read-then-write operations wrapped in transactions per section 10
- [ ] Redis cache invalidation verified on every corresponding write path
- [ ] Recommendation service running independently, with a defined fallback (e.g., popular items) for cold-start users
- [ ] k6 load test executed against the full Docker stack at target concurrency, with results documented
- [ ] Structured logging and error monitoring in place
- [ ] Secrets and credentials removed from source control, injected via environment/secret manager
- [ ] Database backup and migration rollback strategy documented
