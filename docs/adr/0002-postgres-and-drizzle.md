# ADR 0002: PostgreSQL authority and Drizzle

- Status: accepted
- Date: 2026-08-01

## Decision

Neon PostgreSQL is the sole control-plane authority. Use Drizzle ORM with the
`pg` driver. Commit generated SQL migrations and review them as source. Never use
runtime schema push in production.

Drizzle was selected for inspectable SQL migrations, explicit transaction
boundaries, PostgreSQL constraint support, small runtime surface, and Next.js
Node-runtime compatibility. Domain and port modules do not import Drizzle, so
the adapter remains replaceable.

Forward migrations are the normal deployment path. A rollback restores the
application revision while preserving data; destructive schema reversals require
a separately reviewed compensating migration and backup validation.

## Test strategy

Unit/property tests require no database. Integration and migration smoke tests
use an isolated PostgreSQL 16 database whose name ends in `_test`. CI provisions
a fresh service container. Tests reject any non-test database name before
truncating state.
