# Requirements traceability

The supplied Level 3 PDF requires SQL plus a second database paradigm, four advanced
SQL concepts, one advanced NoSQL concept, a Next.js interface, two roles, validation,
documentation, and authentic contributions. It does not prescribe patch or payout
eligibility; the selected project rules require explicit patch approval and closure
before payout. Vector search is optional and omitted.

| Requirement | Implementation | Evidence |
|---|---|---|
| Meaningful non-CRUD workflow | Guarded report, patch review, payout lifecycle | Browser workflow and SQL constraint tests |
| Two-person contributions | Samarth foundation; Rahul completion | Git history and team-contributions |
| SQL + NoSQL | PostgreSQL authority; MongoDB flexible evidence | Real-service integration suites |
| ERD, schema, keys, relationships | Prisma, migrations, ER diagram, dictionary | Schema validation and fresh/upgrade migration checks |
| DDL + DML | Migrations and temporary-table demonstration | Executable SQL examples |
| JOIN, GROUP BY, HAVING, aggregates, subqueries | Important queries and dashboard/ledger views | SQL examples and integration assertions |
| Four advanced SQL concepts | Transactions, triggers/functions, indexes, views | Patch approval transaction, rollback tests, SQL guards, dashboard/ledger |
| Advanced NoSQL concept | Component aggregation | MongoDB integration and dashboard/browser assertions |
| Functional Next.js UI | Researcher/admin dashboards, forms, history | Browser tests and real screenshots |
| Backend integration and environment config | Route Handlers, Prisma/pg, MongoDB driver | API/browser tests; .env.example |
| Authentication and two roles | Signed HTTP-only session; researcher/admin checks | Authorization and ownership tests |
| Database-level integrity | Constraints, triggers, document validator | Direct invalid SQL/document tests |
| Objectives and functional requirements | README and API contract | Demonstration guide |
| Architecture and database justification | Architecture, design, evidence model | Linked documentation |
| Testing, screenshots, conclusion | Testing evidence, screenshots, final handoff | Reproducible commands and captured artifacts |
| Git/GitHub | Five completion commits on existing branch | Local author identity and github-second origin |

A passed unit test alone does not establish database behavior. See `testing.md` for
which checks actually ran, their prerequisites, and known limits.
