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

The full ER diagram, data dictionary, and runnable migration will be delivered in Milestone 2, after the schema is tested against local PostgreSQL.

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
