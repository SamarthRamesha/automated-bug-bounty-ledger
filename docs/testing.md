# Verification results

Verified on 2026-10-25 with Node.js 24.15.0, npm 11.12.1, PostgreSQL 18.6,
MongoDB 8.0.19, and Chromium through Playwright 1.61.1.

| Check | Result |
|---|---|
| `npm test` | 59/59 passed across 7 files; real PostgreSQL and MongoDB enabled |
| `npm run test:e2e` | 2/2 browser scenarios passed |
| `npm run lint` | Passed |
| `npm run build` | Passed; final check repeated after integration fixes |
| `npx prisma validate` / generation | Passed |
| Fresh `prisma migrate deploy` | Both migrations applied to a new empty database |
| Upgrade from original schema | Integration test preserves legacy patch/payout rows |
| Important SQL + temporary DDL/DML scripts | Executed successfully against the demo database |

## Automated coverage

| File | Tests | Coverage |
|---|---:|---|
| unit/validation | 10 | Original report/login/lifecycle validation |
| unit/workflow-validation | 16 | Decimal boundaries, trusted fields, review notes, patch dates, bounded evidence |
| api/reports | 11 | Original authorization, scoping, conflicts, validated search/filter combinations |
| api/workflows | 14 | Privileged actions, hidden reports, safe failures, nested adapter errors, evidence recovery |
| integration/postgresql-schema | 6 | Triggers, history/actors, patch/payout rules, rollback, view counts, legacy migration |
| integration/mongodb-evidence | 1 | Native document validation, indexes, idempotent upsert, aggregation |
| integration/prisma-timestamps | 1 | Exact instants across non-UTC PostgreSQL and UTC Prisma connections |

PostgreSQL schema cases use transactions/savepoints and roll back their fixtures.
The timestamp case cleans up its isolated user. MongoDB tests create a unique test
database and drop only that database. Neither test suite resets application data.

The first browser scenario submits a report through the researcher UI, adds evidence,
checks another researcher's isolation and forbidden mutations, rejects/replaces a
patch, approves it, closes the report, records a payout, and verifies history,
audits, researcher visibility, ledger, and aggregation. It retries evidence with a
stable key (including uppercase UUID aliases) and checks that changed-payload reuse fails. The second races review and
payout requests: each pair produces one success and one 409 with one audit event.
Browser contexts also assert that no uncaught page errors occurred.

## Reproduction

Configure application services and run migration deployment, generation, and
`npm run demo:seed` as described in README. For database integration tests, point
`TEST_DATABASE_URL` to a dedicated migrated PostgreSQL database and
`TEST_MONGODB_URI` to a local MongoDB service. Run:

```bash
npm test
npm run lint
npm run build
npx prisma validate
npx playwright install chromium
npm run test:e2e
```

Missing test database settings explicitly skip the respective integration suites;
a configured but unavailable service fails. Unit/API tests mock authentication and
Prisma; the integration suites and browser tests supply the database evidence.
Browser tests start the development server on port 3000, require seeded credentials,
retain created demo records, and refresh three screenshots under `docs/screenshots`.
Do not run them against a shared production database.

The verification host initially lacked Node/npm and MongoDB, and its PostgreSQL
server was stopped. Verification used a Node archive and isolated local services
under `/tmp` (PostgreSQL port 55432; MongoDB port 55433). These are temporary test
services, not system installations. The ignored `.env` contains only local test/demo
configuration and a generated private password. On this host, the temporary Node
runtime can be selected with `export PATH=/tmp/node-v24.15.0-linux-x64/bin:$PATH`.
For a durable demo after reboot, install the documented prerequisites and update
`.env` to point to your persistent databases.

## Findings and limits

- Real database checks corrected report overcounting with multiple patch attempts.
- Screenshot review exposed the adapter's UTC assumption on an Asia/Kolkata server.
  Application and seed connections now explicitly use UTC; a regression test checks
  stored/read instants. Existing historical timestamps are not rewritten.
- Evidence outages and completion-audit failures are covered by API failure-injection
  tests. Recovery is client replay; no background reconciliation worker is claimed.
- Legacy records are retained. New approval/payout rules apply prospectively; no
  historical approval or audit attribution is invented.
- Vitest's existing native-config/ESM notice and Playwright's color-environment
  notices are non-fatal. Build/tests pass with them present.
- The ledger records payments and never initiates money transfers. Database-owner
  bypass, production operations, load testing, and external payment integration are
  outside this undergraduate project.

The completed application demonstrates the required relational workflows, justified
NoSQL evidence storage, database integrity, and an integrated two-role demo with
repeatable verification and authentic contribution history.
