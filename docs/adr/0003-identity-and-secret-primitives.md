# ADR 0003: identity and secret primitives

- Status: accepted
- Date: 2026-08-01

## Decision

- Administrator sessions use Auth.js database sessions and GitHub OAuth. Only
  the configured numeric GitHub user ID is an administrator identity.
- Subscription and Agent bearer secrets use cryptographically random bytes,
  recognizable non-secret prefixes, and HMAC-SHA-256 digests under a deployment
  pepper. Plaintext is returned only by create/rotate operations.
- Recoverable node credentials use AES-256-GCM with a random nonce per record,
  a versioned deployment key, and resource type plus immutable resource ID as
  additional authenticated data.
- Logging and audit accept structured redacted metadata; raw headers, URLs,
  tokens, protocol secrets, and complete generated configurations are forbidden.

## Consequences

Token verification does not require recoverable storage. Pepper rotation and
encryption-key rotation are explicit versioned operations. Rotation of a bearer
secret immediately replaces its digest while preserving its stable resource ID.
