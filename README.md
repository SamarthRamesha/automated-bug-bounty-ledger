# Automated Bug Bounty Vulnerability Patch & Payout Ledger

A DBMS mini-project for tracking vulnerability reports from submission through review, remediation, patching, closure, and bounty payout. The application uses Next.js/React, TypeScript, Prisma, and PostgreSQL. Database constraints and triggers are intended to enforce important lifecycle rules even when data is changed outside the web UI.

> **Handoff note:** This README distinguishes implementation that is present from work that still needs verification. The existence of a table, view, or trigger does not by itself prove its end-to-end workflow is complete.

## 1. Project goals and roles

- **Researcher:** sign in, submit vulnerability reports, and view their own reports.
- **Admin:** sign in, view reports across researchers, and advance reports through the permitted lifecycle.
- **Patch/payout tracking:** connect accepted findings to patch records and, when eligible, bounty payout records; expose useful history and ledger views.
- **Auditability:** preserve report status history and record important security-relevant actions.

The current app has the foundation for the first two goals. Patch, payout, and audit workflows should be verified and completed where needed.

## 2. Technology

- Next.js 16 / React 19 App Router and TypeScript
- PostgreSQL and Prisma ORM/migrations
- Zod request validation
- `jose` signed JWT sessions in an HTTP-only cookie
- `bcrypt` password verification
- Vitest unit, API-route, and PostgreSQL integration tests
- ESLint

Check `package.json`, Prisma schema, and migration files for exact versions and database definitions in the current checkout.

## 3. What Samarth has implemented

### Authentication and authorization
- Login API validates the request and checks the password with bcrypt.
- A signed JWT session is stored in an HTTP-only cookie named `bb_session`.
- Cookie settings include `SameSite=Lax`, root path, an eight-hour lifetime, and `Secure` in production.
- Logout clears the session cookie; session payloads are validated before use.
- `SESSION_SECRET` must be at least 32 characters to create a session.
- Report listing scopes researchers to their own reports; admins can list reports across users.
- Report creation gets the reporter ID from the authenticated session rather than trusting a client-supplied ID.
- Status changes are admin-only at the API layer.

