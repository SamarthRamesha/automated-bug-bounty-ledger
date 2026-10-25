# Database design

## PostgreSQL relations

| Relation | Primary key | Relationships and integrity |
|---|---|---|
| users | UUID id | Unique email; password hash; researcher/admin roles |
| roles | UUID id | Unique role name |
| user_roles | user_id, role_id | Many-to-many role membership |
| vulnerability_reports | UUID id | Required reporter; optional assignee; severity/status enums; text checks |
| report_status_history | UUID id | Report and actor references; initial row and real transitions from trigger |
| patches | UUID id | Report; unique report/reference; submitter; final reviewer/outcome/time/note |
| bounty_payouts | UUID id | Unique report and payment reference; exact positive decimal; recording admin |
| audit_logs | UUID id | Actor, entity, action, JSONB metadata, timestamp; append-only |

See the ER diagram, Prisma schema, and data dictionary for cardinalities and types.
Both migrations deploy to an empty database. A migration integration test recreates
the original schema, inserts legacy patch/payout data, and verifies the upgrade.

## Lifecycle and transactions

The SQL trigger and application helper retain the original status graph. New patches
require REMEDIATING and an authenticated admin submitter. Rejection requires a note;
reviewed patches cannot be changed/deleted. Approval and report PATCHED status share
one API transaction. PATCHED/CLOSED require an approved patch. Payout insertion
requires CLOSED and an approved patch; updates/deletes are blocked. The recipient
is the report owner, not a client-supplied user.

The API locks the report before patch/review/payout operations. Database child-write
guards also lock it; ordinary report updates take the row lock naturally. Status
compare-and-swap prevents lost updates. Unique constraints handle duplicate reports'
payouts and repeated references, including competing requests.

Triggers write report submission/status, patch submission/review, and payout audit
in the same transaction. PostgreSQL owns all financial and permission decisions.
Audit rows and payout rows are append-only through normal writes; an owner capable
of disabling triggers remains outside that guarantee.

Legacy patches become PENDING with nullable submission attribution. Historical
payouts remain intact; past approvals/audits are not inferred. Legacy completed
reports without approved patches are not newly eligible for payouts.

## Views and indexes

`v_report_dashboard` groups reports by status/severity and counts each report once,
including an EXISTS-based approved-patch count. `v_payout_ledger` joins payment,
report, recording admin, and recipient. APIs use equivalent scoped Prisma relations
for researcher history; the dashboard reads its SQL view directly.

SQL indexes support ownership/status, report ordering, patch/history retrieval,
payment dates, and audit lookup. The existing GIN full-text index is exercised by
the SQL search demonstration. UI search uses case-insensitive title/asset matching.

## MongoDB evidence

`report_evidence` stores `_id` (UUID operation key), `reportId`, `submittedByUserId`,
reproduction steps/expected/observed behavior, component names, string-valued
technical metadata, optional sanitized notes, and timestamps. API bounds and a MongoDB
JSON schema validator constrain documents. Indexes are `{reportId: 1, createdAt: -1}`
and `{affectedComponents: 1}`, plus MongoDB's unique `_id` index.

SQL validates report access before evidence storage. POST writes an audit intent,
upserts by operation UUID, and records success/failure. A canonical payload hash
prevents a retry key from being reused for different content. Completion-event IDs
are deterministic so retries do not duplicate success audits. Completion failure
returns `auditPending`; replay repairs it. No SQL/MongoDB transaction is claimed.

Component reporting filters to SQL-owned report IDs, unwinds component arrays,
groups evidence counts by component, sorts counts/name, and projects display fields.
This models flexible reproduction evidence without weakening relational ownership
or monetary consistency. Vector retrieval is not required for this project.

## Timestamp consistency

Prisma application and seed pools set PostgreSQL session timezone to UTC because
the adapter encodes/decodes timestamp values in UTC. Database-generated history/audit
and JavaScript dates then represent the same instants even on non-UTC servers.
Browsers format those instants for the viewer; historical stored values are retained.
