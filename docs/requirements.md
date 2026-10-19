# Requirements traceability matrix

Status is intentionally conservative. A planned design is not evidence of completion.

| Requirement | Planned location | Verification evidence | Documentation | Status |
|---|---|---|---|---|
| Original real-world, non-CRUD project | Report lifecycle, patch and payout audit | Demo workflow and review | README, architecture | Planned |
| Two-person contributions | Separate phase ownership and commits | Git log and contribution review | team-contributions | Planned |
| SQL + NoSQL | PostgreSQL + MongoDB | Native-service integration tests | architecture, database-design | Planned |
| ERD and relational schema | `docs/diagrams/`, Prisma/migrations | Schema review and migration run | database-design | Planned |
| DDL, constraints, indexes, views | `database/migrations/` | Fresh database migration | advanced-db-features | Planned |
| DML and rich queries | APIs and `database/queries/` | Integration tests and demo | advanced-db-features | Planned |
| Four advanced SQL features | Transactions, trigger, indexes, view, full text | Executable integration tests | advanced-db-features | Planned |
| NoSQL advanced feature | MongoDB evidence aggregation | MongoDB integration test | database-design | Planned |
| Next.js web interface | `src/app/`, components/features | Browser workflow | README, screenshots | Foundation only |
| Backend/API integration | `src/app/api/`, `src/lib/` | API integration tests | api-contract | Planned |
| Authentication and two roles | Auth library/routes and DB tables | Allowed/forbidden tests | architecture | Planned |
| Validation/integrity | Zod + SQL constraints/triggers | Invalid-input tests | database-design, testing | Planned |
| Environment configuration | `.env.example`, server-only config | Secret scan/review | README | Foundation only |
| Documentation, README, demo | `docs/`, README | Final review | all docs | In progress |
| Git/GitHub | Git repository and authentic commits | `git log` | team-contributions | Not started |
