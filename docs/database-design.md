# Database design (approved draft)

## PostgreSQL relations

| Relation | Primary key | Important relationships and rules |
|---|---|---|
| `users` | `id` UUID | unique email; hashed password only |
| `roles` | `id` UUID | contains `RESEARCHER`, `ADMIN` |
| `user_roles` | `(user_id, role_id)` | joins users to roles |
| `vulnerability_reports` | `id` UUID | `reporter_id -> users`; status/severity checks |
| `report_status_history` | `id` UUID | `report_id -> vulnerability_reports`; written by trigger |
| `patches` | `id` UUID | `report_id -> vulnerability_reports` |
| `bounty_payouts` | `id` UUID | unique `report_id`; admin issuer and positive amount |
| `audit_logs` | `id` UUID | action metadata without secrets |

The ER diagram is available in [`diagrams/er-diagram.md`](diagrams/er-diagram.md), the field-level summary in [`data-dictionary.md`](data-dictionary.md), and the runnable Prisma migration in `prisma/migrations/202610190001_initial_schema/migration.sql`. They are schema-validated but remain untested against a live PostgreSQL service until it is installed locally.

## MongoDB collection

`report_evidence` stores flexible reproduction steps, affected components, safe technical observations, optional sanitized proof-of-concept notes, and timestamps. It contains `reportId` as a plain UUID reference, not a cross-database foreign key.

Planned indexes: `{ reportId: 1, createdAt: -1 }` for report evidence retrieval and `{ "affectedComponents": 1 }` for aggregation/filtering.

## Advanced features and owners

| Feature | Owner | Meaningful use |
|---|---|---|
| Status/audit trigger | Samarth | Preserve lifecycle history |
| Full-text GIN index | Samarth | Search permitted reports |
| PostgreSQL indexes | Samarth | Ownership/status filter performance |
| Payout transaction | Rahul | Payout row plus audit row succeed or fail together |
| Reporting view | Rahul | Dashboard summary without duplicating query logic |
| MongoDB aggregation | Rahul | Evidence grouped by component |

## Completion migration

The forward migration adds explicit patch review, approved-patch lifecycle guards,
closed-report payout eligibility, immutable payout/audit records, and transactional
audit triggers. API transactions lock the parent report before child writes; SQL
patch/payout guards also lock that report. Existing status compare-and-swap remains.
The dashboard view counts each report once, and the payout ledger joins the report
owner as recipient. PostgreSQL remains the authority for all workflow decisions.
