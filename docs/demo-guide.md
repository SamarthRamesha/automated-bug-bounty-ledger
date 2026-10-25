# Final demonstration

Prepare PostgreSQL and MongoDB, configure `.env`, deploy migrations, generate Prisma,
and run `npm run demo:seed`. Use the private password configured in your environment.

1. Show the ER diagram, relational schema, migration constraints, and evidence model.
2. Sign in as `researcher.demo@ledger.local`. Submit a new report and open its detail.
3. Add sanitized reproduction steps, expected/observed behavior, affected components,
   and optional metadata. Show the stored evidence.
4. Sign in separately as `researcher.second@ledger.local`; show that the first
   researcher's report is absent. Its detail/evidence APIs return 404 to this user.
5. Sign in as `admin.demo@ledger.local`. Open the new report and advance it through
   UNDER_REVIEW, ACCEPTED, and REMEDIATING.
6. Submit a patch with its reference and past patch date. Reject it with a note.
   Submit a replacement and approve it. The report becomes PATCHED automatically.
7. Close the report. Record an INR or USD payout with a unique payment reference.
   Show the recipient, exact decimal amount, payout ledger, and researcher history.
8. Show the status history and audit trail with report, patch, payout, and evidence
   events. The admin dashboard shows component counts from MongoDB aggregation.
9. Demonstrate invalid transitions, unauthorized mutations, and duplicate payouts
   with `npm run test:e2e`. Its second scenario races approvals and payouts: each
   action has one winner and one 409, with one matching audit event.
10. Run `npm test`, lint, build, and Prisma validation. Show integration tests for
    direct SQL guards, transaction rollback, document validation, and legacy upgrade.

SQL examples (supply a report UUID printed by the app; use your own database URL):

```bash
psql "$DATABASE_URL" -v search_term=validation -v report_id=REPORT_UUID -f database/queries/important-queries.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/queries/ddl-demonstration.sql
```

`DATABASE_URL` must be exported in the shell for these commands; npm/Prisma load
`.env` themselves. SQL examples demonstrate joins, grouping, HAVING, aggregates,
subqueries, ordering, full-text search, views, and isolated DDL/DML. Tests deliberately
attempt invalid writes inside rollback/savepoint boundaries, preserving demo records.

The application demonstrates transactions, triggers/functions, indexing, and views
as advanced SQL concepts, plus MongoDB component aggregation. Evidence is flexible
and belongs in MongoDB; identity, money, and workflow integrity belong in PostgreSQL.
Vector search is optional in the assignment and is not implemented.
