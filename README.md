# Lab Platform

Lab Platform is being rebuilt as a database-backed proxy control plane. The
active tree intentionally contains only the new foundation; the legacy Next.js
application and static Clash endpoint remain available through the immutable
Git references documented in [`docs/legacy-archive.md`](docs/legacy-archive.md).

## Requirements

- Node.js 24.12.x
- pnpm 11.18.x
- Docker with Compose

## Local development

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Copy `.env.example` to `.env.local` and provide development-only values. Never
commit secrets or production credentials.

## Quality gates

```bash
pnpm check
pnpm test:e2e
pnpm test:mutation
```

Unit tests enforce per-file 100% statement, branch, function, and line
coverage. Integration tests run against PostgreSQL 16, browser tests exercise
the public boundary, and mutation tests verify that assertions detect semantic
changes rather than merely execute lines.

## Security boundary

The control plane is the source of truth for nodes and subscriptions. Raw
subscription and agent tokens must never be stored. Server-only secrets must
never cross into browser bundles, logs, audit metadata, or API responses.
