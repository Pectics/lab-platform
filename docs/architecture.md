# Control-plane architecture

## Fixed boundaries

The rebuild fixes the following boundaries before feature work begins:

1. PostgreSQL is the source of truth for operators, nodes, credentials,
   subscriptions, agent identities, and audit events.
2. Domain services operate on a protocol-neutral canonical node model.
3. Renderers translate canonical nodes into client-specific subscription
   formats; they do not query persistence or make authorization decisions.
4. Public subscription routes authenticate opaque bearer tokens and publish
   only enabled, eligible nodes.
5. Administrative APIs require a database-backed authenticated session and an
   explicit authorization decision.
6. Node credentials are encrypted at rest. Bearer tokens are one-way digests
   and can only be displayed when issued.
7. Audit writes are part of the same transaction as the state change they
   describe.

These are architectural invariants. Client formats, dashboards, deployment
agents, telemetry, and additional protocols can be introduced incrementally on
top of them.

## Runtime boundary

All database, authentication, token, encryption, and rendering code runs in the
Node.js runtime. Browser components receive only explicitly public view models.

## Module dependency rule

```text
Presentation (routes / server actions)
  -> Application use cases
    -> Domain policies and state machines
      -> Ports (repository, crypto, identity, renderer, agent, audit, logger)
        <- Infrastructure adapters (Postgres, Auth.js, Node crypto, HTTP)
```

Dependencies point inward. Domain and port modules cannot import Next.js,
Drizzle, PostgreSQL, environment readers, or concrete cryptography. Adapters may
implement ports, and composition roots may wire adapters to use cases.
