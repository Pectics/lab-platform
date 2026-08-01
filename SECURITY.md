# Security policy

## Reporting

Do not open a public issue for a suspected vulnerability. Contact the repository
owner privately with a minimal reproduction, affected revision, and impact.

## Repository rules

- Never commit `.env` files, credentials, raw tokens, or production data.
- Store only keyed HMAC digests of bearer tokens.
- Encrypt recoverable node credentials with a versioned master key.
- Redact sensitive values from logs, errors, audit metadata, and fixtures.
- Treat every public API response and generated subscription as untrusted output.
