# System architecture

## Purpose

The application lets a security researcher submit a sanitized vulnerability report. An administrator reviews it, changes status through allowed transitions, records remediation, and records one approved bounty award without sending real money.

## Components

```text
Browser UI (Next.js)
        |
Route Handlers + server-side validation + authorization
        |                         |
PostgreSQL (authoritative)     MongoDB (sanitized evidence)
```

## Database boundary

PostgreSQL owns users, roles, reports, report ownership, lifecycle history, patches, payouts, and audit records. MongoDB owns only flexible evidence documents identified by `reportId`; it is not an authority for identity, permissions, report existence, or payout status.

No distributed transaction is claimed. Evidence creation first validates the user and report in PostgreSQL, then writes MongoDB. If MongoDB fails, the API reports failure and records an application audit/retry item when that module is implemented. Payouts do not require MongoDB and use a PostgreSQL transaction.

## Authorization matrix

| Action | Researcher | Admin |
|---|---:|---:|
| Create report | Own only | Yes |
| View report | Own only | All |
| Change status | No | Yes |
| Add/view evidence | Own report only | All |
| Record patch | No | Yes |
| Record payout | No | Yes |

Visibility in the UI is only convenience. Every protected Route Handler performs the same authorization check server-side.
