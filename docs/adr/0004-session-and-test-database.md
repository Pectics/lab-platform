# ADR 0004: session and test database boundaries

- Status: accepted
- Date: 2026-08-01

## Decision

Administrative authentication uses server-side database sessions; browser-held
session identifiers are not authorization truth by themselves. Management
resources use the Node.js runtime and fail closed when identity configuration or
database access is unavailable.

Local and CI integration tests target PostgreSQL 16. Test helpers validate the
database name before any cleanup, migrations run from committed SQL, and each
suite starts from truncated application tables. Production Neon credentials are
never used by test scripts.
