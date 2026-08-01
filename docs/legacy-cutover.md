# Legacy subscription cutover and rollback

The control-plane rebuild intentionally removes the legacy
`/internal/clash-config` runtime before new subscription renderers are enabled.
There is no compatibility fallback to `INTERNAL_TOKEN`, `?token=`, `?auth=`, or
the former upstream-provider rewrite path.

## Rollout

1. Confirm no supported client still points at `/internal/clash-config`.
2. Deploy the foundation with new subscription routes disabled until migrations,
   administrator login, token issuance, eligibility, and the selected Renderer
   all pass their contract checks.
3. Issue a new database-backed subscription token and show its plaintext once.
4. Validate Header Bearer and `/s/<token>` behavior for each supported target.
5. Move clients explicitly; do not redirect or translate query credentials.
6. Monitor non-secret request counts, eligibility reason codes, and Agent
   generation health. Never log full URLs, headers, tokens, or generated output.

## Rollback

If the new deployment fails before client migration, roll back the application
revision and preserve the forward-migrated database. If emergency legacy service
is explicitly approved, deploy the immutable
`legacy/pre-control-plane-2026-08-01` tag as a separate rollback revision. Do not
copy legacy code or static credentials back into the control-plane branches.

After any plaintext token may have been exposed during diagnosis, rotate it;
rollback does not revive old bearer secrets.
