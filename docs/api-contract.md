# API contract

All routes return JSON `{ "data": ... }` on success and `{ "error": { "code": string, "message": string } }` on failure. This reference describes the implemented authentication, report, evidence, patch-review, payout, and reporting endpoints.

## Report lifecycle

`SUBMITTED -> UNDER_REVIEW -> ACCEPTED -> REMEDIATING -> PATCHED -> CLOSED`; an admin may transition `SUBMITTED` or `UNDER_REVIEW` to `REJECTED`. Invalid transitions receive `409 CONFLICT`.

## Authentication and report routes

- `POST /api/auth/login`, `POST /api/auth/logout`
- `POST /api/reports`
- `GET /api/reports?status=&severity=&q=`
- `GET /api/reports/:reportId`
- `PATCH /api/reports/:reportId/status`

### Authentication

`POST /api/auth/login` accepts `{ "email": "researcher.demo@ledger.local", "password": "your_private_demo_password" }`.
Email is trimmed and lowercased. A successful login returns the account email and
roles and sets the signed, HTTP-only `bb_session` cookie for eight hours.
`POST /api/auth/logout` clears it and returns `{ "data": { "loggedOut": true } }`.
Protected requests must include the session cookie; role checks run on the server.

### Report submission and status

`POST /api/reports` accepts:

```json
{
  "title": "Search input validation discrepancy",
  "description": "A sanitized local finding requiring validation and regression testing.",
  "affectedAsset": "demo.local/search",
  "severity": "HIGH"
}
```

The title must contain 8–200 characters, description 20–10,000, and affected asset
1–255 after trimming. Severity is LOW, MEDIUM, HIGH, or CRITICAL. Unexpected fields
are rejected; the reporter is assigned from the session. Successful creation returns
201 with the report in `data`.

`PATCH /api/reports/:reportId/status` accepts `{ "status": "UNDER_REVIEW" }` (or another
allowed next status). It is admin-only and rejects invalid transitions or stale
conditional updates with 409. `GET /api/reports` supports status/severity filters and
case-insensitive title/asset search with `q` limited to 200 characters. Researchers'
queries remain scoped to their own reports.

## Evidence, patch, and payout routes

### Evidence

`POST /api/reports/:reportId/evidence` accepts:

```json
{
  "reproduction": { "steps": ["string"], "expectedBehavior": "string", "observedBehavior": "string" },
  "affectedComponents": ["string"],
  "technicalMetadata": { "browser": "string" },
  "sanitizedPocNotes": "optional string"
}
```

`GET /api/reports/:reportId/evidence` returns evidence visible only to the report owner or an admin.

### Patch

`POST /api/reports/:reportId/patches` is admin-only and accepts `{ "summary": string, "reference": string, "patchedAt": ISODateString }`.

### Payout

`POST /api/reports/:reportId/payouts` is admin-only and accepts `{ "amount": positive decimal, "currency": "INR" | "USD", "reference": string }`. It must reject a second payout for the same report.

## Contract rules

- UUIDs are strings at the API boundary and are normalized to lowercase, including evidence retry keys.
- Route Handlers validate input and authorization before database calls.
- Preserve documented field names and request bodies; record any compatibility changes in this contract.

## Completed workflow additions

- `GET /api/reports/:reportId`: owner/admin report details, patches, payout, and status history.
- `POST /api/reports/:reportId/patches`: existing request retained; admin submission during REMEDIATING creates PENDING review. `patchedAt` cannot be in the future.
- `PATCH /api/reports/:reportId/patches/:patchId/review`: admin `{decision: "APPROVED" | "REJECTED", note?: string}`. Rejection requires a note. Approval and PATCHED status are atomic; reviews are final.
- `POST /api/reports/:reportId/payouts`: CLOSED plus approved patch required. Amount accepts a decimal string (preferred) or JSON number, at most two decimal places and ten integer digits; response amounts are strings. Recipient is derived from report ownership. INR/USD only. No money is transferred.
- `GET /api/payouts`: owner-scoped history, all records for admins.
- `GET /api/reports/:reportId/audit`: admin-only audit events, including linked patch/payout/evidence events.
- Report listing implements `q`, `status`, and `severity`. Search matches title and affected asset; the indexed full-text query remains available in the SQL demonstrations.

New APIs return 400 for invalid input, 401/403 for missing/insufficient privileges,
404 for missing or inaccessible reports, and 409 for conflicting workflow actions.
Existing requests are preserved; patch review is an additive workflow requirement.

### Evidence reliability

Evidence POST accepts an optional UUID `Idempotency-Key` header. Clients should
retain it until the request succeeds and reuse it on retries. Reusing a key for a
different actor, report, or payload returns 409. Technical metadata values are
bounded strings; components are deduplicated. PostgreSQL records an intent before
MongoDB upsert and a completion/failure event afterwards. If completion logging
fails, evidence still returns successfully with `auditPending: true`; replaying the
same request reconciles the completion event. There is no distributed transaction.
MongoDB failures return 503 and do not affect other SQL workflows.

`GET /api/reporting/components` is admin-only and returns component evidence counts
using a MongoDB aggregation restricted to report IDs that still exist in SQL.