### Report APIs and validation
- `GET /api/reports`: list reports visible to the signed-in user.
- `POST /api/reports`: validate and create a report.
- `PATCH /api/reports/[reportId]/status`: validate the ID/body, check the existing report and lifecycle transition, and update status for admins.
- Malformed JSON and invalid payloads are handled.
- Login email is trimmed and lowercased; title, description, affected asset, severity, status, and UUID are validated.
- Report fields include `title`, `description`, `affectedAsset`, and `severity` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`). Strict schemas reject unexpected fields where configured.

### UI
- Login page (`src/app/login/page.tsx`)
- Dashboard (`src/app/dashboard/page.tsx`)
- Report form (`src/app/dashboard/report-form.tsx`)
- Logout control (`src/app/dashboard/logout-button.tsx`)

### Database foundation
The following application tables/views were visible in Prisma Studio:

- Tables: `users`, `roles`, `user_roles`, `vulnerability_reports`, `patches`, `report_status_history`, `audit_logs`, `bounty_payouts`
- Views: `v_report_dashboard`, `v_payout_ledger`
- Prisma migration tracking: `_prisma_migrations`

Database triggers present in the development database include a status-transition guard before report updates and status-history recording after report inserts/updates. Initial history rows with `from_status = NULL` and `to_status = SUBMITTED` are expected for newly created reports.

**Not yet confirmed from the captured database state:** audit event insertion (the audit table was empty in the screenshot), complete patch workflow, complete payout workflow, and meaningful rows in `v_payout_ledger`. Test these before describing them as finished.

## 4. Status lifecycle

The current application helper defines:

| Current status | Allowed next status |
|---|---|
| `SUBMITTED` | `UNDER_REVIEW`, `REJECTED` |
| `UNDER_REVIEW` | `ACCEPTED`, `REJECTED` |
| `ACCEPTED` | `REMEDIATING` |
| `REMEDIATING` | `PATCHED` |
| `PATCHED` | `CLOSED` |
| `REJECTED` | No further transition |
| `CLOSED` | No further transition |

Invalid transitions should be rejected by the API and by the database trigger. Keep the application helper and SQL trigger consistent if the lifecycle is changed. The database guard does not replace API authentication or role authorization.

## 5. Setup on a new machine

### Prerequisites

Install compatible Node.js/npm and PostgreSQL versions. Check `package.json`, Prisma configuration, and the current project requirements if commands fail.

### Clone and install

```bash
git clone https://github.com/SamarthRamesha/automated-bug-bounty-ledger.git
cd automated-bug-bounty-ledger
npm install
```

### Configure environment

Create a local `.env` from `.env.example` and set values for the local machine. Never commit `.env`, passwords, database credentials, or session secrets. Variables used by the project include:

- `DATABASE_URL`: connection string for the local PostgreSQL database.
- `SESSION_SECRET`: random secret of at least 32 characters.
- `SEED_DEMO_PASSWORD`: local demo seed password if required by `prisma/seed.ts`.

Use `.env.example`, Prisma configuration, and the seed script as the source of truth for exact variable names. Each teammate must configure their own environment. Git does not transfer database rows from Samarth's machine.

### Prepare the database

Create an empty local PostgreSQL database and point `DATABASE_URL` at it, then run:

```bash
npx prisma generate
npx prisma migrate deploy
```

For local development when creating/changing migrations, use the project's script:

```bash
npm run db:migrate
```

To insert demo users, if needed:

```bash
npm run db:seed
```

Check the seed script for demo account emails and required environment variables. Do not assume Samarth's local demo users/reports exist on another machine.

### Start the app and run checks

```bash
npm run dev
npm test
npm run build
npm run lint
```

Open the local URL printed by Next.js. `npm run test:watch` runs Vitest in watch mode. See `package.json` for the available scripts.

## 6. API reference

Use a valid session cookie for protected routes.

### `POST /api/auth/login`
Authenticates a user and sets the session cookie. The request uses the email and password fields defined by the login schema.

### `POST /api/auth/logout`
Clears the session cookie.

### `GET /api/reports`
Returns reports visible to the signed-in user. Researchers see their own reports; admins can see all reports.

### `POST /api/reports`
Creates a report for the signed-in researcher. Expected fields: `title`, `description`, `affectedAsset`, `severity`. The server assigns the reporter from the session.

### `PATCH /api/reports/{reportId}/status`
Admin-only status update. The path requires a UUID and the JSON body contains a supported `status`. Invalid input, missing reports, and invalid transitions are handled separately. Read route files under `src/app/api/` for exact response shapes.

## 7. Current tests and verification

The last recorded local run passed **21 tests across 3 test files**:

- `tests/unit/validation.test.ts`: 10 tests
- `tests/api/reports.test.ts`: 9 tests
- `tests/integration/postgresql-schema.test.ts`: 2 tests

Coverage includes validation, mocked API authentication/authorization, researcher report scoping, invalid IDs, missing reports, invalid transitions, and PostgreSQL schema/lifecycle/payout-integrity checks.

Last recorded checks:

- `npm test`: passed, 21/21
- `npm run build`: passed
- `npm run lint`: passed

Vitest emitted a non-fatal Vite configuration warning about ESM syntax and `configLoader: 'native'`; tests still passed. Ensure the integration test file is tracked and pushed, otherwise Rahul will not receive it:

```bash
git ls-files tests/integration
git status --short
```

If `git ls-files tests/integration` prints nothing, add and commit the integration test file before handoff.

## 8. Work to finish or verify

Confirm with the team which items belong to Rahul before starting them, to avoid duplicate work.

### Patch workflow
- Link patch records to the relevant vulnerability report.
- Decide and implement required patch metadata (for example patch/version identifier, submitted/reviewed timestamps, reviewer, and validation result) based on the assignment specification.
- Add APIs and UI for creating/reviewing patches if not already implemented.
- Enforce server-side authorization for privileged patch actions.

### Bounty payout workflow
- Define payout eligibility according to the project requirements (for example, after acceptance or closure).
- Validate payout amount, currency, recipient, and report relationship.
- Prevent duplicate payouts if that is a project rule.
- Add an admin payout workflow and researcher-visible payout history if required.
- Insert test payout data and verify `v_payout_ledger` returns correct joined information.
- Keep payout creation and related status changes in one transaction if they must succeed/fail together.

### Audit trail
- Decide which actions should be logged: report submission, status change, patch creation/review, and payout creation/update.
- Implement or verify inserts into `audit_logs`, then confirm real records appear.
- Never store passwords, session tokens, or secrets in logs.

### Robustness and UI
- Review whether status updates use an atomic conditional update/transaction to avoid concurrent admins overwriting one another.
- Keep server-side authorization even if the UI hides admin controls.
- Ensure API errors do not expose stack traces, secrets, or database internals.
- Test direct SQL attempts to make invalid status transitions; confirm the trigger blocks them.
- Check loading/success/error states and empty states for reports, patches, and payouts.
- Rerun tests, build, and lint after substantial changes.

## 9. Suggested end-to-end demo

1. Sign in as a researcher.
2. Submit a vulnerability report.
3. Verify the researcher sees their report but not another researcher's report.
4. Sign in as admin and find the report.
5. Advance it through valid lifecycle transitions.
6. Show rows in `report_status_history`.
7. Demonstrate an invalid transition and an unauthorized researcher status update being rejected.
8. Once implemented, create/review a patch and record an eligible payout.
9. Show the resulting `v_payout_ledger` rows and audit records.

## 10. Git collaboration and migrations

Samarth's last reported commit is `f9e50c4` (`Complete database schema, authentication, report APIs and tests`) pushed to `main`. Confirm the current branch state before relying on this hash.

Rahul should work on a separate branch rather than committing directly to `main`:

```bash
git switch -c rahul-implementation
```

If he has freshly cloned the repository, create the branch after cloning. Review changes before merging.

When changing the database schema:
1. Update the Prisma schema as required.
2. Create a migration using the project's migration workflow.
3. Review generated SQL, especially triggers, constraints, views, and data changes.
4. Test on a development database.
5. Commit both schema and migration files.
6. Rerun tests, build, and lint.

## 11. Security and handoff notes

- `.env` is machine-specific; do not commit it or send its secrets to teammates.
- Demo users and sample reports in Samarth's local database are not transferred through Git.
- Recreate the database from migrations and the seed script.
- This is a student/demo project, not a production bounty platform. A real deployment would need additional security, operational, privacy, and payout controls.
- Anything described as “to finish or verify” is unconfirmed until tested in the current checkout.

## 12. Useful commands

```bash
git status
git branch --show-current
npm test
npm run build
npm run lint
npx prisma validate
npx prisma migrate status
npx prisma studio
```

## 13. Key files

- `src/app/page.tsx` — home page
- `src/app/login/page.tsx` — login UI
- `src/app/dashboard/page.tsx` — dashboard UI
- `src/app/dashboard/report-form.tsx` — report submission form
- `src/app/dashboard/logout-button.tsx` — logout control
- `src/app/api/auth/login/route.ts` — login API
- `src/app/api/auth/logout/route.ts` — logout API
- `src/app/api/reports/route.ts` — report list/create APIs
- `src/app/api/reports/[reportId]/status/route.ts` — status update API
- `src/lib/auth.ts` — session handling and role helper
- `src/lib/db.ts` — Prisma/database client
- `src/lib/validation.ts` — request schemas and lifecycle helper
- `prisma/` — schema, migrations, and seed logic
- `tests/unit/` — unit tests
- `tests/api/` — API-route tests
- `tests/integration/` — PostgreSQL integration tests
