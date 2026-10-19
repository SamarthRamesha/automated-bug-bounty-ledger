# Project guidance

- Keep the project suitable for a two-person undergraduate DBMS submission.
- PostgreSQL is authoritative for users, report ownership, statuses, patches, payouts, and audits.
- MongoDB stores only sanitized flexible evidence documents linked by a PostgreSQL report UUID.
- Never commit `.env.local`, credentials, payloads, or sensitive proof-of-concept material.
- Enforce authorization in Route Handlers; UI visibility is not authorization.
- Do not change Rahul-owned API contracts without documenting a backward-compatible migration in `docs/api-contract.md`.
- Run only tests that have their required local services configured and report unavailable tests honestly.
