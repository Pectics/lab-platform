# ADR 0001: control-plane module boundaries

- Status: accepted
- Date: 2026-08-01

## Decision

Use inward-pointing dependencies: presentation invokes application use cases;
use cases coordinate domain policy through ports; infrastructure implements the
ports. The canonical subscription projection and Agent contracts are output
models of application policy, never database records.

The Next.js application remains the repository host. A future
`infra/node-agent` has its own build and test entry without turning the
repository into parallel applications.

## Consequences

Renderers, routes, Agent transport, OAuth, PostgreSQL, encryption, audit, and
logging remain replaceable at their boundaries. Domain code stays deterministic
and can be exhaustively unit- and property-tested.
