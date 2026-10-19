# API contract

All routes return JSON `{ "data": ... }` on success and `{ "error": { "code": string, "message": string } }` on failure. Field names and status names below are the compatibility contract for Rahul's phase.

## Report lifecycle

`SUBMITTED -> UNDER_REVIEW -> ACCEPTED -> REMEDIATING -> PATCHED -> CLOSED`; an admin may transition `SUBMITTED` or `UNDER_REVIEW` to `REJECTED`. Invalid transitions receive `409 CONFLICT`.

## Samarth-owned routes

- `POST /api/auth/login`, `POST /api/auth/logout`
- `POST /api/reports`
- `GET /api/reports?status=&severity=&q=`
- `GET /api/reports/:reportId`
- `PATCH /api/reports/:reportId/status`

## Rahul-owned extension routes

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

- UUIDs are strings at the API boundary.
- Route Handlers validate input and authorization before database calls.
- Rahul may add optional response fields but must not rename or weaken the documented requests without recording a migration note here.
